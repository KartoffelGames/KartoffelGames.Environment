import * as path from 'path';
import { FileUtil } from './file-util';

export class Workspace {
    private readonly mCliRootPath: string;
    private readonly mRootPath: string;

    /**
     * Get root paths.
     */
    public get paths(): RootPaths {
        const lVsWorkspaceFiles: Array<string> = FileUtil.findFileExtension(this.mRootPath, '.code-workspace');

        return {
            root: this.mRootPath,
            file: {
                vsWorkspace: lVsWorkspaceFiles[0]
            },
            packages: path.resolve(this.mRootPath, 'packages'),
            cli: {
                root: this.mCliRootPath,
                enviroment: {
                    packageBlueprints: path.resolve(this.mCliRootPath, 'enviroment', 'package_blueprints'),
                    projectBlueprints: path.resolve(this.mCliRootPath, 'enviroment', 'project_blueprints'),
                    commandBlueprints: {
                        scratchpad: path.resolve(this.mCliRootPath, 'enviroment', 'command_blueprints', 'scratchpad')
                    }
                },
                files: {
                    webpackConfig: path.resolve(this.mCliRootPath, 'enviroment', 'configuration', 'webpack.config.js'),
                    mochaConfig: path.resolve(this.mCliRootPath, 'enviroment', 'configuration', 'mocha.config.js'),
                    nycConfig: path.resolve(this.mCliRootPath, 'enviroment', 'configuration', 'nyc.config.json')
                }
            }
        };
    }

    /**
     * Constructor.
     * @param pCurrentPath - Project root path.
     */
    public constructor(pCurrentPath: string, pCliRootPath: string) {
        this.mRootPath = this.findWorkspaceRootPath(pCurrentPath);
        this.mCliRootPath = path.resolve(pCliRootPath);
    }

    /**
     * Add packages as vs code workspace to workspace settings.
     * @param pWorkspaceName - Name of workspace. 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public createVsWorkspace(pWorkspaceName: string): void {
        const lWorkspaceFilePath: string = this.paths.file.vsWorkspace;
        const lWorkspaceFolder: string = pWorkspaceName.toLowerCase();

        // Read workspace file json.
        const lFileText = FileUtil.read(lWorkspaceFilePath);
        const lPackageJson = JSON.parse(lFileText);

        // Add new folder to folder list.
        const lFolderList: Array<{ name: string, path: string; }> = lPackageJson['folders'];
        lFolderList.push({
            name: pWorkspaceName,
            path: `./packages/${lWorkspaceFolder}`
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
     * @param pName - Package name of project name.
     */
    public getPackageName(pName: string): string {
        const lPackageRegex: RegExp = /^@[a-zA-Z0-9]+\/[a-zA-Z0-9.-]+$/;

        // Check if name is already the package name.
        if (lPackageRegex.test(pName)) {
            return pName.toLowerCase();
        }

        const lPartList: Array<string> = pName.split('.');

        // Try to parse name.
        let lPackageName: string = `@${lPartList[0]}/${lPartList.slice(1).join('.')}`;
        lPackageName = lPackageName.replace(/_/g, '-');
        lPackageName = lPackageName.toLowerCase();

        // Validate parsed name.
        if (!lPackageRegex.test(lPackageName)) {
            throw `Project name "${pName}" cant be parsed to a package name.`;
        }

        return lPackageName;
    }

    /**
     * Read project configuration.
     * @param pName - Project name.
     */
    public getProjectConfiguration(pName: string): WorkspaceConfiguration {
        // Construct paths.
        const lPaths: ProjectPaths = this.pathsOf(pName);

        // Read and parse package.json
        const lFile: string = FileUtil.read(lPaths.project.file.packageJson);
        const lJson: any = JSON.parse(lFile);

        // Read project config.
        const lConfiguration: WorkspaceConfiguration = lJson['kg'];

        // Fill config defaults.
        return {
            config: {
                blueprint: lConfiguration?.config?.blueprint ?? '',
                pack: lConfiguration?.config?.pack ?? false
            }
        };
    }

