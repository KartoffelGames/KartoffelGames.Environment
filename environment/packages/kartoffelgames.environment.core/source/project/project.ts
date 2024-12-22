import { CliPackageInformation, CliPackages } from '../cli/cli-packages';
import { ICliCommand } from '../cli/i-cli-command.interface';
import { FileSystem } from '../system/file-system';

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
                fileNames: ['package'],
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
        const lWorkspaceFilePath: string = FileSystem.findFiles(this.projectRootDirectory, { depth: 0, include: { extensions: ['code-workspace'] } })[0];
        const lFileText = FileSystem.read(lWorkspaceFilePath);
        const lPackageJson = JSON.parse(lFileText);

        // Add new folder to folder list.Y
        const lWorkspaceDirectory: string = FileSystem.pathToRelative(this.projectRootDirectory, pPackageDirectory);
        const lFolderList: Array<{ name: string, path: string; }> = lPackageJson['folders'];
        lFolderList.push({
            name: this.packageToIdName(pPackageName),
            path: lWorkspaceDirectory
        });

        // Sort folder alphabeticaly.
        lFolderList.sort((pFirst, pSecond) => {
            if (pFirst.name < pSecond.name) { return -1; }
            if (pFirst.name > pSecond.name) { return 1; }
            return 0;
        });

        // Update workspace file.
        const lPackageJsonText = JSON.stringify(lPackageJson, null, 4);
        FileSystem.write(lWorkspaceFilePath, lPackageJsonText);
    }

    /**
     * Read project configuration.
     * @param pName - Project name.
     */
    public getPackageInformation(pName: string): PackageInformation {
        // Construct paths.
        const lPackageDirectory: PackageInformation | null = this.findPackageByName(pName);
        if (lPackageDirectory === null) {
            throw `Package "${pName}" not found.`;
        }

        return lPackageDirectory;
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
        let lConvertedPackageName: string = pPackageName;

        // Empty packae name.
        if (!lConvertedPackageName) {
            return '';
        }

        // Replace '/' with '.'.
        lConvertedPackageName = lConvertedPackageName.replaceAll('/', '.');

        // Replace every symbol with ''
        lConvertedPackageName = lConvertedPackageName.replaceAll(/[^\w.-]/g, '');

        // Replace '-' with '_'.
        lConvertedPackageName = lConvertedPackageName.replaceAll('-', '_');

        // Lowercase everything.
        lConvertedPackageName = lConvertedPackageName.toLowerCase();

        // Upercase every starting word.
        // Split '.' and join again with '.' but uppercase every parts starting character.
        // Slice wrong added starting '.' after joining with reduce.
        lConvertedPackageName = lConvertedPackageName.split('.').reduce((pCurrentValue: string, pNextValue: string) => {
            return `${pCurrentValue}.${pNextValue.charAt(0).toUpperCase() + pNextValue.slice(1)}`;
        }, '').slice(1);

        // Uppercase every starting word.
        // Split '_' and join again with '_' but uppercase every parts starting character.
        // Slice wrong added starting '_' after joining with reduce.
        lConvertedPackageName = lConvertedPackageName.split('_').reduce((pCurrentValue: string, pNextValue: string) => {
            return `${pCurrentValue}_${pNextValue.charAt(0).toUpperCase() + pNextValue.slice(1)}`;
        }, '').slice(1);

        return lConvertedPackageName;
    }

    /**
     * Read all projects of package.
     */
    public readAllProject(): Array<PackageInformation> {
        // Search all package.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileSystem.findFiles(this.projectRootDirectory, {
            depth: 2, // ./packages/{package_name}/Package.json
            include: {
                fileNames: ['package'],
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
     * Update project kg information in package.json.
     * 
     * @param pPackageName - Name of project.
     */
    public updatePackageConfiguration(pPackageName: string): void {
        // Construct paths.
        const lPackageInformation: PackageInformation | null = this.findPackageByName(pPackageName);
        if (lPackageInformation === null) {
            throw `Package "${pPackageName}" not found.`;
        }

        // Read and parse package.json
        const lJson: Record<string, any> = lPackageInformation.packageJson;

        // Read package config.
        lJson['name'] = lPackageInformation.packageName;
        lJson['version'] = lPackageInformation.version;
        lJson['kg'] = lPackageInformation.workspace;

        // Read package cli configuration.
        lJson['kg']['configuration'] = this.readPackageConfiguration(lPackageInformation);

        // Create path to package.json.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'package.json');

        // Save packag.json.
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
        const lPackageInformation = this.readAllProject().find(pPackage => pPackage.workspace.name === lPackageIdName);

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
            const lCliPackageConfiguration: Record<string, any> | null = this.readPackageConfigurationForCliPackage(pPackageInformation, lCliPackageInformation);
            if (!lCliPackageConfiguration) {
                continue;
            }

            // Merge configuration object.
            lConfigurationObject = {
                ...lConfigurationObject,
                ...lCliPackageConfiguration
            };
        }

        // Return configuration object.
        return lConfigurationObject;
    }

    /**
     * Read package configuration for a single cli package.
     * The configuration object is nested with the set cli configuration key.
     * 
     * @param pPackageInformation - Package information.
     * @param pCliPackageInformation - Cli package information.
     * 
     * @returns - Configuration object filled with default values or null if no configuration is setable. 
     */
    private async readPackageConfigurationForCliPackage(pPackageInformation: PackageInformation, pCliPackageInformation: CliPackageInformation): Promise<Record<string, any> | null> {
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
        const lPackageInstance: ICliCommand = await this.mCliPackages.createPackageInstance(pCliPackageInformation);
        if (!lPackageInstance.information.configuration) {
            return null;
        }

        // Read configuration key.
        const lPackageConfigurationKey: string | undefined = lPackageInstance.information.configuration.name;

        // Read current available configuration of package.
        const lCurrentConfiguration: Record<string, any> = pPackageInformation.packageJson['kg']?.['config']?.[lPackageConfigurationKey] ?? {};

        // Fill in and return default values.
        return {
            [lPackageConfigurationKey]: lFillDefaults(lCurrentConfiguration, lPackageInstance.information.configuration!.default)
        };
    }

    /**
     * Read package informations from package.json.
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

        // Read and parse package.json
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
            version: lPackageVersion,
            directory: lPackageDirectory,
            workspace: {
                name: lPackageIdName,
                root: false
            },
            packageJson: lPackageJson
        };
    }
}

export type PackageInformation = {
    packageName: string;
    version: string;
    directory: string;
    workspace: {
        name: string;
        root: boolean,
    };
    packageJson: Record<string, any>;
};