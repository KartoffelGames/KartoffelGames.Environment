import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';
import { IKgCliProjectBlueprint } from './interfaces/i-kg-cli-project-blueprint';
import { ProjectParameter } from './package/project-parameter';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            description: 'Initialize new monorepo project.',
            commandPattern: 'create <blueprint_name> [project_name] --list'
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

        // Read required parameter.
        const lBlueprintName: string = <string>pParameter.parameter.get('blueprint_name')?.toLowerCase();

        // Read all KG_Cli_Blueprint packages informations.
        const lBlueprintList: Array<IKgCliProjectBlueprint> = this.readBlueprintList(pCliPackages);

        // List blueprints on --list parameter and exit command.
        if (pParameter.parameter.has('list')) {
            // Find max length of commands.
            const lMaxLength: number = lBlueprintList.reduce((pCurrent: number, pNext: IKgCliProjectBlueprint) => {
                return pNext.information.name.length > pCurrent ? pNext.information.name.length : pCurrent;
            }, 0);

            // Output all commands.
            lConsole.writeLine('Available blueprints:');
            for (const lBlueprint of lBlueprintList) {
                lConsole.writeLine(`${lBlueprint.information.name.padEnd(lMaxLength, ' ')} - ${lBlueprint.information.description}`);
            }
            return;
        }

        // Output heading.
        lConsole.writeLine('Create Project');

        // Find blueprint by name.
        const lBlueprint: IKgCliProjectBlueprint | undefined = lBlueprintList.find(pBlueprint => pBlueprint.information.name.toLowerCase() === lBlueprintName);
        if (!lBlueprint) {
            throw `Blueprint "${lBlueprintName}" not found.`;
        }

        // Find name. Get from command parameter on promt user.
        const lPackageNameValidation: RegExp = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
        let lNewPackageName: string = pParameter.parameter.get('project_name') ?? '';
        if (lNewPackageName === '') {
            lNewPackageName = await lConsole.promt('Project Name: ', lPackageNameValidation);
        }

        // Validate packag name again or for the first time.
        if (!lPackageNameValidation.test(lNewPackageName)) {
            throw 'Package name does not match NPM package name convention';
        }

        // Create blueprint.
        await this.createBlueprint(lNewPackageName, lBlueprint, pParameter);

        // Call npm install.
        lConsole.writeLine('Install packages...');
        const lShell: Shell = new Shell(lCurrentWorkingDirectory);
        await lShell.background('npm install');

        // Add environment project dependency.
        await lShell.background('npm install @kartoffelgames/environment --save-dev');

        // Display init information.
        lConsole.writeLine('Project successfully created.');
    }

    /**
     * Create blueprint files.
     * @param pProjectName - Project name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private async createBlueprint(pProjectName: string, pBlueprint: IKgCliProjectBlueprint, pCommandParameter: CliParameter): Promise<string> {
        
    }

    /**
     * Create all package blueprint definition class. 
     * @param pCliPackages - Cli packages.
     */
    private readBlueprintList(pCliPackages: Record<string, Array<string>>): Array<IKgCliProjectBlueprint> {
        const lBlueprintList: Array<IKgCliProjectBlueprint> = new Array<IKgCliProjectBlueprint>();

        // Create each project blueprint package.
        for (const lPackage of (pCliPackages['blueprint'] ?? [])) {
            // Catch any create errors for malfunctioning packages.
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const lPackageLibrary: any = require(lPackage);

                // Check for correct blueprint type.
                if ('KgCliProjectBlueprint' in lPackageLibrary) {
                    const lBlueprintConstructor: KgCliProjectBlueprintConstructor = lPackageLibrary.KgCliProjectBlueprint;

                    // Add blueprint class to list.
                    lBlueprintList.push(new lBlueprintConstructor());
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn(`Can't initialize project blueprint ${lPackage}.`);
            }
        }

        return lBlueprintList;
    }
}

type KgCliProjectBlueprintConstructor = {
    new(): IKgCliProjectBlueprint;
};