import { FileSystem } from './file-system';

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

    private readonly mDefaultConfiguration: Record<string, any>;
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
    public constructor(pCurrentPath: string, pDefaultConfiguration: Record<string, any>) {
        this.mDefaultConfiguration = pDefaultConfiguration;
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
    public getPackageConfiguration(pName: string): PackageInformation {
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
            include: { fileNames: ['package.json'] },
            exclude: { directories: ['node_modules'] }
        });

        // Create package list.
        const lPackageList: Array<PackageInformation> = new Array<PackageInformation>();

        // Search all files.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileSystem.read(lFile);

            let lPackageJson: any;
            try {
                // Parse json and read project information.
                lPackageJson = JSON.parse(lFileContent);
            } catch (_pError) {
                // eslint-disable-next-line no-console
                console.warn(`Error parsing ${lFile}`);
                continue;
            }

            // Ignore unnamed packages.
            if (typeof lPackageJson['name'] !== 'string') {
                continue;
            }

            // Ignore all packages where kg config is not set.
            if (typeof lPackageJson['kg'] !== 'object') {
                continue;
            }

            // Ignore root package.
            if (lPackageJson['kg']['root']) {
                continue;
            }

            // Read package information and fill in unset config values.
            const lFilledPackageInformation: PackageInformation = this.setPackageDefaults({
                packageName: lPackageJson['name'],
                version: lPackageJson['version'],
                directory: FileSystem.directoryOfFile(lFile),
                workspace: lPackageJson['kg']
            });

            lPackageList.push(lFilledPackageInformation);
        }

        return lPackageList;
    }

    /**
     * Update project kg information.
     * @param pName - Name of project.
     * @param pConfigInformation - Project information.
     */
    public updateProjectConfiguration(pName: string, pConfigInformation: DeepPartial<PackageInformation>): void {
        // Construct paths.
        const lPackageInformation: PackageInformation | null = this.findPackageByName(pName);
        if (lPackageInformation === null) {
            throw `Package "${pName}" not found.`;
        }

        // Read and parse package.json
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'package.json');
        const lFile: string = FileSystem.read(lPackageJsonPath);
        const lJson: any = JSON.parse(lFile);

        // Set al least name.
        pConfigInformation.packageName = lPackageInformation.packageName;

        // Fill in unset project settings.
        const lFilledProjectInformation: Partial<PackageInformation> = this.setPackageDefaults(pConfigInformation);

        // Read project config.
        lJson['name'] = lFilledProjectInformation.packageName;
        lJson['version'] = lFilledProjectInformation.version;
        lJson['kg'] = lFilledProjectInformation.workspace;

        // Save packag.json.
        FileSystem.write(lPackageJsonPath, JSON.stringify(lJson, null, 4));
    }

    /**
     * Find package information of name. 
     * 
     * @param pName - Package id name. Can be the package name too.
     * 
     * @returns - Package information or null if not found.
     */
    private findPackageByName(pName: string): PackageInformation | null {
        // Converts package name to id name. When it is already the id name, the convert does nothing.
        const lPackageIdName: string = this.packageToIdName(pName);

        // Read all available packages and find the package with the provided id name.
        const lPackageInformation = this.readAllProject().find(pPackage => pPackage.workspace.name === lPackageIdName);

        return lPackageInformation ?? null;
    }

    /**
     * Default all unset project informations.
     * @param pPackageInformation - Partial project information.
     */
    private setPackageDefaults(pPackageInformation: DeepPartial<PackageInformation>): PackageInformation {
        const lPackageName: string | null = pPackageInformation.packageName ?? null;
        // Exit with error message.
        if (!lPackageName) {
            throw `Package name couldn't be found. At least "name" must be set to package.json. \n Tried to update: ${JSON.stringify(pPackageInformation)}`;
        }

        // Convert package name.
        const lPackageIdName: string = this.packageToIdName(lPackageName);

        // Find or parse directory
        const lProjectDirectory: string = pPackageInformation.directory ?? FileSystem.pathToAbsolute(this.projectRootDirectory, 'packages', lPackageName.toLowerCase());

        const lIsObject = (pValue: any) => {
            return typeof pValue === 'object' && pValue !== null;
        };

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

        return {
            packageName: lPackageName,
            version: pPackageInformation.version ?? '0.0.0',
            directory: lProjectDirectory,
            workspace: {
                name: lPackageIdName,
                root: lProjectDirectory === this.projectRootDirectory,
                config: lFillDefaults(pPackageInformation.workspace?.config ?? {}, this.mDefaultConfiguration)
            }
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
        config: Record<string, any>;
    };
};

type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;