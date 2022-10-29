import { PackageParameter } from '../package/package-parameter';

export interface IKgCliPackageBlueprint {
    /**
     * Command description.
     */
    information: KgCliPackageBlueprintDescription;

    /**
     * 
     */
    afterCopy(pPackageDirectory: string, pParameter: PackageParameter): Promise<void>;
}

export type KgCliPackageBlueprintDescription = {
    name: string,
    blueprintDirectory: string;
    description: string;
};