import { ProcessParameter } from '../process/process-parameter.ts';
import { Process } from '../process/process.ts';
import { Package } from '../project/package.ts';
import { Project } from "../project/project.ts";
import { FileSystem } from '../system/file-system.ts';
import { ICliCommand } from './i-cli-command.interface.ts';
import { ICliPackageBlueprintResolver } from './i-cli-package-blueprint-resolver.interface.ts';

/**
 * Cli packages. Resolves all available cli packages.
 */
export class CliPackages {
    private readonly mCommandRootPackageDirectory: string;

    /**
     * Constructor.
     * @param pCommandRootDirectory - Root package that contains all needed command packages.
     */
    public constructor(pCommandRootDirectory: string,) {
        this.mCommandRootPackageDirectory = pCommandRootDirectory;
    }

    /**
     * Create a new instance of a package command.
     * 
     * @param pPackage - Package information.
     * 
     * @returns - Cli Command instance. 
     */
    public async createPackageCommandInstance(pPackage: CliPackageInformation): Promise<ICliCommand> {
        if (!pPackage.configuration.commandEntryClass) {
            throw new Error(`Can't initialize command ${pPackage.configuration.name}. No entry class defined.`);
        }

        // Catch any create errors for malfunctioning packages.
        try {
            // Import package and get command constructor.
            const lPackageImport: any = await Package.import(pPackage.packageName);
            const lPackageCliCommandConstructor: CliCommandConstructor = lPackageImport[pPackage.configuration.commandEntryClass] as CliCommandConstructor;

            // Create command instance
            return new lPackageCliCommandConstructor();
        } catch (e) {
            throw new Error(`Can't initialize command ${pPackage.configuration.name}. ${e}`);
        }
    }

    /**
     * Create a new instance of a package blueprint resolver.
     * 
     * @param pPackage - Package information.
     * 
     * @returns - Cli package resolver instance. 
     */
    public async createPackagePackageBlueprintResolverInstance(pPackage: CliPackageInformation): Promise<ICliPackageBlueprintResolver> {
        if (!pPackage.configuration.packageBlueprints?.resolveClass) {
            throw new Error(`Can't initialize blueprint resolver ${pPackage.configuration.name}. No entry class defined.`);
        }

        // Catch any create errors for malfunctioning packages.
        try {
            // Import package and get command constructor.
            const lPackageImport: any = await Package.import(pPackage.packageName);
            const lPackageCliConstructor: CliPackageBlueprintResolverConstructor = lPackageImport[pPackage.configuration.packageBlueprints?.resolveClass] as CliPackageBlueprintResolverConstructor;

            // Create command instance
            return new lPackageCliConstructor();
        } catch (e) {
            throw new Error(`Can't initialize blueprint resolver ${pPackage.configuration.name}. ${e}`);
        }
    }

    /**
     * Get all KG_Cli command packages sorted by cli package type.
     * Skip early when the provided package name is found.
     * 
     * @param pNameFilter - Filter for package name.
     * 
     * @returns Map of available cli packages.
     */
    public async getCommandPackages(pNameFilter: string = ''): Promise<Map<string, CliPackageInformation>> {
        // Find root of project and read the json.
        const lProjectRoot: string = Project.findRoot(this.mCommandRootPackageDirectory);
        const lProjectRootPackageJsonString: string = FileSystem.read(`${lProjectRoot}/deno.json`);
        const lProjectRootPackageJson: any = JSON.parse(lProjectRootPackageJsonString);

        // All found cli packages.
        const lCliPackages: Map<string, CliPackageInformation> = new Map<string, CliPackageInformation>();

        // Read all available package imports.
        const lPackageImports: Array<string> | undefined = lProjectRootPackageJson['kg']?.['cli'];

        // Skip when no cli packages are defined.
        if (!lPackageImports) {
            return lCliPackages;
        }

        return new Promise<Map<string, CliPackageInformation>>((pResolve) => {
            // Flag to skip searching after a result was aready resolved.
            let lAlreadyResolved: boolean = false;

            // Filter packages for existsing cli config.
            const lFileReadingList: Array<Promise<void>> = new Array<Promise<void>>();

            // Try to read all packages.
            for (const lPackageImport of lPackageImports) {
                // Import "kg-cli.config.json" from package.
                const lCliConfigFilePath: URL = Package.resolveToUrl(`${lPackageImport}/kg-cli.config.json`);

                // Read cli configuration file as json.
                const lFileReadyPromise: Promise<void> = fetch(lCliConfigFilePath)
                    .then(async (lCliConfigFileRequest) => {
                        const lCliConfigFile: CliPackageConfiguration = await lCliConfigFileRequest.json();

                        // Add dependency to type list.
                        lCliPackages.set(lCliConfigFile.name, {
                            packageName: lPackageImport,
                            configuration: lCliConfigFile
                        });

                        // Resolve early when package was found.
                        if (pNameFilter === lCliConfigFile.name) {
                            lAlreadyResolved = true;
                            pResolve(lCliPackages);
                        }
                    }).catch(() => {
                        // eslint-disable-next-line no-console
                        console.warn(`Error reading cli config "${lPackageImport}"`);
                    });

                lFileReadingList.push(lFileReadyPromise);
            }

            // Wait for all file readings to finish.
            Promise.all(lFileReadingList).then(() => {
                // Dont resolve twice.
                if (lAlreadyResolved) {
                    return;
                }

                // Resolve all packages.
                pResolve(lCliPackages);
            });
        });
    }
}

export type CliPackageConfiguration = {
    name: string;
    commandEntryClass?: string;
    packageBlueprints?: {
        resolveClass: string;
        packages: Record<string, string>;
    };
};

export type CliPackageInformation = {
    packageName: string;
    configuration: CliPackageConfiguration;
};

type CliCommandConstructor = {
    new(): ICliCommand;
};

type CliPackageBlueprintResolverConstructor = {
    new(): ICliPackageBlueprintResolver;
};