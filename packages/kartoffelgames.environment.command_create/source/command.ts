import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';
import { IKgCliPackageBlueprint } from './interfaces/i-kg-cli-package-blueprint';
import { PackageParameter } from './package/package-parameter';

export class KgCliCommand implements IKgCliCommand<string | undefined> {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription<string | undefined> {
        return {
            command: {
                pattern: 'create <blueprint_name> [package_name] --list',
                description: 'Create new package.',
            },
            resourceGroup: 'blueprint',
            configuration: {
                name: 'package-blueprint',
                default: undefined,
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
        const lBlueprintList: Array<IKgCliPackageBlueprint> = this.readBlueprintList(pBlueprintPackages);

        // List blueprints on --list parameter and exit command.
        if (pParameter.parameter.has('list')) {
            // Find max length of commands.
            const lMaxLength: number = lBlueprintList.reduce((pCurrent: number, pNext: IKgCliPackageBlueprint) => {
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
        lConsole.writeLine('Create Package');

        // Find blueprint by name.
        const lBlueprint: IKgCliPackageBlueprint | undefined = lBlueprintList.find(pBlueprint => pBlueprint.information.name.toLowerCase() === lBlueprintName);
        if (!lBlueprint) {
            throw `Blueprint "${lBlueprintName}" not found.`;
        }

        // Find name. Get from command parameter on promt user.
        const lPackageNameValidation: RegExp = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
        let lNewPackageName: string = pParameter.parameter.get('package_name') ?? '';
        if (lNewPackageName === '') {
            lNewPackageName = await lConsole.promt('Package Name: ', lPackageNameValidation);
        }

        // Validate packag name again or for the first time.
        if (!lPackageNameValidation.test(lNewPackageName)) {
            throw 'Package name does not match NPM package name convention';
        }

        // Create blueprint.
        const lNewPackageDirectory: string = await this.createBlueprint(lNewPackageName, lBlueprint, pParameter, pProjectHandler);

        // Update vs code workspaces.
        lConsole.writeLine('Add VsCode Workspace...');
        pProjectHandler.addWorkspace(lNewPackageName, lNewPackageDirectory);

        // Add package information to package.json.
        lConsole.writeLine('Set package configuration...');
        pProjectHandler.updateProjectConfiguration(lNewPackageName, {
            workspace: {
                root: false,
                config: {
                    'package-blueprint': lBlueprint.information.name
                }
            }
        });

        // Call npm install.
        lConsole.writeLine('Install packages...');
        const lShell: Shell = new Shell(pProjectHandler.projectRootDirectory);
        await lShell.background('npm install');

        // Display init information.
        lConsole.writeLine('Package successfully created.');
    }

    /**
     * Create blueprint files.
     * @param pPackageName - Package name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private async createBlueprint(pPackageName: string, pBlueprint: IKgCliPackageBlueprint, pCommandParameter: CliParameter, pProjectHandler: Project): Promise<string> {
        const lConsole = new Console();

        // Get source and target path of blueprint files.
        const lProjectName: string = pProjectHandler.convertToProjectName(pPackageName);
        const lSourcePath: string = path.resolve(pBlueprint.information.blueprintDirectory);
        const lTargetPath: string = path.resolve(pProjectHandler.projectRootDirectory, 'packages', lProjectName.toLowerCase());

        // Check if package already exists.
        if (pProjectHandler.packageExists(pPackageName)) {
            throw `Package "${pPackageName}" already exists.`;
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
            const lPackageParameter: PackageParameter = new PackageParameter(pPackageName, lProjectName);
            for (const [lParameterName, lParameterValue] of pCommandParameter.parameter.entries()) {
                lPackageParameter.parameter.set(lParameterName, lParameterValue);
            }

            // Execute blueprint after copy handler.
            lConsole.writeLine('Execute blueprint handler...');
            await pBlueprint.afterCopy(lTargetPath, lPackageParameter, pProjectHandler);
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
     * @param pBlueprintPackages - Cli packages.
     */
    private readBlueprintList(pBlueprintPackages: Array<string>): Array<IKgCliPackageBlueprint> {
        const lBlueprintList: Array<IKgCliPackageBlueprint> = new Array<IKgCliPackageBlueprint>();

        // Create each package blueprint package.
        for (const lPackage of pBlueprintPackages) {
            // Catch any create errors for malfunctioning packages.
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const lPackageLibrary: any = require(lPackage);

                // Check for correct blueprint type.
                if ('KgCliPackageBlueprint' in lPackageLibrary) {
                    const lCommandConstructor: KgCliPackageBlueprintConstructor = lPackageLibrary.KgCliPackageBlueprint;

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