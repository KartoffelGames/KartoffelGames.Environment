import type { Project } from '@kartoffelgames/environment-core';

export interface ICliPackageBlueprintResolver {
    /**
     * Executed after package files are copied.
     */
    afterCopy(pParameter: CliPackageBlueprintParameter, ProjectHandler: Project): Promise<void>;

    /**
     * List of all available blueprints.
     * The blueprint url must point to a blueprint zip file.
     */
    availableBlueprints(): Map<string, URL>;
}

export type CliPackageBlueprintParameter = {
    packageName: string;
    packageIdName: string;
    packageDirectory: string;
};