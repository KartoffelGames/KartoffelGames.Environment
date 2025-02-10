import { CliCommand, CliCommandDescription, CliParameter, Console, ICliPackageCommand, Package, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Show command list',
                parameters: {
                    root: 'help',
                    optional: {
                        command: {
                            shortName: 'c'
                        }
                    }
                }
            },
            configuration: null
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param pCommandPackages - All cli packages grouped by type.
     */
    public async run(pProject: Project, _pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Create each package async.
        const lPackageInstancePromiseList: Array<Promise<CliCommand | null>> = new Array<Promise<CliCommand | null>>();

        // Create each command package.
        for (const lPackageInformation of await pProject.cliPackages.readAll('command')) {
            // Add command class to list. Skip any failed package creations.
            lPackageInstancePromiseList.push(pProject.cliPackages.createCommand(lPackageInformation.configuration.name).catch((pError: Error) => {
                // eslint-disable-next-line no-console
                console.warn(pError);
                return null;
            }));
        }

        // Wait for all packages to be created.
        const lCommandList: Array<CliCommand | null> = await Promise.all(lPackageInstancePromiseList);

        // Convert command list into command/description map.
        const lCommandMap: Map<string, string> = new Map<string, string>();
        for (const lCommand of lCommandList) {
            if (!lCommand) {
                continue;
            }

            // Get command information.
            const lCommandInformation: CliCommandDescription = lCommand.cliPackageCommand.information;

            const lRequiredParameters: Array<string> = lCommandInformation.command.parameters.required ?? [];
            const lOptionalParameters = Object.entries(lCommandInformation.command.parameters.optional ?? {});

            // Convert pattern information into pattern string.
            let lCommandPattern: string = `${lCommandInformation.command.parameters.root} ${lRequiredParameters.join(' ')} `;
            lCommandPattern += lOptionalParameters.map(([pParameterName, pParameterConfiguration]) => {
                let lFlag: string = `--${pParameterName}`;

                if (pParameterConfiguration.shortName) {
                    lFlag = `${lFlag} -${pParameterConfiguration.shortName}`;
                }

                if (pParameterConfiguration.default) {
                    return `${lFlag} => ${pParameterConfiguration.default}`;
                }
                return `[${lFlag}]`;
            }).join(' ');

            // Add command to map.
            lCommandMap.set(lCommandPattern, lCommandInformation.command.description);
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