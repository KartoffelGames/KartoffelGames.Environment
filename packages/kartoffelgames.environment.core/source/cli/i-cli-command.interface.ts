import { CliParameter } from './cli-parameter';
import { Project } from '../project/project';

export interface ICliCommand<TConfiguration = any> {
    /**
     * Command description.
     */
    information: CliCommandDescription<TConfiguration>;

    /**
     * Run command.
     * @param pParameter - Command parameter.
     * @param pProject - Project.
     * 
     * @returns - Promise that resolves when command is finished.
     */
    run(pParameter: CliParameter, pProject: Project): Promise<void>;
}

export type CliCommandDescription<TConfiguration = any> = {
    command: {
        pattern: string;
        description: string;
    };
    configuration: {
        name: string,
        default: TConfiguration;
    } | null;
};