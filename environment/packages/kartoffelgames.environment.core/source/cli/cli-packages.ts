import { Process } from '../process/process';
import { FileSystem } from '../system/file-system';
import { ProcessParameter } from '../process/process-parameter';
import { Package } from '../project/package';

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
     * Get all KG_Cli command packages sorted by cli package type.
     * Skip early when the provided package name is found.
     * 
     * @param pNameFilter - Filter for package name.
     * 
     * @returns Map of available cli packages.
     */
    public async getCommandPackages(pNameFilter: string = ''): Promise<Map<string, CliPackageInformation>> {
        // Create process parameter to read all all dependencies and execute.
        const lProcessParameters: ProcessParameter = new ProcessParameter(this.mCommandRootPackageDirectory, ['npm', 'ls', '--json', '--all']);
        const lPackageJson = await new Process().execute(lProcessParameters, true);

        // Parse dependency json.
        let lPackageObject: any | null = null;
        try {
            lPackageObject = JSON.parse(lPackageJson);
        } catch (_pError) {
            throw `Package dependencies couldn't not be loaded.`;
        }

        // Recursive dependency object search.
        const lListPackages = (pPackageJson: Record<string, any>, pPackageList: Array<string> = []) => {
            if ('dependencies' in pPackageJson) {
                const lDependencies: Record<string, any> = pPackageJson['dependencies'];

                // Index all dependencies.
                for (const lDependency of Object.entries(lDependencies)) {
                    const [lPackageName, lConfiguration] = lDependency;

                    // Index packages and find inner dependencies of package.
                    pPackageList.push(lPackageName);
                    lListPackages(lConfiguration, pPackageList);
                }
            }

            return pPackageList;
        };

        // List all packages and distinct list.
        const lPackageNameList: Array<string> = [...new Set(lListPackages(lPackageObject))];

        // New promise that resolves eighter when package with the given name is found or all packages are checked.
        return new Promise<Map<string, CliPackageInformation>>((pResolve) => {
            // Flag to skip searching after a result was aready resolved.
            let lAlreadyResolved: boolean = false;

            // Filter packages for existsing cli config.
            const lCliPackages: Map<string, CliPackageInformation> = new Map<string, CliPackageInformation>();
            const lFileReadingList: Array<Promise<void>> = new Array<Promise<void>>();
            for (const lPackageName of lPackageNameList) {
                // Try to find cli configuration file from package root directory.
                let lCliConfigFilePath: string | null = null;
                try {
                    lCliConfigFilePath = Package.resolveToPath(`${lPackageName}/kg-cli.config.json`);
                } catch (_pError) {
                    // Nothing.
                }

                // Config not found.
                if (lCliConfigFilePath === null) {
                    continue;
                }

                // Check if cli configuration exists.
                if (FileSystem.exists(lCliConfigFilePath)) {
                    // Read async and parse json.
                    const lFileReadyPromise = FileSystem.readAsync(lCliConfigFilePath).then((pData) => {
                        // Skip processing when the searched package was already found.
                        if (lAlreadyResolved) {
                            return;
                        }

                        // Parse cli package configuration.
                        const lCliPackageConfiguration: CliPackageConfiguration = JSON.parse(pData);

                        // Add dependency to type list.
                        lCliPackages.set(lCliPackageConfiguration.name, {
                            packageName: lPackageName,
                            configuration: lCliPackageConfiguration
                        });

                        // Resolve early when package was found.
                        if (pNameFilter === lCliPackageConfiguration.name) {
                            lAlreadyResolved = true;
                            pResolve(lCliPackages);
                        }
                    }).catch(() => {
                        // eslint-disable-next-line no-console
                        console.warn(`Error reading cli config "${lPackageName}"`);
                    });

                    lFileReadingList.push(lFileReadyPromise);
                }
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
    commandEntyClass?: string;
    projectBlueprints?: Array<string>;
    packageBlueprints?: Array<string>;
};

export type CliPackageInformation = {
    packageName: string;
    configuration: CliPackageConfiguration;
};