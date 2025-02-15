import { Project } from '@kartoffelgames/environment-core';

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