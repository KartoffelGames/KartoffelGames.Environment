import { EnvironmentBundle, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
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
                    enabled: false,
                    bundleSettingsFile: ''
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
        const lPackageConfiguration = await pPackage.cliConfigurationOf(this);

        const lConsole = new Console();

        // Skip anything when bundling is disabled.
        if (!lPackageConfiguration.enabled && !lForceBundle) {
            lConsole.writeLine(`Bundling disabled, Skip bundling.`);
            return;
        } else if (lForceBundle) {
            // Message forced bundling.
            lConsole.writeLine(`Forced bundling.`);
        }

        // Start bundling.
        const lBundleResult: EnvironmentBundleOutput = await this.bundle(pPackage);

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
    private async bundle(pPackage: Package): Promise<EnvironmentBundleOutput> {
        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage.cliConfigurationOf(this);

        // Construct paths.
        const lPackagePath = pPackage.directory;

        // Create environment bundle object.
        const lEnvironmentBundle = new EnvironmentBundle();

        // Load local bundle settings.
        const lBundleSettingsFilePath: string | null = lPackageConfiguration.bundleSettingsFile.trim() !== '' ? FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.bundleSettingsFile) : null;
        const lBundleOptions: Partial<EnvironmentBundleOptions> = await lEnvironmentBundle.loadBundleOptions(lBundleSettingsFilePath);

        // Extend bundle files options when information was not set.
        if (Array.isArray(lBundleOptions.files) && lBundleOptions.files.length === 0) {
            lBundleOptions.files = [
                {
                    inputFilePath: './source/index.ts',
                    outputBasename: '<packagename>',
                    outputExtension: 'js'
                }
            ];
        }

        // Extend bundle loader when information was not set.
        if (!lBundleOptions.loader) {
            lBundleOptions.loader = {}; // Default loader.
        }

        // Extend bundle plugins when information was not set.
        if (!lBundleOptions.plugins) {
            lBundleOptions.plugins = []; // Default plugins.
        }

        // Start bundling.
        return lEnvironmentBundle.bundle(pPackage, lBundleOptions as EnvironmentBundleOptions);
    }
}

type BundleConfiguration = {
    enabled: boolean;
    bundleSettingsFile: string;
};