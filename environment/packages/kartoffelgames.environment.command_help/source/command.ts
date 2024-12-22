import { CliCommandDescription, CliPackages, CliParameter, Console, ICliCommand, Project } from '@kartoffelgames/environment.core';

export class CliCommand implements ICliCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Show command list',
                pattern: 'help'
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
            if (!lPackageInformation.configuration.commandEntyClass) {
                continue;
            }

            // Add command class to list. Skip any failed package creations.
            lPackageInstancePromiseList.push(lCliPackages.createPackageInstance(lPackageInformation).catch((pError: Error) => {
                // eslint-disable-next-line no-console
                console.warn(pError);
                return null;
            }));
        }

        // Wait for all packages to be created.
        const lCommandList: Array<ICliCommand | null> = await Promise.all(lPackageInstancePromiseList);

        // Find max length of commands.
        const lMaxLength: number = lCommandList.reduce((pCurrent: number, pNext: ICliCommand | null) => {
            if (!pNext) {
                return pCurrent;
            }

            return pNext.information.command.pattern.length > pCurrent ? pNext.information.command.pattern.length : pCurrent;
        }, 0);

        // Output all commands.
        const lConsole: Console = new Console();
        lConsole.writeLine('Available commands:');
        for (const lCommand of lCommandList) {
            if (!lCommand) {
                continue;
            }

            lConsole.writeLine(`kg ${lCommand.information.command.pattern.padEnd(lMaxLength, ' ')} - ${lCommand.information.command.description}`);
        }
    }
}