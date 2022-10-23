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
                include: { fileNames: ['package.json'] }
            });

            for (const lFile of lAllFiles) {
                const lFileContent: string = FileUtil.read(lFile);
                const lFileJson: any = JSON.parse(lFileContent);

                const lWorkspaceConfig: Partial<ProjectInformation['workspace']> = lFileJson['kg'];

                if (lWorkspaceConfig?.root) {
                    return path.dirname(lFile);
                }
            }

            return pCurrentPath;
        })();
    }

    /**
     * Add packages as vs code workspace to workspace settings.
     * @param pWorkspaceName - Name of workspace. 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public addWorkspace(pPackageName: string, pPackageDirectory: string): void {
        // Read workspace file json.
        const lWorkspaceFilePath: string = FileUtil.findFiles(this.mRootPath, { depth: 0, include: { extensions: ['code-workspace'] } })[0];
        const lFileText = FileUtil.read(lWorkspaceFilePath);
        const lPackageJson = JSON.parse(lFileText);

        // Add new folder to folder list.
        const lWorkspaceDirectory: string = path.relative(this.projectRootDirectory, pPackageDirectory);
        const lFolderList: Array<{ name: string, path: string; }> = lPackageJson['folders'];
        lFolderList.push({
            name: pPackageName,
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
     * Get package name.
     * @param pProjectName - Package name of project name.
     */
    public convertToPackageName(pProjectName: string): string {
        const lPackageRegex: RegExp = /^@[a-zA-Z0-9]+\/[a-zA-Z0-9.-]+$/;

        // Check if name is already the package name.
        if (lPackageRegex.test(pProjectName)) {
            return pProjectName.toLowerCase();
        }

        const lPartList: Array<string> = pProjectName.split('.');

        // Try to parse name.
        let lPackageName: string = `@${lPartList[0]}/${lPartList.slice(1).join('.')}`;
        lPackageName = lPackageName.replace(/_/g, '-');
        lPackageName = lPackageName.toLowerCase();

        // Validate parsed name.
        if (!lPackageRegex.test(lPackageName)) {
            throw `Project name "${pProjectName}" cant be parsed to a package name.`;
        }

        return lPackageName;
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
     * @param pPackageName - Package name.
     */
    public packageExists(pPackageName: string): boolean {
        const lPackageDirectory: ProjectInformation | null = this.findPackageByName(pPackageName);
        return lPackageDirectory !== null;
    }

    /**
     * Read all projects of package.
     */
    public readAllProject(): Array<ProjectInformation> {
        // Search all package.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileUtil.findFiles(this.mRootPath, {
            include: { fileNames: ['package.json'] },
            exclude: { directories: ['node_modules'] }
        });

        // Create package list.
        const lPackageList: Array<ProjectInformation> = new Array<ProjectInformation>();

        // Search all files.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileUtil.read(lFile);

            try {
                // Parse json and read project information.
                const lPackageJson: any = JSON.parse(lFileContent);
                const lFilledProjectInformation: ProjectInformation = this.setProjectDefaults({
                    packageName: lPackageJson['name'],
                    version: lPackageJson['version'],
                    directory: path.dirname(lFile),
                    workspace: lPackageJson['kg']
                });

                lPackageList.push(lFilledProjectInformation);
            } catch (_pError) {
                // eslint-disable-next-line no-console
                console.warn(`Error parsing ${lFile}`);
            }
        }

        return lPackageList;
    }

    /**
     * Update project kg information.
     * @param pName - Name of project.
     * @param pConfigInformation - Project information.
     */
    public updateProjectConfiguration(pName: string, pConfigInformation: Partial<ProjectInformation>): void {
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
     * @param pProjectName - Project name. Can be a package name too.
     */
    private findPackageByName(pProjectName: string): ProjectInformation | null {
        const lPackageName: string = this.convertToPackageName(pProjectName);
        const lProjectInformation = this.readAllProject().find(pProject => pProject.packageName.toLowerCase() === lPackageName.toLowerCase());

        return lProjectInformation ?? null;
    }

    /**
     * Default all unset project informations.
     * @param pProjectInformation - Partial project information.
     */
    private setProjectDefaults(pProjectInformation: Partial<ProjectInformation>): ProjectInformation {
        let lProjectName: string | undefined = pProjectInformation.workspace?.name;
        if (!lProjectName) {
            // Try to find unique and traceable project name.

            // Find from directory.
            if (pProjectInformation.directory) {
                lProjectName = path.parse(pProjectInformation.directory).name;
            }
        }

        // Exit with error message.
        if (!lProjectName) {
            throw `Project name couldn't be found or created. At least "kg.name" must be set. \n Tried to update: ${JSON.stringify(pProjectInformation)}`;
        }

        return {
            packageName: this.convertToPackageName(lProjectName),
            version: pProjectInformation.version ?? '0.0.0',
            directory: pProjectInformation.directory ?? path.resolve(this.mRootPath, 'packages', lProjectName.toLowerCase()),
            workspace: {
                name: lProjectName,
                root: pProjectInformation.workspace?.root ?? false,
                config: {
                    blueprint: pProjectInformation.workspace?.config?.blueprint ?? 'undefined',
                    pack: pProjectInformation.workspace?.config?.pack ?? false,
                    target: pProjectInformation.workspace?.config?.target ?? 'node',
                    test: pProjectInformation.workspace?.config?.test ?? []
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