import { ICliPackageCommand } from '../cli/i-cli-package-command.interface.ts';
import { Project } from "../index.ts";
import { FileSystem } from "../system/file-system.ts";

export class Package {
    /**
     * Convert package name to project name.
     * 
     * @param pPackageName - Package name.
     */
    public static nameToId(pPackageName: string): string {
        // Empty packae name.
        if (!pPackageName) {
            return '';
        }

        // Split packagename by /, -, _ and .
        let lSplitPackageNamePartList: Array<string> = pPackageName.split(/[\/\-_\.]/g);

        // Remove empty strings and remove any other symbols, anything to lowercase.
        lSplitPackageNamePartList = lSplitPackageNamePartList.filter(pValue => pValue !== '');
        lSplitPackageNamePartList = lSplitPackageNamePartList.map(pValue => pValue.replace(/[^\w]/g, '').toLowerCase());

        // Return nothing when nothing is left.
        if (lSplitPackageNamePartList.length === 0) {
            return '';
        }

        // Convert first letter to uppercase.
        const lLeadingToUppercase = (pValue: string) => {
            return pValue.charAt(0).toUpperCase() + pValue.slice(1);
        };

        // Pop the first entry and use it as project name.
        let lPackageNameId: string = lLeadingToUppercase(lSplitPackageNamePartList.shift()!);

        // On empty return result.
        if (lSplitPackageNamePartList.length === 0) {
            return lPackageNameId;
        }

        // Add next part as project namespace.
        lPackageNameId += `.${lLeadingToUppercase(lSplitPackageNamePartList.shift()!)}`;

        // On empty return result.
        if (lSplitPackageNamePartList.length === 0) {
            return lPackageNameId;
        }

        // Append the remaining parts as package name with hyphen.
        lPackageNameId += `.${lSplitPackageNamePartList.map(pValue => lLeadingToUppercase(pValue)).join('_')}`;

        return lPackageNameId;
    }

    private readonly mProject: Project;
    private readonly mPackageRootPath: string;
    private readonly mPackageConfiguration: PackageConfigurationFile;

    /**
     * Get the package id name.
     */
    public get id(): string {
        return this.mPackageConfiguration.kg.name;
    }

    /**
     * The root directory path of the package.
     */
    public get directory(): string {
        return this.mPackageRootPath;
    }

    /**
     * Get the package version.
     */
    public get version(): string {
        return this.mPackageConfiguration.version;
    }

    /**
     * Get the project this package belongs to.
     */
    public get project(): Project {
        return this.mProject;
    }

    /**
     * Constructor.
     * 
     * @param pProject - Project the package belongs to.
     * @param pPackageRootPath - Root path of the package.
     */
    public constructor(pProject: Project, pPackageRootPath: string) {
        this.mProject = pProject;
        this.mPackageRootPath = pPackageRootPath;

        // Read package json information.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(pPackageRootPath, 'deno.json');
        if (!FileSystem.exists(lPackageJsonPath)) {
            throw new Error(`Package root path "${pPackageRootPath}" has no deno.json file.`);
        }
        const lPackageJsonString: string = FileSystem.read(lPackageJsonPath);
        const lPackageJson: PackageConfigurationFile = (() => {
            try {
                return JSON.parse(lPackageJsonString);
            } catch (pError) {
                throw new Error(`Package "${pPackageRootPath}" has an invalid deno.json file. ${pError}`);
            }
        })();

        // Ignore all packages where kg config is not set.
        if (typeof lPackageJson.name !== 'string') {
            throw new Error(`Package "${pPackageRootPath}" has no package name specified.`);
        }

        // Set package root configuration. Default any missing values.
        this.mPackageConfiguration = lPackageJson;
        // this.mPackageConfiguration.name is allways set. 
        this.mPackageConfiguration.version = lPackageJson.version ?? '0.0.0';
        this.mPackageConfiguration.kg = lPackageJson.kg ?? {
            name: Package.nameToId(lPackageJson.name),
            source: './source',
            config: {}
        };

        // Set unset kg defaults.
        this.mPackageConfiguration.kg.name ??= Package.nameToId(this.mPackageConfiguration.name);
        this.mPackageConfiguration.kg.source ??= './source';
        this.mPackageConfiguration.kg.config ??= {};
    }

