import { Project } from '@kartoffelgames/environment.core';
import { CliParameter } from '../cli/cli-parameter';

export interface IKgCliCommand<TConfiguration = any> {
    /**
     * Command description.
     */
    information: KgCliCommandDescription<TConfiguration>;

    /**
     * Run command.
     * @param pParameter - Command parameter.
     * @param pGroupPackages - All cli packages cli group.
     */
    run(pParameter: CliParameter, pGroupPackages: Array<string>, pPackageHandler: Project): Promise<void>;
}

export type KgCliCommandDescription<TConfiguration = any> = {
    command: {
        pattern: string;
        description: string;
    };
    resourceGroup?: string;
    configuration?: {
        name: string,
        default: TConfiguration;
    };
};