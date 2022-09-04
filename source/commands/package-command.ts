// Load dependencies.
import * as path from 'path';
import { Console } from '../helper/console.js';
import { FileUtil } from '../helper/file-util.js';
import { Workspace } from '../helper/workspace.js';

export class PackageCommand {
    private readonly mWorkspace: Workspace;

    /**
     * Constructor.
     * @param pCliRootPath - Cli project root.
     * @param pCurrentPath - Current execution path.
     */
    public constructor(pWorkspace: Workspace) {
        this.mWorkspace = pWorkspace;
    }

    /**
     * Create package based on blueprint.
     * @param pBlueprintType - Blueprint type.
     */
    public async create(pBlueprintType: string): Promise<void> {
        const lConsole = new Console();
        const lBlueprintPath = path.resolve(this.mWorkspace.paths.cli.enviroment.packageBlueprints, pBlueprintType.toLowerCase());

        // Output heading.
        lConsole.writeLine('Create Package');

        // Check correct blueprint.
        if (!FileUtil.exists(lBlueprintPath)) {
            throw `Blueprint "${pBlueprintType}" does not exist.`;
        }

        // Needed questions.
        const lProjectName = await lConsole.promt('Package Name: ', /^[a-zA-Z]+\.[a-zA-Z_.]+$/);
        const lPackageName = this.mWorkspace.getPackageName(lProjectName);
        const lProjectFolder = lProjectName.toLowerCase();

        // Create new package path. 
        const lPackagePath = path.resolve(this.mWorkspace.paths.packages, lProjectFolder);

        // Get all package.json files.
        if (this.mWorkspace.projectExists(lPackageName)) {
            throw 'Package already exists.';
        }

        lConsole.writeLine('');
        lConsole.writeLine('Create package...');

        // Check if project directory already exists.
        if (FileUtil.exists(lPackagePath)) {
            throw 'Project directory already exists.';
        } else {
            // Create package folder.
            FileUtil.createDirectory(lPackagePath);
        }

        // Copy all files from blueprint folder.
        const lReplacementMap: Map<RegExp, string> = new Map<RegExp, string>();
        lReplacementMap.set(/{{PROJECT_NAME}}/g, lProjectName);
        lReplacementMap.set(/{{PACKAGE_NAME}}/g, lPackageName);
        lReplacementMap.set(/{{PROJECT_FOLDER}}/g, lProjectFolder);
        FileUtil.copyDirectory(lBlueprintPath, lPackagePath, false, lReplacementMap, []);

        // Add package to workspace.
        this.mWorkspace.createVsWorkspace(lProjectName);

        // Read configuration, add blueprint type and save configuration.
        const lWorkspaceConfiguration = this.mWorkspace.getProjectConfiguration(lProjectName);
        lWorkspaceConfiguration.config.blueprint = pBlueprintType.toLowerCase();
        this.mWorkspace.updateProjectConfiguration(lProjectName, lWorkspaceConfiguration);

        // Display init information.
        lConsole.writeLine('Project successfull created.');
        lConsole.writeLine(`Call "npm install" to initialize this project`);
    }

    /**
     * Initialize project based on blueprint.
     * @param pBlueprintType - Blueprint type.
     */
    public async init(pBlueprintType: string, pWorkingDirectory: string): Promise<void> {
        const lConsole = new Console();
        const lBlueprintPath = path.resolve(this.mWorkspace.paths.cli.enviroment.projectBlueprints, pBlueprintType.toLowerCase());
        const lWorkingDirectory: string = path.resolve(pWorkingDirectory);

        // Output heading.
        lConsole.writeLine('Initialize');

        // Check correct blueprint.
        if (!FileUtil.exists(lBlueprintPath)) {
            throw `Blueprint "${pBlueprintType}" does not exist.`;
        }

        // Needed questions.
        const lProjectName = await lConsole.promt('Project Name: ', /^[a-zA-Z0-9-_]+$/);

        lConsole.writeLine('');
        lConsole.writeLine('Create project...');

        // Copy all files from blueprint folder.
        const lReplacementMap: Map<RegExp, string> = new Map<RegExp, string>();
        lReplacementMap.set(/{{PROJECT_NAME}}/g, lProjectName);
        FileUtil.copyDirectory(lBlueprintPath, lWorkingDirectory, false, lReplacementMap, []);

        // Display init information.
        lConsole.writeLine('Project successfull created.');
        lConsole.writeLine(`Call "npm install" to initialize this project`);
    }

    /**
     * Sync all local dependency verions.
     */
    public async sync(): Promise<void> {
        const lConsole = new Console();

        // Output heading.
        lConsole.writeLine('Sync package version numbers...');

        // Get all package.json files.
        const lPackageFileList = FileUtil.findFiles(this.mWorkspace.paths.packages, 'package.json', 1);

        // Map each package.json with its path.
        const lPackageInformations: Map<string, PackageChangeInformation> = new Map<string, PackageChangeInformation>();
        for (const lPackageFilePath of lPackageFileList) {
            const lFileText = FileUtil.read(lPackageFilePath);
            const lPackageJson = JSON.parse(lFileText);

            // Map package information.
            lPackageInformations.set(lPackageJson['name'], {
                name: lPackageJson['name'],
                path: path.dirname(lPackageFilePath),
                json: lPackageJson,
                changed: false
            });
        }

        // Replace local dependencies.
        for (const lPackageInformation of lPackageInformations.values()) {
            const lCurrentPackageJson = lPackageInformation.json;

            // Sync Devlopment and productive dependencies.
            const lDependencyTypeList = ['devDependencies', 'dependencies'];
            for (const lDependencyType of lDependencyTypeList) {
                // Check if package.json has dependency property.
                if (lDependencyType in lCurrentPackageJson) {
                    for (const lDependencyName in lCurrentPackageJson[lDependencyType]) {
                        // On local package exists.
                        if (lPackageInformations.has(lDependencyName)) {
                            const lOldDependency = lCurrentPackageJson[lDependencyType][lDependencyName];
                            const lNewDependency = `^${(<PackageChangeInformation>lPackageInformations.get(lDependencyName)).json['version']}`;

                            // Check for possible changes before applying.
                            if (lNewDependency !== null && lNewDependency !== lOldDependency) {
                                lCurrentPackageJson[lDependencyType][lDependencyName] = lNewDependency;
                                lPackageInformation.changed = true;
                            }
                        }
                    }
                }
            }
        }

        // Replace json files with altered jsons.
        for (const lPackageInformation of lPackageInformations.values()) {
            if (lPackageInformation.changed) {
                const lPackageJsonText = JSON.stringify(lPackageInformation.json, null, 4);
                const lPackageFilePath = path.resolve(lPackageInformation.path, 'package.json');

                // Write altered data to package.json.
                FileUtil.write(lPackageFilePath, lPackageJsonText);
            }
        }

        lConsole.writeLine('Sync completed');
    }
}

type PackageChangeInformation = {
    name: string;
    path: string;
    json: any;
    changed: boolean;
};