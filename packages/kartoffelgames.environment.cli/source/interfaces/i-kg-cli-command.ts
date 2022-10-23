import { CliParameter } from '../cli/cli-parameter';

export interface IKgCliCommand {
    /**
     * Command description.
     */
    information: KgCliCommandDescription;

    /**
     * Run command.
     * @param pParameter - Command parameter.
     * @param pCliPackages - All cli packages grouped by type.
     */
    run(pParameter: CliParameter, pCliPackages: Record<string, Array<string>>): Promise<void>;
}

export type KgCliCommandDescription = {
    commandPattern: string;
    description: string;
};