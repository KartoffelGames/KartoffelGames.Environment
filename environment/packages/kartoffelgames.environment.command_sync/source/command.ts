import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment.core';

export class CliCommand implements ICliCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Sync local package versions into all package.json files.',
                pattern: 'sync'
            },
            configuration: null
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // Find all packages.
        const lPackageList: Array<PackageInformation> = pProjectHandler.readAllPackages();

        // Sync package versions.
        lConsole.writeLine('Sync package version numbers...');
        this.updatePackageVersions(lPackageList);

        // Update package kg configuration.
        lConsole.writeLine('Sync package configuration...');
        await this.updatePackageConfigurations(lPackageList, pProjectHandler);

        lConsole.writeLine('Sync completed');
    }

    /**
     * Update kg project configuration to updated structure.
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

    /**
     * Update local package dependencies with current project versions.
     * @param pProjectList - Local project list.
     */
    private updatePackageVersions(pProjectList: Array<PackageInformation>): void {
        // Map each package.json with its path.
        const lPackageInformations: Map<string, PackageChangeInformation> = new Map<string, PackageChangeInformation>();
        for (const lPackage of pProjectList) {
            const lPackageJson = lPackage.packageJson;

            // Map package information.
            lPackageInformations.set(lPackageJson['name'], {
                packageName: lPackage.packageName,
                path: lPackage.directory,
                json: lPackageJson,
                changed: false,
                version: lPackage.version
            });
        }

        // Replace local dependencies.
        for (const lPackageInformation of lPackageInformations.values()) {
            const lCurrentPackageJson = lPackageInformation.json;

            // Sync development and productive dependencies.
            const lDependencyTypeList = ['devDependencies', 'dependencies'];
            for (const lDependencyType of lDependencyTypeList) {
                // Check if package.json has dependency property.
                if (lDependencyType in lCurrentPackageJson) {
                    for (const lDependencyName in lCurrentPackageJson[lDependencyType]) {
                        // On local package exists.
                        if (lPackageInformations.has(lDependencyName)) {
                            const lOldDependency = lCurrentPackageJson[lDependencyType][lDependencyName];
                            const lNewDependency = `^${(<PackageChangeInformation>lPackageInformations.get(lDependencyName)).version}`;

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
                const lPackageFilePath = FileSystem.pathToAbsolute(lPackageInformation.path, 'package.json');

                // Write altered data to package.json.
                FileSystem.write(lPackageFilePath, lPackageJsonText);
            }
        }
    }
}

type PackageChangeInformation = {
    packageName: string;
    path: string;
    json: any;
    changed: boolean;
    version: string;
};