#! /usr/bin/env node

import { Console, Parameter } from '@kartoffelgames/environment.core';
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

        await lCliCommandHandler.execute(lParameter);
    } catch (e) {
        lConsole.writeLine((<any>e).toString(), 'red');

        // Include error stack when command has --stack parameter. 
        if (lParameter.parameter.has('stack')) {
            lConsole.writeLine((<Error>e)?.stack ?? '', 'red');
        }

        process.exit(1);
    }

    process.exit(0);



    /*
        lCommandMap.add('init <blueprint_name>', async (pData: CommandData) => {
            const lBlueprintType: string = pData.pathData['blueprint_name'];
            await new PackageCommand(lWorkspace).init(lBlueprintType, process.cwd());
        }, 'Initialize new project in current directory.');
    
        lCommandMap.add('build <project_name>', async (pData: CommandData) => {
            const lPackageName: string = pData.pathData['project_name'];
            await new BuildCommand(lWorkspace).build(lPackageName);
        }, 'Build package.');
    
        lCommandMap.add('test <project_name> [--coverage] [--no-timeout]', async (pData: CommandData) => {
            const lPackageName: string = pData.pathData['project_name'];
            await new BuildCommand(lWorkspace).test(lPackageName, {
                coverage: pData.command.parameter.has('coverage'),
                noTimeout: pData.command.parameter.has('no-timeout'),
            });
        }, 'Test project.');
    
        lCommandMap.add('scratchpad <project_name>', async (pData: CommandData) => {
            const lPackageName: string = pData.pathData['project_name'];
            await new BuildCommand(lWorkspace).scratchpad(lPackageName);
        }, 'Serve scratchpad files over local http server.');
    
    */
})();