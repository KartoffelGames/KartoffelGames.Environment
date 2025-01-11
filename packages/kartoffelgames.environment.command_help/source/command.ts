import { CliCommandDescription, CliPackages, CliParameter, Console, ICliCommand, Project } from '@kartoffelgames/environment-core';

export class CliCommand implements ICliCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Show command list',
                name: 'help',
                parameters: [],
                flags: []
            },
            configuration: null
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param pCommandPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, pProject: Project): Promise<void> {
        // Cli packages.
        const lCliPackages: CliPackages = new CliPackages(pProject.projectRootDirectory);

        // Create each package async.
        const lPackageInstancePromiseList: Array<Promise<ICliCommand | null>> = new Array<Promise<ICliCommand | null>>();

        // Create each command package.
        for (const [, lPackageInformation] of await lCliPackages.getCommandPackages()) {
            // Skip any packages without a command entry class.
            if (!lPackageInformation.configuration.commandEntryClass) {
                continue;
            }

            // Add command class to list. Skip any failed package creations.
            lPackageInstancePromiseList.push(lCliPackages.createPackageCommandInstance(lPackageInformation).catch((pError: Error) => {
                // eslint-disable-next-line no-console
                console.warn(pError);
                return null;
            }));
        }

        // Wait for all packages to be created.
        const lCommandList: Array<ICliCommand | null> = await Promise.all(lPackageInstancePromiseList);

        // Convert command list into command/description map.
        const lCommandMap: Map<string, string> = new Map<string, string>();
        for (const lCommand of lCommandList) {
            if (!lCommand) {
                continue;
            }

            // Convert pattern information into pattern string.
            let lCommandPattern: string = `${lCommand.information.command.name} ${lCommand.information.command.parameters.join(' ')} `;
            lCommandPattern += lCommand.information.command.flags.map((pFlag) => { return `--${pFlag}`; }).join(' ');

            // Add command to map.
            lCommandMap.set(lCommandPattern, lCommand.information.command.description);
        }

        // Find max length of commands.
        const lMaxLength: number = lCommandMap.keys().reduce((pCurrent: number, pNext: string | null) => {
            if (!pNext) {
                return pCurrent;
            }

            return pNext.length > pCurrent ? pNext.length : pCurrent;
        }, 0);

        // Output all commands.
        const lConsole: Console = new Console();
        lConsole.writeLine('Available commands:');
        for (const [lCommandPattern, lCommandDescription] of lCommandMap) {
            lConsole.writeLine(`kg ${lCommandPattern.padEnd(lMaxLength, ' ')} - ${lCommandDescription}`);
        }
    }
}