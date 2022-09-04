#! /usr/bin/env node

import * as path from 'path';
import { BuildCommand } from './commands/build-command';
import { PackageCommand } from './commands/package-command';
import { CommandData, CommandMap } from './helper/command-map';
import { Console } from './helper/console';
import { Parameter } from './helper/parameter';
import { Workspace } from './helper/workspace';

(async () => {
    const lConsole: Console = new Console();

    // Wrap error.
    try {
        // Get paths.
        const lCliRootPath: string = path.resolve(__dirname, '..', '..'); // Called from /library/source

        // Setup enviroment information.
        const lParameter: Parameter = new Parameter('index.js');
        const lWorkspace: Workspace = new Workspace(process.cwd(), lCliRootPath);
        const lCommandMap: CommandMap = new CommandMap('kg', lParameter);

        // Output main banner.
        lConsole.banner('KG ENVIROMENT');

        // Add commands.
        lCommandMap.add('create <blueprint_name>', async (pData: CommandData) => {
            const lBlueprintType: string = pData.pathData['blueprint_name'];
            await new PackageCommand(lWorkspace).create(lBlueprintType);
        }, 'Create new package.');

        lCommandMap.add('init <blueprint_name>', async (pData: CommandData) => {
            const lBlueprintType: string = pData.pathData['blueprint_name'];
            await new PackageCommand(lWorkspace).init(lBlueprintType, process.cwd());
        }, 'Initialize new project in current directory.');

        lCommandMap.add('sync', async (_pData: CommandData) => {
            await new PackageCommand(lWorkspace).sync();
        }, 'Sync all local dependency verions.');

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

        await lCommandMap.execute();
    } catch (e) {
        lConsole.writeLine((<any>e).toString(), 'red');
        process.exit(1);
    }

    process.exit(0);
})();