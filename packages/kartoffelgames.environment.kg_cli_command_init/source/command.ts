import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';
import { IKgCliProjectBlueprint } from './interfaces/i-kg-cli-project-blueprint';
import { ProjectParameter } from './package/project-parameter';

export class KgCliCommand implements IKgCliCommand<string | undefined> {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription<string | undefined> {
        return {
            command: {
                description: 'Initialize new monorepo project.',
                pattern: 'init <blueprint_name> [project_name] --list'
            },
            resourceGroup: 'blueprint',
            configuration: {
                name: 'project-blueprint',
                default: undefined
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pBlueprintPackages - All cli packages grouped by type.
     */
    public async run(pParameter: CliParameter, pBlueprintPackages: Array<string>, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // Read required parameter.
        const lBlueprintName: string = <string>pParameter.parameter.get('blueprint_name')?.toLowerCase();

        // Read all KG_Cli_Blueprint packages informations.
        const lBlueprintList: Array<IKgCliProjectBlueprint> = this.readBlueprintList(pBlueprintPackages);

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
        const lProjectNameValidation: RegExp = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
        let lNewProjectName: string = pParameter.parameter.get('project_name') ?? '';
        if (lNewProjectName === '') {
            lNewProjectName = await lConsole.promt('Project Name: ', lProjectNameValidation);
        }

        // Validate packag name again or for the first time.
        if (!lProjectNameValidation.test(lNewProjectName)) {
            throw 'Project name does not match NPM package name convention';
        }

        // Create blueprint.
        await this.createBlueprint(lNewProjectName, lBlueprint, pParameter);

        // Call npm install.
        lConsole.writeLine('Install dependencies...');
        const lShell: Shell = new Shell(pProjectHandler.projectRootDirectory);
        await lShell.background('npm install');

        // Add environment project dependency.
        await lShell.background('npm install @kartoffelgames/environment@latest --save-dev');

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
        const lConsole = new Console();
        const lCurrentWorkingDirectory: string = process.cwd();

        // Get source and target path of blueprint files.
        const lSourcePath: string = path.resolve(pBlueprint.information.blueprintDirectory);
        const lTargetPath: string = lCurrentWorkingDirectory;


        // Check existing target directory.
        if (!FileUtil.isEmpty(lTargetPath)) {
            throw `Target directory "${lTargetPath}" is not empty.`;
        }

        // Rollback on error.
        try {
            // Copy files.
            lConsole.writeLine('Copy files...');
            FileUtil.copyDirectory(lSourcePath, lTargetPath, true);

            // Create package parameter.
            const lPackageParameter: ProjectParameter = new ProjectParameter(pProjectName);
            for (const [lParameterName, lParameterValue] of pCommandParameter.parameter.entries()) {
                lPackageParameter.parameter.set(lParameterName, lParameterValue);
            }

            // Execute blueprint after copy handler.
            lConsole.writeLine('Execute blueprint handler...');
            await pBlueprint.afterCopy(lTargetPath, lPackageParameter);
        } catch (lError) {
            lConsole.writeLine('ERROR: Try rollback.');

            // Rollback by deleting package directory.
            FileUtil.emptyDirectory(lTargetPath);

            // Rethrow error.
            throw lError;
        }

        return lTargetPath;
    }

    /**
     * Create all package blueprint definition class. 
     * @param pCliPackages - Cli packages.
     */
    private readBlueprintList(pBlueprintPackages: Array<string>): Array<IKgCliProjectBlueprint> {
        const lBlueprintList: Array<IKgCliProjectBlueprint> = new Array<IKgCliProjectBlueprint>();

        // Create each project blueprint package.
        for (const lPackage of pBlueprintPackages) {
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