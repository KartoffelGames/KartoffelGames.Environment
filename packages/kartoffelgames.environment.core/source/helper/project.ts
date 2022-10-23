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
        this.mRootPath = this.findWorkspaceRootPath(pCurrentPath);
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
        const lPackageDirectory: string | null = this.findPackageDirectoryByName(pName);
        if (lPackageDirectory === null) {
            throw `Package "${pName}" not found.`;
        }

        // Read and parse package.json
        const lFile: string = FileUtil.read(path.resolve(lPackageDirectory, 'package.json'));
        const lJson: any = JSON.parse(lFile);

        // Read project config.
        const lConfiguration: WorkspaceConfiguration = lJson['kg'];

        // Create configuration default.
        const lDefaultConfiguration: WorkspaceConfiguration = {
            projectRoot: false,
            config: {
                blueprint: 'undefined',
                pack: false,
                target: 'node',
                test: []
            }
        };

        // Fill config defaults.
        return {
            projectRoot: lConfiguration.projectRoot ?? lDefaultConfiguration.projectRoot,
            config: {
                blueprint: lConfiguration.config.blueprint ?? lDefaultConfiguration.config.blueprint,
                pack: lConfiguration.config.pack ?? lDefaultConfiguration.config.pack,
                target: lConfiguration.config.target ?? lDefaultConfiguration.config.target,
                test: lConfiguration.config.test ?? lDefaultConfiguration.config.test
            }
        };
    }

    /**
     * Check if package exists.
     * @param pPackageName - Package name.
     */
    public packageExists(pPackageName: string): boolean {
        const lPackageDirectory: string | null = this.findPackageDirectoryByName(pPackageName);
        return lPackageDirectory !== null;
    }

    /**
     * Update project kg information.
     * @param pName - Name of project.
     * @param pConfig - Project kg information.
     */
    public updateProjectConfiguration(pName: string, pConfig: WorkspaceConfiguration): void {
        // Construct paths.
        const lPackageDirectory: string | null = this.findPackageDirectoryByName(pName);
        if (lPackageDirectory === null) {
            throw `Package "${pName}" not found.`;
        }

        // Read and parse package.json
        const lPackageJsonPath: string = path.resolve(lPackageDirectory, 'package.json');
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
    private findPackageDirectoryByName(pProjectName: string): string | null {
        const lPackageName: string = this.convertToPackageName(pProjectName);

        // Search all package.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileUtil.findFiles(this.mRootPath, {
            include: { fileNames: ['package.json'] },
            exclude: { directories: ['node_modules'] }
        });

        // Search all files.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileUtil.read(lFile);

            try {
                const lFileJson: any = JSON.parse(lFileContent);

                // Check for package name.
                if (lFileJson['name'] === lPackageName) {
                    return path.dirname(lFile);
                }
            } catch (_pError) {
                throw `JSON Error in ${lFile}`;
            }
        }

        return null;
    }

    /**
     * Find workspace root path.
     * @param pCurrentPath - Current path.
     */
    private findWorkspaceRootPath(pCurrentPath: string): string {
        const lAllFiles: Array<string> = FileUtil.findFiles(pCurrentPath, {
            direction: 'insideOut',
            include: { fileNames: ['package.json'] }
        });

        for (const lFile of lAllFiles) {
            const lFileContent: string = FileUtil.read(lFile);
            const lFileJson: any = JSON.parse(lFileContent);

            if (lFileJson['kg']?.['root']) {
                return path.dirname(lFile);
            }
        }

        return pCurrentPath;
    }
}

export type WorkspaceConfiguration = {
    projectRoot: boolean,
    config: {
        blueprint: string;
        pack: boolean;
        target: 'web' | 'node';
        test: Array<TestMode>;
    };
};

export type TestMode = 'unit' | 'integration' | 'ui';