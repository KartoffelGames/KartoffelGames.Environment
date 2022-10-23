import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console } from '@kartoffelgames/environment.core';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            description: 'Show command list',
            commandPattern: 'help'
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param pCliPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, pCliPackages: Record<string, Array<string>>): Promise<void> {
        const lCommandList: Array<IKgCliCommand> = new Array<IKgCliCommand>();

        // Create each command package.
        for (const lPackage of (pCliPackages['command'] ?? [])) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const lCommandConstructor: KgCliCommandConstructor = require(lPackage).KgCliCommand;

            // Add command class to list.
            lCommandList.push(new lCommandConstructor());
        }

        // Find max length of commands.
        const lMaxLength: number = lCommandList.reduce((pCurrent: number, pNext: IKgCliCommand) => {
            return pNext.information.commandPattern.length > pCurrent ? pNext.information.commandPattern.length : pCurrent;
        }, 0);

        // Output all commands.
        const lConsole: Console = new Console();
        lConsole.writeLine('Available commands:');
        for (const lCommand of lCommandList) {
            lConsole.writeLine(`kg ${lCommand.information.commandPattern.padEnd(lMaxLength, ' ')} - ${lCommand.information.description}`);
        }
    }
}

type KgCliCommandConstructor = {
    new(): IKgCliCommand;
};