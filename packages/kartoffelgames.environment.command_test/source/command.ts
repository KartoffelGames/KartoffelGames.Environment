import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Process, Project } from '@kartoffelgames/environment-core';
import { KgCliCommand as MainBundleCommand } from "@kartoffelgames/environment-command-bundle";
import { EnvironmentBundleInputContent, EnvironmentBundleOptions, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { ProcessParameter } from "../../kartoffelgames.environment.core/source/index.ts";

export class KgCliCommand implements ICliCommand<TestConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<TestConfiguration> {
        return {
            command: {
                description: 'Test package',
                name: 'test',
                parameters: ['<package_name>'],
                flags: ['coverage'],
            },
            configuration: {
                name: 'test',
                default: {
                    bundleRequired: false
                },
            }
        };
    }

    /**
     * Execute command.
     * 
     * @param pParameter - Command parameter.
     * @param pProjectHandler - Project.
     */
    public async run(pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');
        const lCoverageEnabled: boolean = pParameter.flags.has('coverage');

        // Read package information and bundle config. 
        // Configuration is filled up with default information.
        const lPackageInformation: PackageInformation = pProjectHandler.getPackageInformation(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

        // initialize test directory.
        this.initialTestDirectory(lPackageInformation);

        // Initialize test output directory.
        const lTestOutputDirectory = FileSystem.pathToAbsolute(lPackageInformation.directory, '.kg-test');
        if (!FileSystem.exists(lTestOutputDirectory)) {
            FileSystem.createDirectory(lTestOutputDirectory);
        }

        // Bundle result directory.
        const lBundleResultDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'bundle');
        if (!FileSystem.exists(lBundleResultDirectory)) {
            FileSystem.createDirectory(lBundleResultDirectory);
        }

        // Bundle test files when bundle is required.
        if (lPackageConfiguration.bundleRequired) {
            // Create bundle command.
            const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

            // Run bundle.
            const lBundleResult: EnvironmentBundleOutput = await lMainBundleCommand.bundle(pProjectHandler, lPackageName, (pOptions: EnvironmentBundleOptions) => {
                // TODO: Create bundle stdin from any test.ts file found inside the test directory.
                
                // Override entry file with the test bundle.ts
                pOptions.entry = {
                    files: [
                        {
                            inputFilePath: './test/bundle.ts',
                            outputBasename: 'bundle.test',
                            outputExtension: 'js'
                        }
                    ]
                };
            });

            // Write source file.
            const lPageJsFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js');
            FileSystem.writeBinary(lPageJsFile, lBundleResult[0].content);

            // Write source map file.
            const lPageJsMapFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js.map');
            FileSystem.writeBinary(lPageJsMapFile, lBundleResult[0].sourceMap);
        }

        // Create coverage directory.
        const lCoverageFileDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'coverage');
        if (!FileSystem.exists(lCoverageFileDirectory)) {
            FileSystem.createDirectory(lCoverageFileDirectory);
        }

        // Create test with coverage command extension.
        const lTestWithCoverageCommand: Array<string> = [];
        if (lCoverageEnabled) {
            lTestWithCoverageCommand.push('--coverage', `"${lCoverageFileDirectory}"`.replace(/\\/g, '/'));
        }

        // Eighter test the test directory or the bundle result directory when bundle is required.
        let lTestFilesDirectory: string = `test/`;
        if (lCoverageEnabled) {
            lTestFilesDirectory = `"${lBundleResultDirectory}"`;
        }
        lTestFilesDirectory = lTestFilesDirectory.replace(/\\/g, '/');

        // Create test command parameter.
        const lTestCommandParameter: ProcessParameter = new ProcessParameter(lPackageInformation.directory, [
            'deno', 'test', lTestFilesDirectory, ...lTestWithCoverageCommand
        ]);

        // Run "deno test" command in current console process.
        const lTestProcess: Process = new Process();
        await lTestProcess.executeInConsole(lTestCommandParameter);

        // TODO: Create test directory.

        // TODO: When coverage is on, run 'deno coverage' command.
    }

    /**
     * Initialize test directory.
     * 
     * @param pPackageInformation - Package information.
     */
    private initialTestDirectory(pPackageInformation: PackageInformation): void {
        const lTestDirectory: string = FileSystem.pathToAbsolute(pPackageInformation.directory, 'test');

        // Create test directory when not exists.
        if (!FileSystem.exists(lTestDirectory)) {
            FileSystem.createDirectory(lTestDirectory);
        }
    }
}

type TestConfiguration = {
    bundleRequired: boolean;
};