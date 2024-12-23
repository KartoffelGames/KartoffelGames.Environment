import { CliCommandDescription, CliPackageInformation, CliPackages, CliParameter, CliProjectBlueprintParameter, Console, FileSystem, ICliCommand, ICliProjectBlueprintResolver, Package, Process, ProcessContext, ProcessParameter, Project } from '@kartoffelgames/environment.core';

export class CliCommand implements ICliCommand<string> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<string> {
        return {
            command: {
                description: 'Initialize new monorepo project.',
                pattern: 'init [blueprint_name] [project_name] --list'
            },
            configuration: {
                name: 'project-blueprint',
                default: ''
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param _pProject - Project information.
     */
    public async run(pParameter: CliParameter, _pProject: Project): Promise<void> {
        const lConsole = new Console();

        // Read all available cli packages.
        const lCliPackageList: Array<CliPackageInformation> = Array.from((await new CliPackages(ProcessContext.workingDirectory).getCommandPackages()).values());

        // Read all KG_Cli_Blueprint packages informations.
        const lBlueprintList: Map<string, Blueprint> = this.readBlueprintList(lCliPackageList);

        // List blueprints on --list parameter and exit command.
        if (pParameter.parameter.has('list')) {
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
        let lBlueprintName: string = pParameter.parameter.get('blueprint_name')?.toLowerCase() ?? '';
        if (lBlueprintName === '') {
            lBlueprintName = await lConsole.promt('Bluprint name: ', /^[a-z0-9-]$/);
        }

        // Find blueprint by name.
        const lBlueprint: Blueprint | undefined = lBlueprintList.get(lBlueprintName);
        if (!lBlueprint) {
            throw `Blueprint "${lBlueprintName}" not found.`;
        }

        // Find name. Get from command parameter on promt user.
        const lProjectNameValidation: RegExp = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
        let lNewProjectName: string = pParameter.parameter.get('project_name') ?? '';
        if (lNewProjectName === '') {
            lNewProjectName = await lConsole.promt('Project Name: ', lProjectNameValidation);
        }

        // Validate packag name again or for the first time.
        if (!lProjectNameValidation.test(lNewProjectName)) {
            throw 'Project name does not match NPM package name convention';
        }

        // Create blueprint.
        await this.createBlueprint(lNewProjectName, lBlueprint);

        // Create process parameter to install all dependencies.
        const lProcessParameters: ProcessParameter = new ProcessParameter(ProcessContext.workingDirectory, ['npm', 'install']);

        // Call npm install.
        lConsole.writeLine('Install packages...');
        await new Process().executeInConsole(lProcessParameters);

        // Display init information.
        lConsole.writeLine('Project successfully created.');
    }

    /**
     * Create blueprint files.
     * @param pProjectName - Package name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private async createBlueprint(pProjectName: string, pBlueprint: Blueprint): Promise<string> {
        const lConsole = new Console();

        // Get source and target path of blueprint files.
        const lTargetPath: string = FileSystem.pathToAbsolute(ProcessContext.workingDirectory);

        // Check existing target directory.
        if (FileSystem.exists(lTargetPath)) {
            throw `Target directory "${lTargetPath}" already exists.`;
        }

        // Create blueprint resolver instance.
        const lPackageResolver: ICliProjectBlueprintResolver = await new CliPackages(ProcessContext.workingDirectory).createPackageProjectBlueprintResolverInstance(pBlueprint.packageInformation);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const lDecompress: (pTargetFile: string, pSourceDirectory: string) => Promise<void> = require('decompress');

        // Rollback on error.
        try {
            // Copy files.
            lConsole.writeLine('Copy files...');

            // Create target directory.
            FileSystem.createDirectory(lTargetPath);

            // Wait for decompression.
            await lDecompress(Package.resolveToPath(pBlueprint.blueprintFilePath), lTargetPath);

            // Create package parameter.
            const lPackageParameter: CliProjectBlueprintParameter = {
                projectName: pProjectName,
                projectDirectory: lTargetPath
            };

            // Execute blueprint after copy handler.
            lConsole.writeLine('Execute blueprint resolver...');
            await lPackageResolver.afterCopy(lPackageParameter);
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
    private readBlueprintList(pPackages: Array<CliPackageInformation>): Map<string, Blueprint> {
        const lAvailableBlueprint: Map<string, Blueprint> = new Map<string, Blueprint>();

        // Create each package blueprint package.
        for (const lPackage of pPackages) {
            // Skip non package blueprints.
            if (!lPackage.configuration.projectBlueprints) {
                continue;
            }

            // Convert all available blueprints to an absolute path.
            for (const [lBlueprintPackageName, lBlueprintPackagePath] of Object.entries(lPackage.configuration.projectBlueprints.packages)) {
                lAvailableBlueprint.set(lBlueprintPackageName, {
                    packageInformation: lPackage,
                    resolverClass: lPackage.configuration.projectBlueprints.resolveClass,
                    blueprintFilePath: Package.resolveToPath(lPackage.packageName + `/` + lBlueprintPackagePath)
                });
            }
        }

        return lAvailableBlueprint;
    }
}

type Blueprint = {
    packageInformation: CliPackageInformation;
    resolverClass: string;
    blueprintFilePath: string;
};