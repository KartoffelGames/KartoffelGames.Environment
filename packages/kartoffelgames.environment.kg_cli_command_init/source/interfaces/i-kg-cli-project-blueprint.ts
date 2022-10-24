import { ProjectParameter } from '../package/project-parameter';

export interface IKgCliProjectBlueprint {
    /**
     * Command description.
     */
    information: KgCliBlueprintDescription;

    /**
     * 
     */
    afterCopy(pProjectDirectory: string, pParameter: ProjectParameter): Promise<void>;
}

export type KgCliBlueprintDescription = {
    name: string,
    blueprintDirectory: string;
    description: string;
};