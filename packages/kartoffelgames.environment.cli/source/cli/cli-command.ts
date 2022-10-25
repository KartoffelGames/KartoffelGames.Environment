import { Parameter, Project } from '@kartoffelgames/environment.core';
import { IKgCliCommand } from '../interfaces/i-kg-cli-command';
import { CliParameter } from './cli-parameter';

export class CliCommand {
    private readonly mCliPackages: Record<string, Array<string>>;
    private readonly mCommandList: Array<IKgCliCommand>;

    /**
     * Command list.
     */
    public get commands(): Array<IKgCliCommand> {
        return this.mCommandList;
    }

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
    public async execute(pParameter: Parameter, pProject: Project): Promise<void> {
        // Find command.
        const lCommand: IKgCliCommand | null = this.findCommandByParameter(pParameter);
        if (lCommand === null) {
            throw 'Command not found';
        }

        // Create cli parameter.
        const lCliParameter: CliParameter = new CliParameter();

        // Transfer command parameters.
        for (const lParameter of pParameter.parameter.values()) {
            lCliParameter.parameter.set(lParameter.name, lParameter.value);
        }

        // Read path parameter from command.
        const lCommandPatternParts: Array<string> = lCommand.information.command.pattern.split(' ');
        for (let lPartIndex: number = 0; lPartIndex < lCommandPatternParts.length; lPartIndex++) {
            const lPatternPart: string = lCommandPatternParts[lPartIndex];
            const lCommandPart: string | null = pParameter.path[lPartIndex] ?? null;

            if (lPatternPart.startsWith('<') || lPatternPart.startsWith('[')) {
                // Read optional or static parameter name and value.
                const lParameterName: string = lPatternPart.slice(1, lPatternPart.length - 1);
                lCliParameter.parameter.set(lParameterName, lCommandPart);
            } else if (lPatternPart.startsWith('--')) {
                // Optional parameters reached.
                break;
            } else {
                // Static path.
                continue;
            }
        }

        // Get package group.
        const lPackageGroupName: string | null = lCommand.information.resourceGroup ?? null;
        const lPackageGroup: Array<string> = this.mCliPackages[<string>lPackageGroupName] ?? [];

        // Build project handler.
        await lCommand.run(lCliParameter, lPackageGroup, pProject);
    }

    /**
     * Find command by parameter.
     * @param pParameter - Command parameter.
     */
    private findCommandByParameter(pParameter: Parameter): IKgCliCommand | null {
        for (const lCommand of this.mCommandList) {
            // Split command pattern by spaces. Remove emty parts.
            let lCommandPatternParts: Array<string> = lCommand.information.command.pattern.split(' ');
            lCommandPatternParts = lCommandPatternParts.filter(pPart => pPart !== '');

            // Check command pattern with path.
            let lCommandFound: boolean = true;
            for (let lIndex: number = 0; lIndex < lCommandPatternParts.length; lIndex++) {
                const lCommandPart: string = pParameter.path[lIndex] ?? '';
                const lPatternPart: string = lCommandPatternParts[lIndex];

                if (lPatternPart.startsWith('<')) { // Required parameter.
                    continue;
                } else if (lPatternPart.startsWith('[') || lCommandPart.startsWith('--')) { // Optional any.
                    // Optional part has begun. Ignore path.
                    break;
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