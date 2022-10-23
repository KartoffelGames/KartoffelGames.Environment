import { PackageParameter } from '../package/package-parameter';

export interface IKgCliPackageBlueprint {
    /**
     * Command description.
     */
    information: KgCliBlueprintDescription;

    /**
     * 
     */
    afterCopy(pPackageDirectory: string, pParameter: PackageParameter): Promise<void>;
}

export type KgCliBlueprintDescription = {
    name: string,
    blueprintDirectory: string;
    description: string;
};