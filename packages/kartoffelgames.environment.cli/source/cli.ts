#!/usr/bin/env deno

import { Console, FileSystem, Project, CliPackages, CliCommand, ProcessContext, Package } from '@kartoffelgames/environment-core';

(async () => {
    const lConsole: Console = new Console();

    // Read parameter and cut before cli.js parameter.
    const lParameter: Array<string> = (() => {
        const lCliCommandStartIndex: number = ProcessContext.parameters.findIndex((pParameter) => {
            return pParameter.toLowerCase().endsWith(FileSystem.fileOfPath(import.meta.filename!));
        });
        return ProcessContext.parameters.slice(lCliCommandStartIndex + 1);
    })();

    // Check for enabled debug option.
    const lDebugParameterIndex: number = lParameter.findIndex((pParameter) => {
        return pParameter.toLowerCase() === '--debug';
    });

    // TODO: Add a "--all" parameter.

    // Set debug flag and remove debug parameter.
    const lDebugEnabled: boolean = lDebugParameterIndex !== -1;
    if (lDebugParameterIndex !== -1) {
        lParameter.splice(lDebugParameterIndex, 1);
    }

    // Execute command.
    try {
        // Read current version.
        const lCliPackageJsonUrl: URL = Package.resolveToUrl(import.meta.url + '/../../' + 'deno.json');
        const lCliPackageJsonRequest: Response = await fetch(lCliPackageJsonUrl);
        const lCliPackageJson: any = await lCliPackageJsonRequest.json();
        const lCurrentCliVersion: string = lCliPackageJson['version'];

        // Print execution information.
        lConsole.writeLine(`KG-CLI [${lCurrentCliVersion}]: "kg ${lParameter.join(' ')}"`, 'yellow');
        if (lDebugEnabled) {
            lConsole.writeLine(ProcessContext.parameters.join(' '), 'green');
        }

        // Check for changed command root package.
        const lCommandRootPackagePath: string = Project.findRoot(ProcessContext.workingDirectory);

        // Init command indexing.
        const lCliPackages: CliPackages = new CliPackages(lCommandRootPackagePath);
        const lCliPackageName: string = lParameter[0]; // First parameter should be the package name.

        // Init commands.
        const lCliCommandHandler: CliCommand = new CliCommand(lCliPackageName, lParameter, lCliPackages);

        // Create package handler.
        const lProject: Project = new Project(lCommandRootPackagePath, lCliPackages);

        // Print debug information.
        if (lDebugEnabled) {
            lConsole.writeLine(`Project root: ${lProject.projectRootDirectory}`, 'green');

            // Print all packages.
            lConsole.writeLine(`CLI-Packages:`, 'green');
            for (const [lPackageName, lPackageConfig] of await lCliPackages.getCommandPackages()) {
                lConsole.writeLine(`    ${lPackageName}:`, 'green');
                lConsole.writeLine(`        ${JSON.stringify(lPackageConfig)}:`, 'green');
            }

            // Print all projects.
            lConsole.writeLine(`Project-Packages:`, 'green');
            for (const lProjectInformation of lProject.readAllPackages()) {
                lConsole.writeLine(`    ${lProjectInformation.packageName} -- ${lProjectInformation.version}`, 'green');
            }
        }

        // Execute command.
        lConsole.writeLine('Execute command...\n');
        await lCliCommandHandler.execute(lProject);
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