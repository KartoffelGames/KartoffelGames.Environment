import { CliPackages } from '../cli/cli-packages.ts';
import { ICliCommand } from '../cli/i-cli-command.interface.ts';
import { FileSystem } from '../system/file-system.ts';

export class Project {
    /**
     * Find the project root path by searching for the root package file.
     * 
     * @param pCurrentPath - Current path.
     */
    public static findRoot(pCurrentPath: string): string {
        const lAllFiles: Array<string> = FileSystem.findFiles(pCurrentPath, {
            direction: 'reverse',
            include: {
                fileNames: ['deno.json'],
                extensions: ['json']
            }
        });

        // Root directory names.
        const lRootDirectories: Array<string> = new Array<string>();

        // Load and filter all package files without root set to true.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileSystem.read(lFile);
            const lPackageJson = JSON.parse(lFileContent);

            if (lPackageJson['kg']?.root === true) {
                lRootDirectories.push(FileSystem.directoryOfFile(lFile));
            }
        }

        // Order root directory names by length where the longest is first and the shortest is last.
        lRootDirectories.sort((pFirst, pSecond) => pSecond.length - pFirst.length);

        // Return current directory if no root was found.
        if (lRootDirectories.length !== 0) {
            return lRootDirectories[0];
        } else {
            return pCurrentPath;
        }
    }

    private readonly mCliPackages: CliPackages;
    private readonly mRootPath: string;

    /**
     * Project root path.
     */
    public get projectRootDirectory(): string {
        return this.mRootPath;
    }

    /**
     * Constructor.
     * 
     * @param pCurrentPath - Project root path.
     * @param pDefaultConfiguration - Default configuration for project.
     */
    public constructor(pCurrentPath: string, pPackaged: CliPackages) {
        this.mCliPackages = pPackaged;
        this.mRootPath = Project.findRoot(pCurrentPath);
    }

    /**
     * Add packages as vs code workspace to workspace settings.
     * @param pWorkspaceName - Name of workspace. 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public addWorkspace(pPackageName: string, pPackageDirectory: string): void {
        // Read workspace file json.
        const lVsWorkspaceFilePath: string = FileSystem.findFiles(this.projectRootDirectory, { depth: 0, include: { extensions: ['code-workspace'] } })[0];
        const lVsWorkspaceFileText = FileSystem.read(lVsWorkspaceFilePath);
        const lVsWorkspaceFileJson = JSON.parse(lVsWorkspaceFileText);

        // Add new folder to folder list.
        const lPackageDirectory: string = FileSystem.pathToRelative(this.projectRootDirectory, pPackageDirectory);
        const lPackageDirectoryList: Array<{ name: string, path: string; }> = lVsWorkspaceFileJson['folders'];
        lPackageDirectoryList.push({
            name: this.packageToIdName(pPackageName),
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

        // The same for Deno.json
        const lWorkspaceDenoFilePath: string = FileSystem.pathToAbsolute(this.projectRootDirectory, 'deno.json');
        const lWorkspaceDenoFileText = FileSystem.read(lWorkspaceDenoFilePath);
        const lWorkspaceDenoFileJson = JSON.parse(lWorkspaceDenoFileText);

        // Convert to a relative path from the workspace root replace double backslashes with single backslashes and leading with a dot slash.
        let lRelativePackageDirectory: string = FileSystem.pathToRelative(this.projectRootDirectory, pPackageDirectory);
        lRelativePackageDirectory = `./${lRelativePackageDirectory.replace(/\\/g, '/')}`;

        // Read or create workspaces list.
        const lWorkspaceDenoFileJsonWorkspaceList: Array<string> = lWorkspaceDenoFileJson['workspace'] ?? new Array<string>();

        // Add new workspace folder.
        lWorkspaceDenoFileJsonWorkspaceList.push(lRelativePackageDirectory);

        // Update deno json file.
        lWorkspaceDenoFileJson['workspace'] = lWorkspaceDenoFileJsonWorkspaceList;

        // Write deno.json file.
        const lAlteredWorkspaceDenoFileText = JSON.stringify(lWorkspaceDenoFileJson, null, 4);
        FileSystem.write(lWorkspaceDenoFilePath, lAlteredWorkspaceDenoFileText);
    }

    /**
     * Read project configuration.
     * @param pName - Project name.
     */
    public getPackageInformation(pName: string): PackageInformation {
        // Construct paths.
        const lPackageInformation: PackageInformation | null = this.findPackageByName(pName);
        if (lPackageInformation === null) {
            throw `Package "${pName}" not found.`;
        }

        return lPackageInformation;
    }

    /**
     * Check if package exists.
     * @param pName - Package or project name name.
     */
    public packageExists(pName: string): boolean {
        const lPackageDirectory: PackageInformation | null = this.findPackageByName(pName);
        return lPackageDirectory !== null;
    }

    /**
     * Convert package name to project name.
     * 
     * @param pPackageName - Package name.
     */
    public packageToIdName(pPackageName: string): string {
        // Empty packae name.
        if (!pPackageName) {
            return '';
        }

        // Split packagename by /, -, _ and .
        let lSplitPackageNamePartList: Array<string> = pPackageName.split(/[\/\-_\.]/g);

        // Remove empty strings and remove any other symbols, anything to lowercase.
        lSplitPackageNamePartList = lSplitPackageNamePartList.filter(pValue => pValue !== '');
        lSplitPackageNamePartList = lSplitPackageNamePartList.map(pValue => pValue.replace(/[^\w]/g, '').toLowerCase());

        // Return nothing when nothing is left.
        if (lSplitPackageNamePartList.length === 0) {
            return '';
        }

        // Convert first letter to uppercase.
        const lLeadingToUppercase = (pValue: string) => {
            return pValue.charAt(0).toUpperCase() + pValue.slice(1);
        };

        // Pop the first entry and use it as project name.
        let lPackageNameId: string = lLeadingToUppercase(lSplitPackageNamePartList.shift()!);

        // On empty return result.
        if (lSplitPackageNamePartList.length === 0) {
            return lPackageNameId;
        }

        // Add next part as project namespace.
        lPackageNameId += `.${lLeadingToUppercase(lSplitPackageNamePartList.shift()!)}`;

        // On empty return result.
        if (lSplitPackageNamePartList.length === 0) {
            return lPackageNameId;
        }

        // Append the remaining parts as package name with hyphen.
        lPackageNameId += `.${lSplitPackageNamePartList.map(pValue => lLeadingToUppercase(pValue)).join('_')}`;

        return lPackageNameId;
    }

    /**
     * Read all projects of package.
     */
    public readAllPackages(): Array<PackageInformation> {
        // Search all deno.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileSystem.findFiles(this.projectRootDirectory, {
            depth: 2, // ./packages/{package_name}/deno.json
            include: {
                fileNames: ['deno.json'],
                extensions: ['json']
            },
            exclude: { directories: ['node_modules'] }
        });

        // Create package list.
        const lPackageList: Array<PackageInformation> = new Array<PackageInformation>();

        // Search all files.
        for (const lFile of lAllFiles) {
            // Read package information.
            const lPackageInformation: PackageInformation | null = this.readPackageInformation(lFile);
            if (lPackageInformation === null) {
                continue;
            }

            // Read and push package settings.
            lPackageList.push(lPackageInformation);
        }

        return lPackageList;
    }

    /**
     * Write project kg information into deno.json.
     * 
     * @param pPackageName - Name of project.
     * @param pUpdater - Update function.
     */
    public async readCliPackageConfiguration<T>(pPackageInformation: PackageInformation, pCommand: ICliCommand<T>): Promise<T> {
        // Value is object.
        const lIsObject = (pValue: any) => {
            return typeof pValue === 'object' && pValue !== null;
        };

        // Merge current configuration with default configuration object.
        const lFillDefaults = (pCurrent: Record<string, any>, pDefault: Record<string, any>): Record<string, any> => {
            for (const lKey of Object.keys(pDefault)) {
                const lCurrentValue: any = pCurrent?.[lKey];
                const lDefaultValue: any = pDefault[lKey];

                if (lIsObject(lDefaultValue) && lIsObject(lCurrentValue)) {
                    // Rekursion fill in inner objects.
                    lFillDefaults(lCurrentValue, lDefaultValue);
                } else if (typeof lCurrentValue === 'undefined') {
                    // Fill in value.
                    pCurrent[lKey] = lDefaultValue;
                } else if (lIsObject(lDefaultValue) !== lIsObject(lCurrentValue)) {
                    // Values differ. Update value.
                    pCurrent[lKey] = lDefaultValue;
                }
            }

            return pCurrent;
        };

        // Create instance of package and skip if no configuration is setable.
        if (!pCommand.information.configuration) {
            throw new Error(`Cli package has no configuration.`);
        }

        // Read configuration key.
        const lPackageConfigurationKey: string | undefined = pCommand.information.configuration.name;

        // Read current available configuration of package.
        const lCurrentConfiguration: Record<string, any> = (() => {
            // Return empty object if no configuration is set.
            if ((pPackageInformation.packageJson['kg']?.['config']?.[lPackageConfigurationKey] ?? null) === null) {
                return {};
            }

            // Wrap configuration in object.
            return {
                [lPackageConfigurationKey]: pPackageInformation.packageJson['kg']['config'][lPackageConfigurationKey]
            };
        })();

        // Fill in and return default values.
        return lFillDefaults(lCurrentConfiguration, {
            [lPackageConfigurationKey]: pCommand.information.configuration.default
        })[lPackageConfigurationKey] as T;
    }

    /**
     * Update project kg information in deno.json.
     * 
     * @param pPackageName - Name of project.
     */
    public async updatePackageConfiguration(pPackageName: string): Promise<void> {
        // Construct paths.
        const lPackageInformation: PackageInformation | null = this.findPackageByName(pPackageName);
        if (lPackageInformation === null) {
            throw `Package "${pPackageName}" not found.`;
        }

        // Read package configuration before updating package json.
        const lPackageConfiguration: Record<string, any> = await this.readPackageConfiguration(lPackageInformation);

        // Read and parse deno.json
        const lJson: Record<string, any> = lPackageInformation.packageJson;

        // Read package config.
        lJson['name'] = lPackageInformation.packageName;
        lJson['version'] = lPackageInformation.version;
        lJson['kg'] = lPackageInformation.workspace;
        lJson['kg']['config'] = lPackageConfiguration;

        // Create path to deno.json.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'deno.json');

        // Save packag.json.
        FileSystem.write(lPackageJsonPath, JSON.stringify(lJson, null, 4));
    }

    /**
     * Write project kg information into deno.json.
     * 
     * @param pPackageName - Name of project.
     * @param pUpdater - Update function.
     */
    public async writeCliPackageConfiguration<T>(pPackageInformation: PackageInformation, pCommand: ICliCommand<T>, pUpdater: (pConfiguration: T) => T): Promise<void> {
        // Read defaults
        let lPackageConfiguration: T = await this.readCliPackageConfiguration(pPackageInformation, pCommand);

        // Call update callback.
        lPackageConfiguration = pUpdater(lPackageConfiguration);

        // Read and parse deno.json
        const lJson: Record<string, any> = pPackageInformation.packageJson;

        // Update package json information.
        lJson['kg'] = pPackageInformation.workspace;
        lJson['kg']['config'] ??= {};
        lJson['kg']['config'][pCommand.information.configuration!.name] = lPackageConfiguration;

        // Create path to deno.json.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(pPackageInformation.directory, 'deno.json');

        // Save deno.json.
        FileSystem.write(lPackageJsonPath, JSON.stringify(lJson, null, 4));
    }

    /**
     * Find package information of name. 
     * 
     * @param pName - Package id name. Can be the package name too.
     * 
     * @returns Package information or null if not found.
     */
    private findPackageByName(pName: string): PackageInformation | null {
        // Converts package name to id name. When it is already the id name, the convert does nothing.
        const lPackageIdName: string = this.packageToIdName(pName);

        // Read all available packages and find the package with the provided id name.
        const lPackageInformation = this.readAllPackages().find(pPackage => pPackage.workspace.name === lPackageIdName);

        return lPackageInformation ?? null;
    }

    /**
     * Read complete package configuration for all available cli packages.
     * Fill in default values for all cli packages.
     * 
     * @param pPackageInformation - Package information.
     * 
     * @returns Configuration object filled with default values. 
     */
    private async readPackageConfiguration(pPackageInformation: PackageInformation): Promise<Record<string, any>> {
        // Initially empty configuration object.
        let lConfigurationObject: Record<string, any> = {};

        for (const [, lCliPackageInformation] of await this.mCliPackages.getCommandPackages()) {
            // Skip packages without configuration.
            if (!lCliPackageInformation.configuration.commandEntryClass) {
                continue;
            }

            // Create package instance and skip configuration when no config can be set.
            const lPackageInstance: ICliCommand = await this.mCliPackages.createPackageCommandInstance(lCliPackageInformation);
            if (!lPackageInstance.information.configuration) {
                continue;
            }

            // Read package information.
            const lCliPackageConfiguration: Record<string, any> | null = await this.readCliPackageConfiguration(pPackageInformation, lPackageInstance);
            if (!lCliPackageConfiguration) {
                continue;
            }

            // Merge configuration object.
            lConfigurationObject = {
                ...lConfigurationObject,
                [lCliPackageInformation.configuration.name]: lCliPackageConfiguration
            };
        }

        // Return configuration object.
        return lConfigurationObject;
    }

    /**
     * Read package informations from deno.json.
     * 
     * @param pPackageName - Package name or name id.
     */
    private readPackageInformation(pPackageJsonFile: string): PackageInformation | null {
        // Find or parse directory
        const lPackageJsonFile: string = FileSystem.pathToAbsolute(pPackageJsonFile);
        const lPackageDirectory: string = FileSystem.directoryOfFile(lPackageJsonFile);

        // Package json must exist.
        if (!FileSystem.exists(lPackageJsonFile)) {
            return null;
        }

        // Read and parse deno.json
        const lFileContent: string = FileSystem.read(lPackageJsonFile);

        let lPackageJson: any;
        try {
            // Parse json and read project information.
            lPackageJson = JSON.parse(lFileContent);
        } catch (_pError) {
            // eslint-disable-next-line no-console
            console.warn(`Error parsing ${lPackageJsonFile}`);
            return null;
        }

        // Ignore all packages where kg config is not set.
        if (typeof lPackageJson['kg'] !== 'object') {
            return null;
        }

        // Ignore root package.
        if (lPackageJson['kg']['root']) {
            return null;
        }

        // Ignore unnamed packages.
        if (typeof lPackageJson['name'] !== 'string') {
            return null;
        }

        // Read package information and fill in unset values.
        const lPackageName: string = lPackageJson['name'];
        const lPackageVersion: string = lPackageJson['version'] ?? '0.0.0';

        // Convert package name.
        const lPackageIdName: string = this.packageToIdName(lPackageName);

        return {
            packageName: lPackageName,
            idName: lPackageIdName,
            version: lPackageVersion,
            directory: lPackageDirectory,
            workspace: {
                name: lPackageIdName,
            },
            packageJson: lPackageJson
        };
    }
}

export type PackageInformation = {
    packageName: string;
    idName: string;
    version: string;
    directory: string;
    workspace: {
        name: string;
        root?: boolean,
    };
    packageJson: Record<string, any>;
};