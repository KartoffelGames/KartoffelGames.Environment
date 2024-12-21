import { ProjectParameter } from '../package/project-parameter';

export interface IKgCliProjectBlueprint {
    /**
     * Command description.
     */
    information: KgCliProjectBlueprintDescription;

    /**
     * 
     */
    afterCopy(pProjectDirectory: string, pParameter: ProjectParameter): Promise<void>;
}

export type KgCliProjectBlueprintDescription = {
    name: string,
    blueprintDirectory: string;
    description: string;
};