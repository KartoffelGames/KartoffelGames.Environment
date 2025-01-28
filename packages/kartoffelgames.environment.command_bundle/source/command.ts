import { EnvironmentBundle, EnvironmentBundleOutput, EnvironmentSettingFiles } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, Project } from '@kartoffelgames/environment-core';

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

        // Create empty EnvironmentSettingFiles.
        const lEnvironmentSettingFiles: EnvironmentSettingFiles = {
            moduleDeclarationFilePath: null,
            bundleSettingsFilePath: null
        };

        // Set module declaration file path if exists.
        const lModuleDeclarationFilePath = FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.moduleDeclaration);
        if (lPackageConfiguration.moduleDeclaration.trim() !== '') {
            // Check for file exists.
            if (!FileSystem.exists(lModuleDeclarationFilePath)) {
                throw new Error(`Module declaration file not found: ${lModuleDeclarationFilePath}`);
            }
            
            lEnvironmentSettingFiles.moduleDeclarationFilePath = lModuleDeclarationFilePath;
        }

        // Set bundle settings file path if exists.
        const lBundleSettingsFilePath = FileSystem.pathToAbsolute(lPackagePath, lPackageConfiguration.bundleSettings);
        if (lPackageConfiguration.bundleSettings.trim() !== '') {
            // Check for file exists.
            if (!FileSystem.exists(lBundleSettingsFilePath)) {
                throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
            }

            lEnvironmentSettingFiles.bundleSettingsFilePath = lBundleSettingsFilePath;
        }

        // Start bundling.
        const lBundleResult: EnvironmentBundleOutput = await new EnvironmentBundle().bundleProject(pProjectHandler, lPackageInformation, lEnvironmentSettingFiles);

        // Output build warn console.
        for (const lOutput of lBundleResult.console.errors) {
            lConsole.writeLine(lOutput, 'yellow');
        }

        // Output build error console.
        for (const lOutput of lBundleResult.console.errors) {
            lConsole.writeLine(lOutput, 'red');
        }

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
            FileSystem.writeBinary(lMapFilePath, lOutput.soureMap);
        }

        lConsole.writeLine('Bundle successful');
    }
}

type BundleConfiguration = {
    enabled: boolean;
    moduleDeclaration: string;
    bundleSettings: string;
};