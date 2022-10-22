import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil } from '@kartoffelgames/environment.core';
import * as path from 'path';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            description: 'Create new package.',
            commandPattern: 'create <blueprint_name>'
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pCliPackages - All cli packages grouped by type.
     */
    public async run(pParameter: CliParameter, _pCliPackages: Record<string, Array<string>>): Promise<void> {
        // Read required parameter.
        const lBlueprintType: string = <string>pParameter.parameter.get('blueprint_name');

        // TODO: Read all KG_Cli_Blueprint packages informations.

        const lConsole = new Console();
        const lBlueprintPath = path.resolve(this.mWorkspace.paths.cli.environment.packageBlueprints, lBlueprintType.toLowerCase());

        // Output heading.
        lConsole.writeLine('Create Package');

        // Check correct blueprint.
        if (!FileUtil.exists(lBlueprintPath)) {
            throw `Blueprint "${lBlueprintType}" does not exist.`;
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
        lWorkspaceConfiguration.config.blueprint = lBlueprintType.toLowerCase();
        this.mWorkspace.updateProjectConfiguration(lProjectName, lWorkspaceConfiguration);

        // Display init information.
        lConsole.writeLine('Project successfull created.');
        lConsole.writeLine(`Call "npm install" to initialize this project`);
    }
}