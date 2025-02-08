import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';

export class CliCommand implements ICliPackageCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Sync local package versions into all package.json files.',
                name: 'sync',
                parameters: [],
                flags: [],
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
    public async run(_pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // TODO: This command needs a version sync from root deno.json. Or something to bump all versions to the same.

        // Find all packages.
        const lPackageList: Array<PackageInformation> = pProjectHandler.readAllPackages();

        // Update package kg configuration.
        lConsole.writeLine('Sync package configuration...');
        await this.updatePackageConfigurations(lPackageList, pProjectHandler);

        lConsole.writeLine('Sync completed');
    }

    /**
     * Update kg project configuration to updated structure.
     * 
     * @param pProjectList - Local project list.
     * @param pProject - Project handler.
     */
    private async updatePackageConfigurations(pProjectList: Array<PackageInformation>, pProject: Project): Promise<void> {
        const lUpdateWaiterList: Array<Promise<void>> = new Array<Promise<void>>();

        // Update all package configurations
        for (const lProject of pProjectList) {
            lUpdateWaiterList.push(pProject.updatePackageConfiguration(lProject.packageName));
        }

        // Wait for all updates to finish.
        await Promise.all(lUpdateWaiterList);
    }
}

type PackageChangeInformation = {
    packageName: string;
    path: string;
    json: any;
    changed: boolean;
    version: string;
};