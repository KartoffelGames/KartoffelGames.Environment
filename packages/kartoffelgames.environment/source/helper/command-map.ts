import { Console } from './console';
import { Parameter } from './parameter';

export class CommandMap {
    private readonly mCommand: Parameter;
    private readonly mCommandList: Array<Command>;
    private readonly mCommandRootName: string;
    private readonly mConsole: Console;

    /**
     * Constructor.
     * @param pCommandRoot - Command root name.
     * @param pCommand - Command data.
     */
    public constructor(pCommandRoot: string, pCommand: Parameter) {
        this.mCommandRootName = pCommandRoot;
        this.mCommand = pCommand;
        this.mCommandList = new Array<Command>();
        this.mConsole = new Console();

        // Add help command.
        this.add('help', async (_pData: CommandData) => {
            // Find max length of commands.
            const lMaxLength: number = this.mCommandList.reduce((pCurrent: number, pNext: Command) => {
                return pNext.description.length > pCurrent ? pNext.description.length : pCurrent;
            }, 0);

            // Output all commands.
            this.mConsole.writeLine('Available commands:');
            for (const lCommand of this.mCommandList) {
                this.mConsole.writeLine(`${this.mCommandRootName} ${lCommand.pattern.join(' ').padEnd(lMaxLength, ' ')} - ${lCommand.description}`);
            }
        }, 'Help for all commands.');
    }

    /**
     * Add command.
     * @param pPattern - Command pattern.
     * @param pHandler - Command handler.
     * @param pDescription - Command description.
     */
    public add(pPattern: string, pHandler: CommandHandler, pDescription: string): void {
        this.mCommandList.push({
            pattern: pPattern.split(' '),
            handler: pHandler,
            description: pDescription
        });
    }

    /**
     * Execute command.
     */
    public async execute(): Promise<void> {
        // Find and execute command.
        const lExecutingCommand: [CommandData, Command] | null = ((): [CommandData, Command] | null => {
            for (const lCommand of this.mCommandList) {
                const lCommandData: CommandData = {
                    command: this.mCommand,
                    pathData: {}
                };

                // Check command pattern with path.
                let lCommandFound: boolean = true;
                for (let lIndex: number = 0; lIndex < lCommand.pattern.length; lIndex++) {
                    const lCommandPart: string = this.mCommand.fullPath[lIndex] ?? '';
                    const lPatternPart: string = lCommand.pattern[lIndex];

                    if (lPatternPart.startsWith('<') && !lCommandPart.startsWith('--')) {
                        // Add command data.
                        lCommandData.pathData[lPatternPart.substring(1, lPatternPart.length - 1)] = lCommandPart;
                        continue;
                    } else if (lPatternPart.startsWith('[')) {
                        continue;
                    } else if (lPatternPart.toLowerCase() === lCommandPart.toLowerCase()) {
                        continue;
                    } else {
                        lCommandFound = false;
                        break;
                    }
                }

                // Search next command.
                if (!lCommandFound) {
                    continue;
                }

                return [lCommandData, lCommand];
            }

            return null;
        })();

        // Exit on invalid command.
        if (lExecutingCommand === null) {
            throw 'Command not found';
        }

        // Execute command.
        const [lCommandData, lCommand] = lExecutingCommand;
        await lCommand.handler(lCommandData);
    }
}

type Command = {
    pattern: Array<string>,
    handler: CommandHandler,
    description: string;
};

type CommandHandler = (pData: CommandData) => Promise<void>;

export type CommandData = {
    pathData: Record<string, string>;
    command: Parameter;
};