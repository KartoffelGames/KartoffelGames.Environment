import { Parameter } from '@kartoffelgames/environment.core';
import { IKgCliCommand } from '../interfaces/i-kg-cli-command';
import { CliParameter } from './cli-parameter';

export class CliCommand {
    private readonly mCliPackages: Record<string, Array<string>>;
    private readonly mCommandList: Array<IKgCliCommand>;

    /**
     * Constructor.
     * @param pCliPackages - Cli packages..
     */
    public constructor(pCliPackages: Record<string, Array<string>>) {
        this.mCliPackages = pCliPackages;
        this.mCommandList = new Array<IKgCliCommand>();

        // Create each command package.
        for (const lPackage of (pCliPackages['command'] ?? [])) {
            // Catch any create errors for malfunctioning packages.
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const lCommandConstructor: KgCliCommandConstructor = require(lPackage).KgCliCommand;

                // Add command class to list.
                this.mCommandList.push(new lCommandConstructor());
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn(`Can't initialize command ${lPackage}.`);
            }

        }
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     */
    public async execute(pParameter: Parameter): Promise<void> {
        // Find command.
        const lCommand: IKgCliCommand | null = this.findCommandByParameter(pParameter);
        if (lCommand === null) {
            throw 'Command not found';
        }

        // Transfer command parameter path.
        const lCliParameter: CliParameter = new CliParameter();
        lCliParameter.path.push(...pParameter.path);

        // Transfer command parameters.
        for (const lParameter of pParameter.parameter.values()) {
            lCliParameter.parameter.set(lParameter.name, lParameter.value);
        }

        await lCommand.run(lCliParameter, this.mCliPackages);
    }

    /**
     * Find command by parameter.
     * @param pParameter - Command parameter.
     */
    private findCommandByParameter(pParameter: Parameter): IKgCliCommand | null {
        for (const lCommand of this.mCommandList) {
            // Split command pattern by spaces. Remove emty parts.
            let lCommandPatternParts: Array<string> = lCommand.information.commandPattern.split(' ');
            lCommandPatternParts = lCommandPatternParts.filter(pPart => pPart !== '');

            // Check command pattern with path.
            let lCommandFound: boolean = true;
            for (let lIndex: number = 0; lIndex < lCommandPatternParts.length; lIndex++) {
                const lCommandPart: string = pParameter.fullPath[lIndex] ?? '';
                const lPatternPart: string = lCommandPatternParts[lIndex];

                if (lPatternPart.startsWith('<') && !lCommandPart.startsWith('--')) { // Required none parameter.
                    continue;
                } else if (lPatternPart.startsWith('[')) { // Optional any.
                    continue;
                } else if (lPatternPart.toLowerCase() === lCommandPart.toLowerCase()) { // Required fixed.
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

            return lCommand;
        }

        return null;
    }
}

type KgCliCommandConstructor = {
    new(): IKgCliCommand;
};