    /**
     * Write project kg information into deno.json.
     * 
     * @param pCommand - Target command.
     */
    public cliConfigurationOf<T>(pCommand: ICliPackageCommand<T>): T {
        // Create instance of package and skip if no configuration is setable.
        if (!pCommand.information.configuration) {
            throw new Error(`Cli package has no configuration.`);
        }

        // Read configuration key.
        const lCliPackageConfigurationKey: string | undefined = pCommand.information.configuration.name;

        // Read current available configuration of package.
        const lCurrentConfiguration: Record<string, any> = (() => {
            // Return empty object if no configuration is set.
            if ((this.mPackageConfiguration.kg.config[lCliPackageConfigurationKey] ?? null) === null) {
                return {};
            }

            // Wrap configuration in object.
            return {
                [lCliPackageConfigurationKey]: this.mPackageConfiguration.kg.config[lCliPackageConfigurationKey]
            };
        })();

        // Fill in and return default values.
        return this.mergeObjects(lCurrentConfiguration, {
            [lCliPackageConfigurationKey]: pCommand.information.configuration.default
        })[lCliPackageConfigurationKey] as T;
    }

    /**
     * Write project configuration into deno.json
     */
    public save(): void {
        // Create path to deno.json.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(this.mPackageRootPath, 'deno.json');

        // Save deno.json.
        FileSystem.write(lPackageJsonPath, JSON.stringify(this.mPackageConfiguration, null, 4));
    }

    /**
     * Add and merge new cli configuration data to the package configuration.
     * 
     * @param pCommand - Target command.
     * @param pData - New configuration data.
     */
    public setCliConfigurationOf<T>(pCommand: ICliPackageCommand<T>, pData: Partial<T>): void {
        // Create instance of package and skip if no configuration is setable.
        if (!pCommand.information.configuration) {
            throw new Error(`Cli package has no configuration.`);
        }

        // Read configuration key.
        const lCliPackageConfigurationKey: string | undefined = pCommand.information.configuration.name;

        // Read current available configuration of package.
        const lCurrentConfiguration: Record<string, any> = (() => {
            // Return empty object if no configuration is set.
            if ((this.mPackageConfiguration.kg.config[lCliPackageConfigurationKey] ?? null) === null) {
                return {};
            }

            // Wrap configuration in object.
            return {
                [lCliPackageConfigurationKey]: this.mPackageConfiguration.kg.config[lCliPackageConfigurationKey]
            };
        })();

        // Merge new configuration with the current configuration.
        const lMergedData: T = this.mergeObjects(lCurrentConfiguration, {
            [lCliPackageConfigurationKey]: pData
        })[lCliPackageConfigurationKey] as T;

        // Set new configuration in package configuration json.
        this.mPackageConfiguration.kg.config[lCliPackageConfigurationKey] = lMergedData;
    }

    /**
     * Merge two objects together.
     * 
     * @param pData - Target object with data that should persist.
     * @param pFillData - Default values that should be filled in.
     * 
     * @returns a new object with all values filled in. 
     */
    private mergeObjects(pData: Record<string, any>, pFillData: Record<string, any>): Record<string, any> {
        // Value is object.
        const lIsObject = (pValue: any): boolean => {
            return typeof pValue === 'object' && pValue !== null;
        };

        for (const lKey of Object.keys(pFillData)) {
            const lCurrentValue: any = pData?.[lKey];
            const lDefaultValue: any = pFillData[lKey];

            if (lIsObject(lDefaultValue) && lIsObject(lCurrentValue)) {
                // Rekursion fill in inner objects.
                this.mergeObjects(lCurrentValue, lDefaultValue);
            } else if (typeof lCurrentValue === 'undefined') {
                // Fill in value.
                pData[lKey] = lDefaultValue;
            } else if (lIsObject(lDefaultValue) !== lIsObject(lCurrentValue)) {
                // Values differ. Update value.
                pData[lKey] = lDefaultValue;
            }
        }

        return pData;
    };
}

export interface PackageRootConfiguration {
    name: string;
    source: string;
    config: Record<string, any>;
}

export type PackageConfigurationFile = {
    [key: string]: any;

    name: string;
    version: string;
    kg: PackageRootConfiguration;
};