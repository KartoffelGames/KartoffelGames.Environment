import { EnvironmentBundle, EnvironmentBundleExtentionLoader, EnvironmentBundleOutput, EnvironmentBundleSettings } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, Package, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliCommand<BundleConfiguration> {
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
                    moduleDeclaration: '',
                    bundleSettings: ''
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

        const lConsole = new Console();

        // Read package information and build config. 
        // Configuration is filled up with default information.
        const lPackageInformation = pProjectHandler.getPackageInformation(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

        // Skip anything when bundling is disabled.
        if (!lPackageConfiguration.enabled && !lForceBundle) {
            lConsole.writeLine(`Bundling disabled, Skip bundling.`);
            return;
        } else if (lForceBundle) {
            // Message forced bundling.
            lConsole.writeLine(`Forced bundling.`);
        }

        // Construct paths.
        const lPackagePath = lPackageInformation.directory;

        // Create environment bundle object.
        const lEnvironmentBundle = new EnvironmentBundle();

        // Load local resolver from module declaration
        let lLoader: EnvironmentBundleExtentionLoader = (() => {
            const lModuleDeclarationFilePath = FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.moduleDeclaration);
            if (lPackageConfiguration.moduleDeclaration.trim() !== '') {
                // Check for file exists.
                if (!FileSystem.exists(lModuleDeclarationFilePath)) {
                    throw new Error(`Module declaration file not found: ${lModuleDeclarationFilePath}`);
                }

                // Read module declaration file content.
                const lModuleDeclarationFileContent = FileSystem.read(lModuleDeclarationFilePath);

                // Read module declaration text from file.
                return lEnvironmentBundle.fetchLoaderFromModuleDeclaration(lModuleDeclarationFileContent);
            }

            // Use empty / default loader.
            return {};
        })();

        // Load local bundle settings.
        const lBundleSettings: EnvironmentBundleSettings = await (async () => {
            const lBundleSettingsFilePath = FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.bundleSettings);
            if (lPackageConfiguration.bundleSettings.trim() !== '') {
                // Check for file exists.
                if (!FileSystem.exists(lBundleSettingsFilePath)) {
                    throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
                }

                // Check for file exists.
                if (!FileSystem.exists(lBundleSettingsFilePath)) {
                    throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
                }

                // Import bundle as js file.
                const lBundleSettingObject: { default: EnvironmentBundleSettings; } = await Package.import(`file://${lBundleSettingsFilePath}`);

                return lBundleSettingObject.default;
            }

            // Use default settings.
            return {
                inputFiles: [{
                    path: './source/index.ts',
                    basename: '<packagename>',
                    extension: 'js'
                }]
            };
        })();

        // Start bundling.
        const lBundleResult: EnvironmentBundleOutput = await lEnvironmentBundle.bundlePackage(lPackageInformation, lBundleSettings, lLoader);

        // Create output file directory.
        const lBuildOutput: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'library');
        FileSystem.createDirectory(lBuildOutput);

        // Output build result.
        for (const lOutput of lBundleResult.files) {
            // Write content file.
            const lContentFilePath = FileSystem.pathToAbsolute(lBuildOutput, lOutput.fileName);
            FileSystem.writeBinary(lContentFilePath, lOutput.content);

            // Write map file.
            const lMapFilePath = FileSystem.pathToAbsolute(lBuildOutput, `${lOutput.fileName}.map`);
            FileSystem.writeBinary(lMapFilePath, lOutput.sourceMap);
        }

        lConsole.writeLine('Bundle successful');
    }
}

type BundleConfiguration = {
    enabled: boolean;
    moduleDeclaration: string;
    bundleSettings: string;
};