import { Project } from '@kartoffelgames/environment.core';
import { PackageParameter } from '../package/package-parameter';

export interface IKgCliPackageBlueprint {
    /**
     * Command description.
     */
    information: KgCliPackageBlueprintDescription;

    /**
     * 
     */
    afterCopy(pPackageDirectory: string, pParameter: PackageParameter, ProjectHandler: Project): Promise<void>;
}

export type KgCliPackageBlueprintDescription = {
    name: string,
    blueprintDirectory: string;
    description: string;
};