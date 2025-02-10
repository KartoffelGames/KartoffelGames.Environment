import { CliCommand } from "../index.ts";
import { Import } from '../project/import.ts';
import { Project } from "../project/project.ts";
import { FileSystem } from '../system/file-system.ts';
import { ICliPackageCommand } from './i-cli-package-command.interface.ts';

/**
 * Cli packages. Resolves all available cli packages.
 */
export class CliPackages {
    private readonly mProject: Project;

    /**
     * Constructor.
     * 
     * @param pProject - Project handler.
     */
    public constructor(pProject: Project) {
        this.mProject = pProject;
    }

    /**
     * Create a new instance of a package command.
     * 
     * @param pName - Cli package information.
     * 
     * @returns - Cli package command instance. 
     */
    public async createCommand(pName: string): Promise<CliCommand> {
        // Read package command.
        const lPackageInformation: CliPackageInformation<CliCommandPackageConfiguration> | null = await this.read<CliCommandPackageConfiguration>(pName, 'command');
        if (lPackageInformation === null) {
            throw new Error(`Cli command package "${pName}" could not be found.`);
        }

        if (!lPackageInformation.configuration.commandEntryClass) {
            throw new Error(`Can't initialize command ${lPackageInformation.configuration.name}. No entry class defined.`);
        }

        // Catch any create errors for malfunctioning packages.
        const lPackageCommand: ICliPackageCommand = await (async () => {
            try {
                // Import package and get command constructor.
                const lPackageImport: any = await Import.import(lPackageInformation.packageName);
                const lPackageCliCommandConstructor: CliCommandConstructor = lPackageImport[lPackageInformation.configuration.commandEntryClass] as CliCommandConstructor;

                // Create command instance
                return new lPackageCliCommandConstructor();
            } catch (e) {
                throw new Error(`Can't initialize command ${lPackageInformation.configuration.name}. ${e}`);
            }
        })();

        // Create new command instance.
        return new CliCommand(this.mProject, lPackageCommand);
    }

    /**
     * Read information of a cli package.
     * 
     * @param pName - Cli command package name.
     * @param pType - Cli command package type.
     * 
     * @returns cli package information or null if not found.
     */
    public async read<TTypeValues extends Record<string, any> = {}>(pName: string, pType: string): Promise<CliPackageInformation<TTypeValues> | null> {
        // Read all packages with by a name filter.
        const lFoundPackages: Map<string, CliPackageInformation> = await this.readAvailableProjectCommandPackages(pName, pType);

        // Return found package.
        return lFoundPackages.get(pName) as CliPackageInformation<TTypeValues> ?? null;
    }

    /**
     * Read information of a cli package.
     * 
     * @param pType - Cli command package type.
     * 
     * @returns all available cli package informations of the provided type.s  
     */
    public async readAll<TTypeValues extends Record<string, any> = {}>(pType?: string): Promise<Array<CliPackageInformation<TTypeValues>>> {
        // Read all packages with by a name filter.
        const lFoundPackages: Map<string, CliPackageInformation> = await this.readAvailableProjectCommandPackages('', pType);

        // Return found package.
        return [...lFoundPackages.values()] as Array<CliPackageInformation<TTypeValues>>;
    }

    /**
     * Get all KG_Cli command packages sorted by cli package type.
     * Skip early when the provided package name is found.
     * 
     * @param pNameFilter - Filter for package name.
     * 
     * @returns Map of available cli packages.
     */
    private async readAvailableProjectCommandPackages(pNameFilter: string, pType?: string): Promise<Map<string, CliPackageInformation>> {
        // Find root of project and read the json.
        const lProjectRoot: string = Project.findRoot(this.mProject.rootDirectory);
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

        // TODO: How to make this linear?
        return new Promise<Map<string, CliPackageInformation>>((pResolve) => {
            // Flag to skip searching after a result was aready resolved.
            let lAlreadyResolved: boolean = false;

            // Filter packages for existsing cli config.
            const lFileReadingList: Array<Promise<void>> = new Array<Promise<void>>();

            // Try to read all packages.
            for (const lPackageImport of lPackageImports) {
                // Import "kg-cli.config.json" from package.
                const lCliConfigFilePath: URL = Import.resolveToUrl(`${lPackageImport}/kg-cli.config.json`);

                // Read cli configuration file as json.
                const lFileReadyPromise: Promise<void> = fetch(lCliConfigFilePath)
                    .then(async (lCliConfigFileRequest) => {
                        const lCliConfigFile: CliPackageConfiguration = await lCliConfigFileRequest.json();

                        // Skip when package type does not match.
                        if (pType && lCliConfigFile.type !== pType) {
                            return;
                        }

                        // Add dependency to type list.
                        lCliPackages.set(lCliConfigFile.name, {
                            packageName: lPackageImport,
                            configuration: lCliConfigFile
                        });

                        // Resolve early when a single package was found.
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

export type CliPackageConfiguration<TTypeValues extends Record<string, any> = {}> = TTypeValues & {
    type: string;
    name: string;
};

export type CliPackageInformation<TTypeValues extends Record<string, any> = {}> = {
    packageName: string;
    configuration: CliPackageConfiguration<TTypeValues>;
};

export type CliCommandPackageConfiguration = {
    commandEntryClass: string;
};

type CliCommandConstructor = {
    new(): ICliPackageCommand;
};