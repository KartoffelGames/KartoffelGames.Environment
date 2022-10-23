import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project } from '@kartoffelgames/environment.core';
import * as path from 'path';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            description: 'Sync local package versions into all package.json files.',
            commandPattern: 'sync'
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, _pCliPackages: Record<string, Array<string>>): Promise<void> {
        const lConsole = new Console();
        const lCurrentWorkingDirectory: string = process.cwd();
        const lProjectHandler: Project = new Project(lCurrentWorkingDirectory);

        // Output heading.
        lConsole.writeLine('Sync package version numbers...');

        // Get all package.json files.
        const lPackageFileList = FileUtil.findFiles(lProjectHandler.projectRootDirectory, {
            include: { fileNames: ['package.json'] },
            exclude: { directories: ['node_modules'] }
        });

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

            // Sync development and productive dependencies.
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