import { Package } from "../project/package.ts";
import { Project } from '../project/project.ts';
import { CliParameter } from './cli-parameter.ts';

export interface ICliCommand<TConfiguration = any> {
    /**
     * Command description.
     */
    information: CliCommandDescription<TConfiguration>;

    /**
     * Run command.
     * 
     * @param pProject - Project.
     * @param pPackage - Package the command should be applied to.
     * @param pParameter - Command parameter.
     * 
     * @returns - Promise that resolves when command is finished.
     */
    run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void>;
}

export type CliCommandDescription<TConfiguration = any> = {
    command: {
        description: string;
        parameters: {
            root: string;
            required?: Array<string>;
            optional?: { [parameterName: string]: CliCommandDescriptionOptionalParameter; };
        };
    };
    configuration: {
        name: string,
        default: TConfiguration;
    } | null;
};

export type CliCommandDescriptionOptionalParameter = {
    /**
     * Parameter shortname like "a" to shorten the parameter to -a.
     */
    shortName?: string;

    /**
     * Defining a default value makes the parameter allways set.
     */
    default?: string;
};