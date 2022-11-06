import { FileUtil, Shell } from '@kartoffelgames/environment.core';

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
     */
    public async getCommandPackages(): Promise<Record<string, Array<string>>> {
        // Read all dependencies.
        const lShell: Shell = new Shell(this.mCommandRootPackageDirectory);
        const lPackageJson = await lShell.result('npm ls --json --all', true);

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
                    const [lName, lConfiguration] = lDependency;

                    // Index packages and find inner dependencies of package.
                    pPackageList.push(lName);
                    lListPackages(lConfiguration, pPackageList);
                }
            }

            return pPackageList;
        };

        // List all packages and distinct list.
        const lPackageList: Array<string> = [...new Set(lListPackages(lPackageObject))];

        // Filter packages for existsing cli config.
        const lCliPackages: Record<string, Array<string>> = {};
        const lFileReadingList: Array<Promise<void>> = new Array<Promise<void>>();
        for (const lPackage of lPackageList) {
            // Try to find cli config.
            let lCliConfigFilePath: string | null = null;
            try {
                lCliConfigFilePath = require.resolve(`${lPackage}/kg-cli.config.json`);
            } catch (_pError) {
                // Nothing.
            }

            // Config not found.
            if (lCliConfigFilePath === null) {
                continue;
            }

            // Check if cli config exists.
            if (FileUtil.exists(lCliConfigFilePath)) {
                // Read async and parse json.
                const lFileReadyPromise = FileUtil.readAsync(lCliConfigFilePath).then((pData) => {
                    const lJson: CliConfig = JSON.parse(pData);

                    // Init type list.
                    if (!(lJson.group in lCliPackages)) {
                        lCliPackages[lJson.group] = new Array<string>();
                    }

                    // Add dependency to type list.
                    lCliPackages[lJson.group].push(lPackage);
                }).catch(() => {
                    // eslint-disable-next-line no-console
                    console.warn(`Error reading cli config "${lPackage}"`);
                });

                lFileReadingList.push(lFileReadyPromise);
            }
        }

        // Wait for all file readings to finish.
        await Promise.all(lFileReadingList);

        return lCliPackages;
    }
}

type CliConfig = {
    group: string;
};