import { Project } from '../project/project.ts';

export interface ICliPackageBlueprintResolver {
    /**
     * Executed after package files are copied.
     */
    afterCopy(pParameter: CliPackageBlueprintParameter, ProjectHandler: Project): Promise<void>;
}

export type CliPackageBlueprintParameter = {
    packageName: string;
    packageIdName: string;
    packageDirectory: string;
};