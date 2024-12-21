import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console } from '@kartoffelgames/environment.core';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            command: {
                description: 'Show command list',
                pattern: 'help'
            },
            resourceGroup: 'command'
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param pCommandPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, pCommandPackages: Array<string>): Promise<void> {
        const lCommandList: Array<IKgCliCommand> = new Array<IKgCliCommand>();

        // Create each command package.
        for (const lPackage of pCommandPackages) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const lCommandConstructor: KgCliCommandConstructor = require(lPackage).KgCliCommand;

            // Add command class to list.
            lCommandList.push(new lCommandConstructor());
        }

        // Find max length of commands.
        const lMaxLength: number = lCommandList.reduce((pCurrent: number, pNext: IKgCliCommand) => {
            return pNext.information.command.pattern.length > pCurrent ? pNext.information.command.pattern.length : pCurrent;
        }, 0);

        // Output all commands.
        const lConsole: Console = new Console();
        lConsole.writeLine('Available commands:');
        for (const lCommand of lCommandList) {
            lConsole.writeLine(`kg ${lCommand.information.command.pattern.padEnd(lMaxLength, ' ')} - ${lCommand.information.command.description}`);
        }
    }
}

type KgCliCommandConstructor = {
    new(): IKgCliCommand;
};