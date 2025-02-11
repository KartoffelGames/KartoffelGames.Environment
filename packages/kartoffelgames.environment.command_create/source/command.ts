import { CliCommandDescription, CliPackageInformation, CliParameter, Console, FileSystem, ICliPackageCommand, Import, Package, Project } from '@kartoffelgames/environment-core';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip-js/zip-js';
import { CliPackageBlueprintParameter, ICliPackageBlueprintResolver } from "./i-cli-package-blueprint-resolver.interface.ts";

export class KgCliCommand implements ICliPackageCommand<string> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<string> {
        return {
            command: {
                description: 'Create new package.',
                parameters: {
                    root: 'create',
                    optional: {
                        list: {
                            shortName: 'l'
                        },
                        blueprint: {
                            shortName: 'b'
                        },
                        package: {
                            shortName: 'p'
                        }
                    }
                }
            },
            configuration: {
                name: 'package-blueprint',
                default: '',
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pBlueprintPackages - All cli packages grouped by type.
     */
    public async run(pProject: Project, _pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        const lConsole = new Console();

        // Read all available cli packages.
        const lCliPackageList: Array<CliPackageInformation<CliBlueprintPackageConfiguration>> = await pProject.cliPackages.readAll<CliBlueprintPackageConfiguration>('blueprint');

        // Read all KG_Cli_Blueprint packages informations.
        const lBlueprintList: Map<string, Blueprint> = this.readBlueprintList(lCliPackageList);

        // List blueprints on --list parameter and exit command.
        if (pParameter.has('list')) {
            // Output all commands.
            lConsole.writeLine('Available blueprints:');
            for (const [lBlueprintName,] of lBlueprintList) {
                lConsole.writeLine(`-- ${lBlueprintName}`);
            }
            return;
        }

        // Output heading.
        lConsole.writeLine('Create Package');

        // Read required parameter.
        let lBlueprintName: string;
        if (pParameter.has('blueprint')) {
            lBlueprintName = pParameter.get('blueprint').toLowerCase();
        } else {
            lBlueprintName = await lConsole.promt('Bluprint name: ', /^[a-z0-9-]+$/);
        }

        // Find blueprint by name.
        const lBlueprint: Blueprint | undefined = lBlueprintList.get(lBlueprintName);
        if (!lBlueprint) {
            throw `Blueprint "${lBlueprintName}" not found.`;
        }

        // Find name. Get from command parameter on promt user.
        const lPackageNameValidation: RegExp = /^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/;
        let lNewPackageName: string;
        if (pParameter.has('package_name')) {
            lNewPackageName = pParameter.get('package_name');
        } else {
            lNewPackageName = await lConsole.promt('Package Name: ', lPackageNameValidation);
        }

        // Validate packag name again or for the first time.
        if (!lPackageNameValidation.test(lNewPackageName)) {
            throw 'Package name does not match JSR package name convention';
        }

        // Create blueprint.
        const lNewPackageDirectory: string = await this.createBlueprint(lNewPackageName, lBlueprint, pProject);

        // Update vs code workspaces.
        lConsole.writeLine('Add VsCode Workspace...');
        pProject.addWorkspace(lNewPackageDirectory);
        pProject.save();

        // Update vs code workspaces.
        this.addWorkspace(pProject, lNewPackageName, lNewPackageDirectory);

        // Read package information of newly created package.
        const lPackage: Package = pProject.getPackage(lNewPackageName);

        // Add package information to deno.json.
        lConsole.writeLine('Set package configuration...');
        lPackage.setCliConfigurationOf(this, lBlueprintName);
        await lPackage.save();

        // Display init information.
        lConsole.writeLine('Package successfully created.');
    }

    /**
     * Add packages as vs code workspace to workspace settings.
     * @param pWorkspaceName - Name of workspace. 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public addWorkspace(pProject: Project, pPackageName: string, pPackageDirectory: string): void {
        // Read workspace file json.
        const lVsWorkspaceFilePath: string = FileSystem.findFiles(pProject.rootDirectory, { depth: 0, include: { extensions: ['code-workspace'] } })[0];
        const lVsWorkspaceFileText = FileSystem.read(lVsWorkspaceFilePath);
        const lVsWorkspaceFileJson = JSON.parse(lVsWorkspaceFileText);

        // Add new folder to folder list.
        const lPackageDirectory: string = FileSystem.pathToRelative(pProject.rootDirectory, pPackageDirectory);
        const lPackageDirectoryList: Array<{ name: string, path: string; }> = lVsWorkspaceFileJson['folders'];
        lPackageDirectoryList.push({
            name: Package.nameToId(pPackageName),
            path: lPackageDirectory
        });

        // Sort folder alphabeticaly.
        lPackageDirectoryList.sort((pFirst, pSecond) => {
            if (pFirst.name < pSecond.name) { return -1; }
            if (pFirst.name > pSecond.name) { return 1; }
            return 0;
        });

        // Update workspace file.
        const lAlteredVsWorkspaceFileText = JSON.stringify(lVsWorkspaceFileJson, null, 4);
        FileSystem.write(lVsWorkspaceFilePath, lAlteredVsWorkspaceFileText);
    }

    /**
     * Create blueprint files.
     * @param pPackageName - Package name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private async createBlueprint(pPackageName: string, pBlueprint: Blueprint, pProject: Project): Promise<string> {
        const lConsole = new Console();

        // Get source and target path of blueprint files.
        const lProjectName: string = Package.nameToId(pPackageName);
        const lTargetPath: string = FileSystem.pathToAbsolute(pProject.packagesDirectory, lProjectName.toLowerCase());

        // Check if package already exists.
        if (pProject.hasPackage(pPackageName)) {
            throw `Package "${pPackageName}" already exists.`;
        }

        // Check existing target directory.
        if (FileSystem.exists(lTargetPath)) {
            throw `Target directory "${lTargetPath}" already exists.`;
        }

        // Create blueprint resolver instance.
        const lPackageResolver: ICliPackageBlueprintResolver = await this.createPackagePackageBlueprintResolverInstance(pBlueprint.packageInformation);

        // Get url path of project blueprint and fetch it.
        const lProjectBlueprintZipUrl: URL = pBlueprint.blueprintFileUrl;
        const lProjectBlueprintZipRequest: Response = await fetch(lProjectBlueprintZipUrl);
        const lProjectBlueprintZipBlob: Blob = await lProjectBlueprintZipRequest.blob();

        // Create zip reader from zip blob.
        const lZipBlobReader: BlobReader = new BlobReader(lProjectBlueprintZipBlob);
        const lZipReader: ZipReader<unknown> = new ZipReader(lZipBlobReader);

        // Rollback on error.
        try {
            // Copy files.
            lConsole.writeLine('Copy files...');

            // Create target directory.
            FileSystem.createDirectory(lTargetPath);

            // Decompress blueprint into target directory.
            for await (const lZipEntry of lZipReader.getEntriesGenerator()) {
                // Skip directories.
                if (lZipEntry.directory) {
                    continue;
                }

                const lTargetFilePath: string = FileSystem.pathToAbsolute(lTargetPath, lZipEntry.filename);

                // Read Directory part of target file path.
                const lTargetFileDirectoryPath: string = FileSystem.directoryOfFile(lTargetFilePath);

                // Create directory if it does not exist.
                if (!FileSystem.exists(lTargetFileDirectoryPath)) {
                    FileSystem.createDirectory(lTargetFileDirectoryPath);
                }

                // Output copy information.
                lConsole.writeLine("Copy " + lZipEntry.filename);

                // Read zipped file.
                const lZipFileData: Uint8Array = await lZipEntry.getData!<Uint8Array>(new Uint8ArrayWriter());
                FileSystem.writeBinary(lTargetFilePath, lZipFileData);
            }

            // Create package parameter.
            const lPackageParameter: CliPackageBlueprintParameter = {
                packageName: pPackageName,
                packageIdName: lProjectName,
                packageDirectory: lTargetPath
            };

            // Execute blueprint after copy handler.
            lConsole.writeLine('Execute blueprint resolver...');
            await lPackageResolver.afterCopy(lPackageParameter, pProject);
        } catch (lError) {
            lConsole.writeLine('ERROR: Try rollback.');

            // Rollback by deleting package directory.
            FileSystem.deleteDirectory(lTargetPath);

            // Rethrow error.
            throw lError;
        }

        return lTargetPath;
    }

    /**
     * Create all package blueprint definition class. 
     * @param pBlueprintPackages - Cli packages.
     */
    private readBlueprintList(pPackages: Array<CliPackageInformation<CliBlueprintPackageConfiguration>>): Map<string, Blueprint> {
        const lAvailableBlueprint: Map<string, Blueprint> = new Map<string, Blueprint>();

        // Create each package blueprint package.
        for (const lPackage of pPackages) {
            // Skip non package blueprints.
            if (!lPackage.configuration.packageBlueprints) {
                continue;
            }

            // Convert all available blueprints to an absolute path.
            for (const [lBlueprintPackageName, lBlueprintPackagePath] of Object.entries(lPackage.configuration.packageBlueprints.packages)) {
                // Build blueprint file url by getting the path of kg-cli.config.json and replacing it with the the blueprint path.
                const lBlueprintFileUrlString: string = Import.resolveToUrl(`${lPackage.packageName}/kg-cli.config.json`).href
                    .replace('kg-cli.config.json', lBlueprintPackagePath);

                lAvailableBlueprint.set(lBlueprintPackageName, {
                    packageInformation: lPackage,
                    resolverClass: lPackage.configuration.packageBlueprints.resolveClass,
                    blueprintFileUrl: new URL(lBlueprintFileUrlString)
                });
            }
        }

        return lAvailableBlueprint;
    }

    /**
     * Create a new instance of a package blueprint resolver.
     * 
     * @param pPackage - Package information.
     * 
     * @returns - Cli package resolver instance. 
     */
    private async createPackagePackageBlueprintResolverInstance(pPackage: CliPackageInformation<CliBlueprintPackageConfiguration>): Promise<ICliPackageBlueprintResolver> {
        if (!pPackage.configuration.packageBlueprints?.resolveClass) {
            throw new Error(`Can't initialize blueprint resolver ${pPackage.configuration.name}. No entry class defined.`);
        }

        // Catch any create errors for malfunctioning packages.
        try {
            // Import package and get command constructor.
            const lPackageImport: any = await Import.import(pPackage.packageName);
            const lPackageCliConstructor: CliPackageBlueprintResolverConstructor = lPackageImport[pPackage.configuration.packageBlueprints.resolveClass] as CliPackageBlueprintResolverConstructor;

            // Create command instance
            return new lPackageCliConstructor();
        } catch (e) {
            throw new Error(`Can't initialize blueprint resolver ${pPackage.configuration.name}. ${e}`);
        }
    }

}

type Blueprint = {
    packageInformation: CliPackageInformation<CliBlueprintPackageConfiguration>;
    resolverClass: string;
    blueprintFileUrl: URL;
};

type CliPackageBlueprintResolverConstructor = {
    new(): ICliPackageBlueprintResolver;
};

export type CliBlueprintPackageConfiguration = {
    packageBlueprints: {
        resolveClass: string;
        packages: { [name: string]: string; };
    };
};