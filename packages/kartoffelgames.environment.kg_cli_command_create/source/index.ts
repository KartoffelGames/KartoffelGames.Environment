import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';
import { IKgCliPackageBlueprint } from './interfaces/i-kg-cli-package-blueprint';
import { PackageParameter } from './package/package-parameter';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            description: 'Create new package.',
            commandPattern: 'create <blueprint_name> [project_name] [--list]'
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pCliPackages - All cli packages grouped by type.
     */
    public async run(pParameter: CliParameter, pCliPackages: Record<string, Array<string>>): Promise<void> {
        const lConsole = new Console();
        const lCurrentWorkingDirectory: string = process.cwd();
        const lProjectHandler: Project = new Project(lCurrentWorkingDirectory);

        // Output heading.
        lConsole.writeLine('Create Package');

        // Read required parameter.
        const lBlueprintName: string = <string>pParameter.parameter.get('blueprint_name')?.toLowerCase();

        // Read all KG_Cli_Blueprint packages informations.
        const lBlueprintList: Array<IKgCliPackageBlueprint> = this.readBlueprintList(pCliPackages);

        // List blueprints on --list parameter and exit command.
        if (pParameter.parameter.has('list')) {
            // Find max length of commands.
            const lMaxLength: number = lBlueprintList.reduce((pCurrent: number, pNext: IKgCliPackageBlueprint) => {
                return pNext.information.name.length > pCurrent ? pNext.information.name.length : pCurrent;
            }, 0);

            // Output all commands.
            lConsole.writeLine('Available blueprints:');
            for (const lBlueprint of lBlueprintList) {
                lConsole.writeLine(`kg ${lBlueprint.information.name.padEnd(lMaxLength, ' ')} - ${lBlueprint.information.description}`);
            }
            return;
        }

        // Find blueprint by name.
        const lBlueprint: IKgCliPackageBlueprint | undefined = lBlueprintList.find(pBlueprint => pBlueprint.information.name.toLowerCase() === lBlueprintName);
        if (!lBlueprint) {
            throw `Package blueprint "${lBlueprintName}" not found.`;
        }

        // Find name. Get from command parameter on promt user.
        let lNewProjectName: string = pParameter.parameter.get('project_name') ?? '';
        if (lNewProjectName === '') {
            lNewProjectName = await lConsole.promt('Project Name: ', /^[a-zA-Z]+\.[a-zA-Z_.]+$/);
        }

        // Create blueprint.
        const lNewPackageDirectory: string = this.createBlueprint(lNewProjectName, lBlueprint, pParameter);

        // Update vs code workspaces.
        lProjectHandler.addWorkspace(lNewProjectName, lNewPackageDirectory);

        // Add package information to package.json.
        lProjectHandler.updateProjectConfiguration(lNewProjectName, {
            projectRoot: false,
            config: {
                blueprint: lBlueprint.information.name,
                pack: false,
                target: 'node',
                test: ['unit']
            }
        });

        // Call npm install.
        const lShell: Shell = new Shell(lCurrentWorkingDirectory);
        lShell.console('npm install');

        // Display init information.
        lConsole.writeLine('Project successfull created.');
        lConsole.writeLine(`Call "npm install" to initialize this project`);
    }

    /**
     * Create blueprint files.
     * @param pProjectName - Project name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private createBlueprint(pProjectName: string, pBlueprint: IKgCliPackageBlueprint, pCommandParameter: CliParameter): string {
        const lConsole = new Console();
        const lCurrentWorkingDirectory: string = process.cwd();
        const lProjectHandler: Project = new Project(lCurrentWorkingDirectory);

        // Get source and target path of blueprint files.
        const lSourcePath: string = path.resolve(pBlueprint.information.blueprintDirectory);
        const lTargetPath: string = path.resolve(lProjectHandler.projectRootDirectory, 'packages', pProjectName.toLowerCase());

        // Check if package already exists.
        if (lProjectHandler.packageExists(pProjectName)) {
            throw `Package "${pProjectName}" already exists.`;
        }

        // Check existing target directory.
        if (FileUtil.exists(lTargetPath)) {
            throw `Target directory "${lTargetPath}" already exists.`;
        }

        // Rollback on error.
        try {
            // Copy files.
            lConsole.writeLine('Copy files...');
            FileUtil.createDirectory(lTargetPath);
            FileUtil.copyDirectory(lSourcePath, lTargetPath, true);

            // Create package parameter.
            const lPackageName: string = lProjectHandler.convertToPackageName(pProjectName);
            const lPackageParameter: PackageParameter = new PackageParameter(lPackageName, pProjectName);
            for (const [lParameterName, lParameterValue] of pCommandParameter.parameter.entries()) {
                lPackageParameter.parameter.set(lParameterName, lParameterValue);
            }

            // Execute blueprint after copy handler.
            lConsole.writeLine('Execute blueprint handler...');
            pBlueprint.afterCopy(lTargetPath, lPackageParameter);
        } catch (lError) {
            lConsole.writeLine('ERROR: Try rollback.');

            // Rollback by deleting package directory.
            FileUtil.deleteDirectory(lTargetPath);

            // Rethrow error.
            throw lError;
        }

        return lTargetPath;
    }

    /**
     * Create all package blueprint definition class. 
     * @param pCliPackages - Cli packages.
     */
    private readBlueprintList(pCliPackages: Record<string, Array<string>>): Array<IKgCliPackageBlueprint> {
        const lBlueprintList: Array<IKgCliPackageBlueprint> = new Array<IKgCliPackageBlueprint>();

        // Create each package blueprint package.
        for (const lPackage of (pCliPackages['blueprint'] ?? [])) {
            // Catch any create errors for malfunctioning packages.
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const lPackageLibrary: any = require(lPackage);

                // Check for correct blueprint type.
                if ('KgCliPackageblueprint' in lPackageLibrary) {
                    const lCommandConstructor: KgCliPackageBlueprintConstructor = lPackageLibrary.KgCliPackageblueprint;

                    // Add blueprint class to list.
                    lBlueprintList.push(new lCommandConstructor());
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn(`Can't initialize package blueprint ${lPackage}.`);
            }
        }

        return lBlueprintList;
    }
}

type KgCliPackageBlueprintConstructor = {
    new(): IKgCliPackageBlueprint;
};