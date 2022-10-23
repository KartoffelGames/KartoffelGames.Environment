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

                if (lFileJson['kg']?.['projectRoot']) {
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
    public getPackageConfiguration(pName: string): WorkspaceConfiguration {
        // Construct paths.
        const lPackageDirectory: ProjectInformation | null = this.findPackageByName(pName);
        if (lPackageDirectory === null) {
            throw `Package "${pName}" not found.`;
        }

        return lPackageDirectory.workspaceConfiguration;
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
                const lPackageJson: any = JSON.parse(lFileContent);

                // Ony KG workspaces.
                if ('kg' in lPackageJson) {
                    // Read project config.
                    const lConfiguration: WorkspaceConfiguration = lPackageJson['kg'];

                    // Create configuration default.
                    const lDefaultConfiguration: WorkspaceConfiguration = {
                        projectRoot: lConfiguration.projectRoot ?? false,
                        config: {
                            blueprint: lConfiguration.config?.blueprint ?? 'undefined',
                            pack: lConfiguration.config?.pack ?? false,
                            target: lConfiguration.config?.target ?? 'node',
                            test: lConfiguration.config?.test ?? []
                        }
                    };

                    lPackageList.push({
                        packageName: lPackageJson['name'] ?? 'UNSET',
                        projectName: lPackageJson['projectName'] ?? 'UNSET',
                        version: lPackageJson['version'] ?? 'UNSET',
                        directory: path.dirname(lFile),
                        workspaceConfiguration: lDefaultConfiguration
                    });
                }
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
     * @param pConfig - Project kg information.
     */
    public updateProjectConfiguration(pName: string, pConfig: WorkspaceConfiguration): void {
        // Construct paths.
        const lPackageInformation: ProjectInformation | null = this.findPackageByName(pName);
        if (lPackageInformation === null) {
            throw `Package "${pName}" not found.`;
        }

        // Read and parse package.json
        const lPackageJsonPath: string = path.resolve(lPackageInformation.directory, 'package.json');
        const lFile: string = FileUtil.read(lPackageJsonPath);
        const lJson: any = JSON.parse(lFile);

        // Read project config.
        lJson['kg'] = pConfig;

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
}

export type ProjectInformation = {
    packageName: string;
    projectName: string;
    version: string;
    directory: string;
    workspaceConfiguration: WorkspaceConfiguration;
};

export type WorkspaceConfiguration = {
    projectRoot?: boolean,
    config?: {
        blueprint?: string;
        pack?: boolean;
        target?: 'web' | 'node';
        test?: Array<TestMode>;
    };
};

export type TestMode = 'unit' | 'integration' | 'ui';