    /**
     * Get all available paths of workspace.
     * @param pPackageName - Package name.
     */
    public pathsOf(pPackageName: string): ProjectPaths {
        const lProjectDirectory: string = this.getProjectDirectory(pPackageName);

        return {
            project: {
                root: lProjectDirectory,
                library: {
                    root: path.resolve(lProjectDirectory, 'library'),
                    source: path.resolve(lProjectDirectory, 'library', 'source')
                },
                source: path.resolve(lProjectDirectory, 'source'),
                scratchpad: path.resolve(lProjectDirectory, 'scratchpad'),
                file: {
                    packageJson: path.resolve(lProjectDirectory, 'package.json')
                }
            },
        };
    }

    /**
     * Check if package exists.
     * @param pPackageName - Package name.
     */
    public projectExists(pPackageName: string): boolean {
        const lPackageName: string = this.getPackageName(pPackageName);

        // Get all package.json files.
        const lPackageFileList = FileUtil.findFiles(this.paths.packages, 'package.json', 1);

        // Read files and convert json.
        for (const lPackageFile of lPackageFileList) {
            const lFileText = FileUtil.read(lPackageFile);
            const lFileJson = JSON.parse(lFileText);

            // Check dublicate project name and package name.
            if (lFileJson['name'].toLowerCase() === lPackageName.toLowerCase()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Update project kg information.
     * @param pName - Name of project.
     * @param pConfig - Project kg information.
     */
    public updateProjectConfiguration(pName: string, pConfig: WorkspaceConfiguration): void {
        const lProjectPaths = this.pathsOf(pName);

        // Update package.json custom settings.
        const lPackageJsonContent: string = FileUtil.read(lProjectPaths.project.file.packageJson);
        const lPackageJsonJson: any = JSON.parse(lPackageJsonContent);

        // Set config.
        lPackageJsonJson['kg'] = pConfig;

        // Save packag.json.
        FileUtil.write(lProjectPaths.project.file.packageJson, JSON.stringify(lPackageJsonJson, null, 4));
    }

    /**
     * Find workspace root path.
     * @param pCurrentPath - Current path.
     */
    private findWorkspaceRootPath(pCurrentPath: string): string {
        const lAllFiles: Array<string> = FileUtil.findFilesReverse(pCurrentPath, 'package.json');

        for (const lFile of lAllFiles) {
            const lFileContent: string = FileUtil.read(lFile);
            const lFileJson: any = JSON.parse(lFileContent);

            if (lFileJson['kg.root'] || lFileJson['kg']?.['root']) {
                return path.dirname(lFile);
            }
        }

        return pCurrentPath;
    }

    /**
     * Get project directory.
     * @param pName - Package name.
     */
    private getProjectDirectory(pName: string): string {
        const lPackageName: string = this.getPackageName(pName);

        // Get all package.json files.
        const lPackageFileList = FileUtil.findFiles(this.paths.packages, 'package.json', 1);

        // Read files and convert json.
        for (const lPackageFile of lPackageFileList) {
            const lFileText = FileUtil.read(lPackageFile);
            const lFileJson = JSON.parse(lFileText);

            // Check dublicate project name and package name.
            if (lFileJson['name'].toLowerCase() === lPackageName.toLowerCase()) {
                return path.dirname(lPackageFile);
            }
        }

        throw 'Package does not exist.';
    }
}

export type WorkspaceConfiguration = {
    config: {
        blueprint: string;
        pack: boolean;
    };
};

export type ProjectPaths = {
    project: {
        root: string;
        library: {
            root: string;
            source: string;
        };
        source: string;
        scratchpad: string;
        file: {
            packageJson: string;
        };
    };
};

export type RootPaths = {
    root: string;
    file: {
        vsWorkspace: string;
    },
    packages: string;
    cli: {
        root: string;
        enviroment: {
            packageBlueprints: string;
            projectBlueprints: string;
            commandBlueprints: {
                scratchpad: string;
            };
        };
        files: {
            webpackConfig: string;
            mochaConfig: string;
            nycConfig: string;
        };
    };
};