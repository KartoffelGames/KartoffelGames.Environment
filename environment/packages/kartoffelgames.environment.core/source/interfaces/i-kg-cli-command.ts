import { CliParameter } from '../cli/cli-parameter';
import { Project } from '../project';

export interface IKgCliCommand<TConfiguration = any> {
    /**
     * Command description.
     */
    information: KgCliCommandDescription<TConfiguration>;

    /**
     * Run command.
     * @param pParameter - Command parameter.
     * @param pProject - Project.
     * 
     * @returns - Promise that resolves when command is finished.
     */
    run(pParameter: CliParameter, pProject: Project): Promise<void>;
}

export type KgCliCommandDescription<TConfiguration = any> = {
    command: {
        pattern: string;
        description: string;
    };
    configuration: {
        name: string,
        default: TConfiguration;
    } | null;
};