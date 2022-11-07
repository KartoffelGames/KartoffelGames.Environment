#! /usr/bin/env node

import { Console, Parameter, Project } from '@kartoffelgames/environment.core';
import { CliCommand } from './cli/cli-command';
import { CliPackages } from './cli/cli-packages';

(async () => {
    const lConsole: Console = new Console();
    
    // Construct paths.
    const lCurrentWorkingDirectoryPath: string = process.cwd();

    // Read command parameter.
    const lParameter: Parameter = new Parameter('cli.js');

    // Execute command.
    try {
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
        if(lParameter.parameter.has('debug')){
            lConsole.writeLine(`Project root: ${lProject.projectRootDirectory}`, 'green');

            // Print all packages.
            lConsole.writeLine(`CLI-Packages:`, 'green');
            for(const lGroupName of Object.keys(lCliPackages)){
                lConsole.writeLine(`    ${lGroupName}:`, 'green');

                const lPackages = lCliPackages[lGroupName];
                for(const lPackage of lPackages) {
                    lConsole.writeLine(`        ${lPackage}:`, 'green');
                }
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