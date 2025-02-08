import { EnvironmentBundle, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, Import, Project } from '@kartoffelgames/environment-core';
import { EnvironmentBundleOptions } from "@kartoffelgames/environment-bundle";

export class KgCliCommand implements ICliPackageCommand<BundleConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<BundleConfiguration> {
        return {
            command: {
                description: 'Bundle package',
                name: 'bundle',
                parameters: ['<package_name>'],
                flags: ['force'],
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
     * @param pProjectHandler - Project handling.
     */
    public async run(pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        // Read cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');
        const lForceBundle: boolean = <boolean>pParameter.flags.has('force');

        // Read package information and build config. 
        // Configuration is filled up with default information.
        const lPackageInformation = pProjectHandler.getPackage(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

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
        const lBundleResult: EnvironmentBundleOutput = await this.bundle(pProjectHandler, lPackageName);

        // Create output file directory.
        const lBuildOutput: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'library');
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
     * @param pProjectHandler - Project handling. 
     * @param pPackageName - Package name to bundle.
     * @param pOverrideCallback  - Override functionality of bundle options.
     * 
     * @returns Bundle output.
     */
    public async bundle(pProjectHandler: Project, pPackageName: string, pOverrideCallback?: (pOptions: EnvironmentBundleOptions) => (EnvironmentBundleOptions | void)): Promise<EnvironmentBundleOutput> {
        // Read package information and build config. 
        // Configuration is filled up with default information.
        const lPackageInformation = pProjectHandler.getPackage(pPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

        // Construct paths.
        const lPackagePath = lPackageInformation.directory;

        // Create environment bundle object.
        const lEnvironmentBundle = new EnvironmentBundle();

        // Load local bundle settings.
        let lBundleOptions: Partial<EnvironmentBundleOptions> = await (async () => {
            const lBundleSettingsFilePath = FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.bundleSettingsFile);
            if (lPackageConfiguration.bundleSettingsFile.trim() !== '') {
                // Check for file exists.
                if (!FileSystem.exists(lBundleSettingsFilePath)) {
                    throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
                }

                // Check for file exists.
                if (!FileSystem.exists(lBundleSettingsFilePath)) {
                    throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
                }

                // Import bundle as js file.
                const lBundleSettingObject: { default: EnvironmentBundleOptions; } = await Import.import(`file://${lBundleSettingsFilePath}`);

                return lBundleSettingObject.default;
            }

            // Use default settings.
            return {};
        })();

        // Extend bundle files options when information was not set.
        if (!lBundleOptions.entry) {
            lBundleOptions.entry = {
                files: [
                    {
                        inputFilePath: './source/index.ts',
                        outputBasename: '<packagename>',
                        outputExtension: 'js'
                    }
                ]
            };
        }

        // Extend bundle loader when information was not set.
        if (!lBundleOptions.loader) {
            lBundleOptions.loader = {}; // Default loader.
        }

        // Extend bundle plugins when information was not set.
        if (!lBundleOptions.plugins) {
            lBundleOptions.plugins = []; // Default plugins.
        }

        // Allow override of bundle options.
        if (pOverrideCallback) {
            lBundleOptions = pOverrideCallback(lBundleOptions as EnvironmentBundleOptions) || lBundleOptions;
        }

        // Start bundling.
        return await lEnvironmentBundle.bundle(lPackageInformation, lBundleOptions as EnvironmentBundleOptions);
    }
}

type BundleConfiguration = {
    enabled: boolean;
    bundleSettingsFile: string;
};