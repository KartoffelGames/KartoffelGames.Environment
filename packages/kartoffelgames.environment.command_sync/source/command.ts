import { CliCommand, CliCommandDescription, CliParameter, Console, ICliPackageCommand, Package, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Sync local package versions into all package.json files.',
                parameters: {
                    root: 'sync'
                },
            },
            configuration: null
        };
    }

    /**
     * Execute command.
     * 
     * @param _pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(pProjectHandler: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to run test.
        if (pPackage === null) {
            throw new Error('Package to sync not specified.');
        }

        const lConsole = new Console();

        // TODO: This command needs a version sync from root deno.json. Or something to bump all versions to the same.

        // Update package kg configuration.
        lConsole.writeLine('Sync package configuration...');

        await this.updatePackageConfiguration(pProjectHandler, pPackage);

        lConsole.writeLine('Sync completed');
    }

    /**
     * Update kg project configuration to updated structure.
     * 
     * @param pProjectList - Local project list.
     * @param pProject - Project handler.
     */
    private async updatePackageConfiguration(pProject: Project, pPackage: Package): Promise<void> {
        // TODO: Maybe remove it and only update version and name.

        // Set all available cli configurations for each cli package.
        for(const lCliCommand of await pProject.cliPackages.readAll('command')) {
            const lCliPackage: CliCommand = await pProject.cliPackages.createCommand(lCliCommand.configuration.name);

            // Skip cli packages without configuration.
            if (!lCliPackage.cliPackageCommand.information.configuration) {
                continue;
            }

            // Read configuration of command. Unset fields are filled with default values.
            const lCommandConfiguration: any = pPackage.cliConfigurationOf(lCliPackage.cliPackageCommand);

            // And set it again.
            pPackage.setCliConfigurationOf(lCliPackage.cliPackageCommand, lCommandConfiguration);
        }

        pPackage.save();
    }
}

type PackageChangeInformation = {
    packageName: string;
    path: string;
    json: any;
    changed: boolean;
    version: string;
};