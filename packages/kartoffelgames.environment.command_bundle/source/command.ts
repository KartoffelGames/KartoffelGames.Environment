import { EnvironmentBundle, EnvironmentBundleInputFile, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand<BundleConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<BundleConfiguration> {
        return {
            command: {
                description: 'Bundle package',
                parameters: {
                    root: 'bundle',
                    optional: {
                        force: {
                            shortName: 'f'
                        }
                    }
                }
            },
            configuration: {
                name: 'bundle',
                default: {
                    files: {}
                },
            }
        };
    }

    /**
     * Execute command.
     * 
     * @param pParameter - Command parameter.
     * @param pProject - Project handling.
     */
    public async run(_pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Needs a package to run page.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli parameter.
        const lForceBundle: boolean = <boolean>pParameter.has('force');

        // Read cli configuration from cli package.
        const lPackageConfiguration: BundleConfiguration = await pPackage.cliConfigurationOf(this);

        const lConsole = new Console();

        // Skip anything when bundling is disabled.
        if (Object.keys(lPackageConfiguration.files).length === 0 && !lForceBundle) {
            lConsole.writeLine(`Bundling disabled, Skip bundling.`);
            return;
        } else if (lForceBundle) {
            // Message forced bundling.
            lConsole.writeLine(`Forced bundling.`);
        }

        // Start bundling.
        const lBundleResult: EnvironmentBundleOutput = await this.bundle(pPackage, lPackageConfiguration);

        // Create output file directory.
        const lBuildOutput: string = FileSystem.pathToAbsolute(pPackage.directory, 'library');
        FileSystem.createDirectory(lBuildOutput);

        // Output build result.
        for (const lOutput of lBundleResult) {
            // Write content file.
            const lContentFilePath = FileSystem.pathToAbsolute(lBuildOutput, lOutput.fileName);
            FileSystem.writeBinary(lContentFilePath, lOutput.content);

            // Write map file.
            const lMapFilePath = FileSystem.pathToAbsolute(lBuildOutput, `${lOutput.fileName}.map`);
            FileSystem.writeBinary(lMapFilePath, lOutput.sourceMap);
        }

        lConsole.writeLine('Bundle successful');
    }

    /**
     * Bundle package with the bundle options specified in the package deno.json.
     * 
     * @param pPackage - Package bundle.
     * @param pOverrideCallback  - Override functionality of bundle options.
     * 
     * @returns Bundle output.
     */
    private async bundle(pPackage: Package, pConfiguration: BundleConfiguration): Promise<EnvironmentBundleOutput> {
        // Create environment bundle object.
        const lEnvironmentBundle = new EnvironmentBundle();

        // Extend bundle files options when information was not set.
        if (Object.keys(pConfiguration.files).length === 0) {
            pConfiguration.files = {
                '<packagename>': './source/index.ts'
            };
        }

        // Load local bundle settings.
        const lBundleOptions: Partial<EnvironmentBundleOptions> = {
            files: new Array<EnvironmentBundleInputFile>()
        };

        // Map configuration files to bundle options.
        for (const [lOutputBasename, lInputFilePath] of Object.entries(pConfiguration.files)) {
            // Convert the input file path from local to absolute path.
            const lAbsoluteInputFilePath = FileSystem.pathToAbsolute(pPackage.directory, lInputFilePath);

            // Check if the input file exists.
            if (!FileSystem.exists(lAbsoluteInputFilePath)) {
                throw new Error(`Input file "${lAbsoluteInputFilePath}" does not exist.`);
            }

            lBundleOptions.files?.push({
                outputBasename: lOutputBasename,
                inputFilePath: lAbsoluteInputFilePath,
                outputExtension: 'js'
            });
        }

        // Start bundling.
        return lEnvironmentBundle.bundle(pPackage, lBundleOptions as EnvironmentBundleOptions);
    }
}

type BundleConfiguration = {
    files: Record<string, string>;
};