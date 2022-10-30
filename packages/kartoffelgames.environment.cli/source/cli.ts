#! /usr/bin/env node

import { Console, Parameter, Project } from '@kartoffelgames/environment.core';
import * as path from 'path';
import { CliCommand } from './cli/cli-command';
import { CliPackages } from './cli/cli-packages';

(async () => {
    const lConsole: Console = new Console();

    // Output main banner.
    lConsole.banner('KG ENVIRONMENT');
    lConsole.write('Search command...\n\n');

    // Construct paths.
    const lCurrentWorkingDirectoryPath: string = process.cwd();
    const lCliRootPath: string = path.resolve(__dirname, '..', '..');

    // Read command parameter.
    const lParameter: Parameter = new Parameter('cli.js');

    // Execute command.
    try {
        // Init command indexing.
        const lCliPackagesHandler: CliPackages = new CliPackages(lCurrentWorkingDirectoryPath, lCliRootPath);
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

        // Execute command.
        await lCliCommandHandler.execute(lParameter, lProject);
    } catch (e) {
        lConsole.writeLine((<any>e).toString(), 'red');

        // Include error stack when command has --stack parameter. 
        if (lParameter.parameter.has('stack')) {
            lConsole.writeLine((<Error>e)?.stack ?? '', 'red');
        }

        process.exit(1);
    }

    process.exit(0);
})();