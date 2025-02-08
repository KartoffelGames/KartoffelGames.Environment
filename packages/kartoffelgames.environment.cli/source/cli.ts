#!/usr/bin/env deno

import { CliCommand, CliParameter, Console, FileSystem, Import, ProcessContext, Project } from '@kartoffelgames/environment-core';
import { Package } from "../../kartoffelgames.environment.core/source/project/package.ts";

(async () => {
    const lConsole: Console = new Console();

    // Read parameter and cut before cli.js parameter.
    const lParameter: Array<string> = (() => {
        const lCliCommandStartIndex: number = ProcessContext.parameters.findIndex((pParameter) => {
            return pParameter.toLowerCase().endsWith(FileSystem.fileOfPath(import.meta.filename!));
        });
        return ProcessContext.parameters.slice(lCliCommandStartIndex + 1);
    })();

    // Read global cli parameters.
    const lGlobalParameters: CliParameter = CliParameter.globals(lParameter);

    // Set debug flag and remove debug parameter.
    const lDebugEnabled: boolean = lGlobalParameters.has('debug');

    // Execute command.
    try {
        // Read current version.
        const lCliPackageJsonUrl: URL = Import.resolveToUrl(import.meta.url + '/../../' + 'deno.json');
        const lCliPackageJsonRequest: Response = await fetch(lCliPackageJsonUrl);
        const lCliPackageJson: any = await lCliPackageJsonRequest.json();
        const lCurrentCliVersion: string = lCliPackageJson['version'];

        // Print execution information.
        lConsole.writeLine(`KG-CLI [${lCurrentCliVersion}]: "kg ${lParameter.join(' ')}"`, 'yellow');
        if (lDebugEnabled) {
            lConsole.writeLine(ProcessContext.parameters.join(' '), 'green');
        }

        // Create project handler.
        const lProject: Project = new Project(ProcessContext.workingDirectory);

        // Init commands.
        const lCliCommand: CliCommand = await lProject.cliPackages.createCommand(lGlobalParameters.rootParameter);

        // Read target packages.
        const lTargetPackageList: Array<Package | null> = new Array<Package | null>(); // TODO: CliParameter.readGlobals(lParameter); creates a CliParameter only with global (--all, --debug ...) parameters.
        if (lGlobalParameters.has('all')) {
            lTargetPackageList.push(...lProject.readAllPackages());
        } else if (lGlobalParameters.has('package')) {
            lTargetPackageList.push(lProject.getPackage(lGlobalParameters.get('package')!));
        }

        // Add null package when no package is set.
        if (lTargetPackageList.length === 0) {
            lTargetPackageList.push(null);
        }

        // Print debug information.
        if (lDebugEnabled) {
            lConsole.writeLine(`Project root: ${lProject.rootDirectory}`, 'green');

            // Print all packages.
            lConsole.writeLine(`CLI-Packages:`, 'green');
            for (const lCliPackageInformation of await lProject.cliPackages.readAll()) {
                lConsole.writeLine(`    ${lCliPackageInformation.packageName}:`, 'green');
                lConsole.writeLine(`        ${JSON.stringify(lCliPackageInformation.configuration)}:`, 'green');
            }

            // Print all projects.
            lConsole.writeLine(`Project-Packages:`, 'green');
            for (const lProjectInformation of lProject.readAllPackages()) {
                lConsole.writeLine(`    ${lProjectInformation.id} -- ${lProjectInformation.version}`, 'green');
            }
        }

        // Execute command.
        lConsole.writeLine('Execute command...\n');
        for (const lTargetPackage of lTargetPackageList) {
            await lCliCommand.execute(lTargetPackage, lParameter);
        }
    } catch (e) {
        lConsole.writeLine((<any>e).toString(), 'red');

        // Include error stack when command has --stack parameter. 
        if (lDebugEnabled) {
            lConsole.writeLine((<Error>e)?.stack ?? '', 'red');
        }

        Deno.exit(1);
    }

    Deno.exit(0);
})();