import { CliCommand } from '../index.ts';
import { Import } from '../project/import.ts';
import { Project } from '../project/project.ts';
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
    public async read<TTypeValues extends Record<string, any> = object>(pName: string, pType: string): Promise<CliPackageInformation<TTypeValues> | null> {
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
    public async readAll<TTypeValues extends Record<string, any> = object>(pType?: string): Promise<Array<CliPackageInformation<TTypeValues>>> {
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
        const lProjectRoot: string = Project.findRoot(this.mProject.directory);
        const lProjectRootPackageJsonString: string = FileSystem.read(`${lProjectRoot}/deno.json`);
        const lProjectRootPackageJson: any = JSON.parse(lProjectRootPackageJsonString);

        // Read all available package imports.
        const lPackageImports: Array<string> | undefined = lProjectRootPackageJson['kg']?.['cli'];

        // Skip when no cli packages are defined.
        if (!lPackageImports) {
            return new Map<string, CliPackageInformation>();
        }

        // Promise list stored all read processes of each package information.
        const lReadPackageInformationList: Array<Promise<CliPackageInformation>> = new Array<Promise<CliPackageInformation>>();

        // Read all cli packages in seperate promises.
        for (const lPackageImport of lPackageImports) {
            // Import "kg-cli.config.json" from package.
            const lCliConfigFileImportPath: string = `${lPackageImport}/kg-cli.config.json`;

            // Read cli configuration file as json.
            const lCliPackageInformationPromise: Promise<CliPackageInformation> = Import.importJson(lCliConfigFileImportPath)
                .then(async (pCliConfigFileModule) => {
                    const lCliConfigFile: any = pCliConfigFileModule.default;

                    // Skip when package type does not match.
                    if (pType && lCliConfigFile.type !== pType) {
                        throw new Error('Package skipped, type does not match.');
                    }

                    // Skip when package name does not match.
                    if (pNameFilter.trim() !== '' && pNameFilter !== lCliConfigFile.name) {
                        throw new Error('Package skipped, name does not match.');
                    }

                    return {
                        packageName: lPackageImport,
                        configuration: lCliConfigFile
                    };
                });

            lReadPackageInformationList.push(lCliPackageInformationPromise);
        }

        // Early resolve the quickest found package when name is filtered.
        if (pNameFilter.trim() !== '') {
            const lFoundPackage: CliPackageInformation = await Promise.any(lReadPackageInformationList);
            return new Map<string, CliPackageInformation>([[lFoundPackage.configuration.name, lFoundPackage]]);
        }

        // Wait for all packages to be read.
        const lFailablePackagePromiseList: Array<Promise<CliPackageInformation | null>> = lReadPackageInformationList.map(async (pPromise) => {
            return pPromise.catch(() => null);
        });
        const lFoundPackageList: Array<CliPackageInformation | null> = await Promise.all(lFailablePackagePromiseList);

        // All found cli packages.
        const lCliPackages: Map<string, CliPackageInformation> = new Map<string, CliPackageInformation>();
        for (const lCliPackageInformation of lFoundPackageList) {
            // Filter out all packages that could not be read.
            if (lCliPackageInformation === null) {
                continue;
            }

            lCliPackages.set(lCliPackageInformation.configuration.name, lCliPackageInformation);
        }

        return lCliPackages;
    }
}

export type CliPackageConfiguration<TTypeValues extends Record<string, any> = object> = TTypeValues & {
    type: string;
    name: string;
};

export type CliPackageInformation<TTypeValues extends Record<string, any> = object> = {
    packageName: string;
    configuration: CliPackageConfiguration<TTypeValues>;
};

export type CliCommandPackageConfiguration = {
    commandEntryClass: string;
};

type CliCommandConstructor = {
    new(): ICliPackageCommand;
};