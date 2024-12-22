import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, ProjectInformation } from '@kartoffelgames/environment.core';
import * as path from 'path';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            command: {
                description: 'Sync local package versions into all package.json files.',
                pattern: 'sync'
            }
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, _pCliPackages: Array<string>, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // Find all packages.
        const lPackageList: Array<ProjectInformation> = pProjectHandler.readAllProject();

        // Sync package versions.
        lConsole.writeLine('Sync package version numbers...');
        this.updatePackageVersions(lPackageList);

        // Update package kg configuration.
        lConsole.writeLine('Sync package configuration...');
        this.updatePackageConfigurations(lPackageList, pProjectHandler);

        lConsole.writeLine('Sync completed');
    }

    /**
     * Update kg project configuration to updated structure.
     * @param pProjectList - Local project list.
     * @param pProjectHander - Project handler.
     */
    private updatePackageConfigurations(pProjectList: Array<ProjectInformation>, pProjectHander: Project): void {
        for (const lProject of pProjectList) {
            pProjectHander.updateProjectConfiguration(lProject.packageName, lProject);
        }
    }

    /**
     * Update local package dependencies with current project versions.
     * @param pProjectList - Local project list.
     */
    private updatePackageVersions(pProjectList: Array<ProjectInformation>): void {
        // Map each package.json with its path.
        const lPackageInformations: Map<string, PackageChangeInformation> = new Map<string, PackageChangeInformation>();
        for (const lProject of pProjectList) {
            const lFileText = FileUtil.read(path.resolve(lProject.directory, 'package.json'));
            const lPackageJson = JSON.parse(lFileText);

            // Map package information.
            lPackageInformations.set(lPackageJson['name'], {
                packageName: lProject.packageName,
                path: lProject.directory,
                json: lPackageJson,
                changed: false,
                version: lProject.version
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
                const lPackageFilePath = path.resolve(lPackageInformation.path, 'package.json');

                // Write altered data to package.json.
                FileUtil.write(lPackageFilePath, lPackageJsonText);
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