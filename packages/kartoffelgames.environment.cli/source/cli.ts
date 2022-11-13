#! /usr/bin/env node

import { Console, FileUtil, Parameter, Project } from '@kartoffelgames/environment.core';
import { CliCommand } from './cli/cli-command';
import { CliPackages } from './cli/cli-packages';
import * as path from 'path';

(async () => {
    const lConsole: Console = new Console();

    // Construct paths.
    const lCurrentWorkingDirectoryPath: string = process.cwd();

    // Read command parameter.
    const lParameter: Parameter = new Parameter('cli.js');

    // Execute command.
    try {
        // Read current version.
        const lCliPackageJson: string = FileUtil.read(path.resolve(__dirname, '../../', 'package.json')); // Root at /library
        const lCurrentCliVersion: string = JSON.parse(lCliPackageJson)['version'];

        // Print execution information.
        lConsole.writeLine(`KG-CLI [${lCurrentCliVersion}]: "kg ${lParameter.fullPath.join(' ')}"`, 'yellow');
        lConsole.writeLine(process.argv.join(' '), 'yellow');
        
        // Check for changed command root package.
        let lCommandRootPackagePath: string;
        const lCommandRootParameter = lParameter.parameter.get('command-root-package');
        if (lCommandRootParameter?.value) {
            lCommandRootPackagePath = lCommandRootParameter.value;
        } else {
            lCommandRootPackagePath = Project.findRoot(lCurrentWorkingDirectoryPath);
        }

        // Init command indexing.
        const lCliPackagesHandler: CliPackages = new CliPackages(lCommandRootPackagePath);
        const lCliPackages: Record<string, Array<string>> = await lCliPackagesHandler.getCommandPackages();

        // Init commands.
        const lCliCommandHandler: CliCommand = new CliCommand(lCliPackages);

        // Build package handler.
        const lDefaultConfiguration: Record<string, any> = {};
        for (const lCommand of lCliCommandHandler.commands) {
            if (lCommand.information.configuration) {
                lDefaultConfiguration[lCommand.information.configuration.name] = lCommand.information.configuration.default;
            }
        }

        // Create package handler.
        const lProject: Project = new Project(lCurrentWorkingDirectoryPath, lDefaultConfiguration);

        // Print debug information.
        if (lParameter.parameter.has('debug')) {
            lConsole.writeLine(`Project root: ${lProject.projectRootDirectory}`, 'green');

            // Print all packages.
            lConsole.writeLine(`CLI-Packages:`, 'green');
            for (const lGroupName of Object.keys(lCliPackages)) {
                lConsole.writeLine(`    ${lGroupName}:`, 'green');

                const lPackages = lCliPackages[lGroupName];
                for (const lPackage of lPackages) {
                    lConsole.writeLine(`        ${lPackage}:`, 'green');
                }
            }

            // Print all projects.
            lConsole.writeLine(`Project-Packages:`, 'green');
            for (const lProjectInformation of lProject.readAllProject()) {
                lConsole.writeLine(`    ${lProjectInformation.packageName} -- ${lProjectInformation.version}`, 'green');
            }
        }

        // Execute command.
        lConsole.write('Execute command...\n');
        await lCliCommandHandler.execute(lParameter, lProject);
    } catch (e) {
        lConsole.writeLine((<any>e).toString(), 'red');

        // Include error stack when command has --stack parameter. 
        if (lParameter.parameter.has('debug')) {
            lConsole.writeLine((<Error>e)?.stack ?? '', 'red');
        }

        process.exit(1);
    }

    process.exit(0);
})();