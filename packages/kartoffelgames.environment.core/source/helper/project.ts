import * as path from 'path';
import { FileUtil } from './file-util';

export class Project {
    private readonly mRootPath: string;

    /**
     * Project root path.
     */
    public get projectRootDirectory(): string {
        return this.mRootPath;
    }

    /**
     * Constructor.
     * @param pCurrentPath - Project root path.
     */
    public constructor(pCurrentPath: string) {
        this.mRootPath = (() => {
            const lAllFiles: Array<string> = FileUtil.findFiles(pCurrentPath, {
                direction: 'insideOut',
                include: { extensions: ['code-workspace'] }
            });

            // Find longest directory.
            let lLongestDirectoryName: string = '';
            for (const lFile of lAllFiles) {
                const lDirectoryName: string = path.dirname(lFile);
                if (lDirectoryName.length > lLongestDirectoryName.length) {
                    lLongestDirectoryName = lDirectoryName;
                }
            }

            // Return current directory if no root was found.
            if (lLongestDirectoryName.length !== null) {
                return lLongestDirectoryName;
            } else {
                return pCurrentPath;
            }
        })();
    }

    /**
     * Add packages as vs code workspace to workspace settings.
     * @param pWorkspaceName - Name of workspace. 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public addWorkspace(pPackageName: string, pPackageDirectory: string): void {
        // Read workspace file json.
        const lWorkspaceFilePath: string = FileUtil.findFiles(this.projectRootDirectory, { depth: 0, include: { extensions: ['code-workspace'] } })[0];
        const lFileText = FileUtil.read(lWorkspaceFilePath);
        const lPackageJson = JSON.parse(lFileText);

        // Add new folder to folder list.
        const lWorkspaceDirectory: string = path.relative(this.projectRootDirectory, pPackageDirectory);
        const lFolderList: Array<{ name: string, path: string; }> = lPackageJson['folders'];
        lFolderList.push({
            name: this.convertToProjectName(pPackageName),
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
        FileUtil.write(lWorkspaceFilePath, lPackageJsonText);
    }

    /**
     * Convert package name to project name.
     * @param pPackageName - Package name.
     */
    public convertToProjectName(pPackageName: string): string {
        let lConvertedPackageName: string = pPackageName;

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

        // Upercase every starting word.
        // Split '_' and join again with '_' but uppercase every parts starting character.
        // Slice wrong added starting '_' after joining with reduce.
        lConvertedPackageName = lConvertedPackageName.split('_').reduce((pCurrentValue: string, pNextValue: string) => {
            return `${pCurrentValue}_${pNextValue.charAt(0).toUpperCase() + pNextValue.slice(1)}`;
        }, '').slice(1);

        return lConvertedPackageName;
    }

    /**
     * Read project configuration.
     * @param pName - Project name.
     */
    public getPackageConfiguration(pName: string): ProjectInformation {
        // Construct paths.
        const lPackageDirectory: ProjectInformation | null = this.findPackageByName(pName);
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
        const lPackageDirectory: ProjectInformation | null = this.findPackageByName(pName);
        return lPackageDirectory !== null;
    }

    /**
     * Read all projects of package.
     */
    public readAllProject(): Array<ProjectInformation> {
        // Search all package.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileUtil.findFiles(this.projectRootDirectory, {
            include: { fileNames: ['package.json'] },
            exclude: { directories: ['node_modules'] }
        });

        // Create package list.
        const lPackageList: Array<ProjectInformation> = new Array<ProjectInformation>();

        // Search all files.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileUtil.read(lFile);

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

            const lFilledProjectInformation: ProjectInformation = this.setProjectDefaults({
                packageName: lPackageJson['name'],
                version: lPackageJson['version'],
                directory: path.dirname(lFile),
                workspace: lPackageJson['kg']
            });

            lPackageList.push(lFilledProjectInformation);
        }

        return lPackageList;
    }

    /**
     * Update project kg information.
     * @param pName - Name of project.
     * @param pConfigInformation - Project information.
     */
    public updateProjectConfiguration(pName: string, pConfigInformation: DeepPartial<ProjectInformation>): void {
        // Construct paths.
        const lPackageInformation: ProjectInformation | null = this.findPackageByName(pName);
        if (lPackageInformation === null) {
            throw `Package "${pName}" not found.`;
        }

        // Read and parse package.json
        const lPackageJsonPath: string = path.resolve(lPackageInformation.directory, 'package.json');
        const lFile: string = FileUtil.read(lPackageJsonPath);
        const lJson: any = JSON.parse(lFile);

        // Fill in unset project settings.
        const lFilledProjectInformation: Partial<ProjectInformation> = this.setProjectDefaults(pConfigInformation);

        // Read project config.
        lJson['name'] = lFilledProjectInformation.packageName;
        lJson['version'] = lFilledProjectInformation.version;
        lJson['kg'] = lFilledProjectInformation.workspace;

        // Save packag.json.
        FileUtil.write(lPackageJsonPath, JSON.stringify(lJson, null, 4));
    }

    /**
     * Find root path to project name. 
     * @param pName - Project name. Can be a package name too.
     */
    private findPackageByName(pName: string): ProjectInformation | null {
        const lProjectName: string = this.convertToProjectName(pName);
        const lProjectInformation = this.readAllProject().find(pProject => pProject.workspace.name === lProjectName);

        return lProjectInformation ?? null;
    }

    /**
     * Default all unset project informations.
     * @param pProjectInformation - Partial project information.
     */
    private setProjectDefaults(pProjectInformation: DeepPartial<ProjectInformation>): ProjectInformation {
        const lPackageName: string | null = pProjectInformation.packageName ?? null;
        // Exit with error message.
        if (!lPackageName) {
            throw `Package name couldn't be found. At least "name" must be set to package.json. \n Tried to update: ${JSON.stringify(pProjectInformation)}`;
        }

        // Convert package name.
        const lProjectName: string = this.convertToProjectName(lPackageName);

        // Find or parse directory
        const lProjectDirectory: string = pProjectInformation.directory ?? path.resolve(this.projectRootDirectory, 'packages', lPackageName.toLowerCase());

        return {
            packageName: lPackageName,
            version: pProjectInformation.version ?? '0.0.0',
            directory: lProjectDirectory,
            workspace: {
                name: lProjectName,
                root: lProjectDirectory === this.projectRootDirectory,
                config: {
                    blueprint: pProjectInformation.workspace?.config?.blueprint ?? 'undefined',
                    pack: pProjectInformation.workspace?.config?.pack ?? false,
                    target: pProjectInformation.workspace?.config?.target ?? 'node',
                    test: (<Array<TestMode>>pProjectInformation.workspace?.config?.test) ?? []
                }
            }
        };
    }
}

export type ProjectInformation = {
    packageName: string;
    version: string;
    directory: string;
    workspace: {
        name: string;
        root: boolean,
        config: {
            blueprint: string;
            pack: boolean;
            target: 'web' | 'node';
            test: Array<TestMode>;
        };
    };
};

export type TestMode = 'unit' | 'integration' | 'ui';

type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;