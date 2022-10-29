import { FileUtil, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';

export class CliPackages {
    private readonly mCliRootPath: string;
    private readonly mCurrentWorkingDirectory: string;

    /**
     * Constructor.
     * @param pCurrentWorkingDirectory - Current working directory.
     * @param pCliRootPath - This cli root path.
     */
    public constructor(pCurrentWorkingDirectory: string, pCliRootPath: string) {
        this.mCurrentWorkingDirectory = pCurrentWorkingDirectory;
        this.mCliRootPath = pCliRootPath;
    }

    /**
     * Get all KG_Cli command packages sorted by cli package type.
     */
    public async getCommandPackages(): Promise<Record<string, Array<string>>> {
        // Read all dependencies.
        const lShell: Shell = new Shell(this.mCurrentWorkingDirectory);
        const lPackageJson = await lShell.result('npm ls --json --all', true);

        // Parse dependency json.
        let lPackageObject: any | null = null;
        try {
            lPackageObject = JSON.parse(lPackageJson);
        } catch (_pError) {
            throw `Package dependencies couldn't not be loaded.`;
        }

        // List own CLI dependencies on empty dependency list. 
        if (Object.keys(lPackageObject).length === 0) {
            // Read dependencies of this package.
            const lShell: Shell = new Shell(this.mCliRootPath);
            const lPackageJson = await lShell.result('npm ls --json --all');
            lPackageObject = JSON.parse(lPackageJson);
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
            const lPackagePath: string = require.resolve(lPackage);
            const lCliConfigFilePath = path.join(lPackagePath, 'kg-cli.config.json');

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
        Promise.all(lFileReadingList);

        return lCliPackages;
    }
}

type CliConfig = {
    group: string;
};