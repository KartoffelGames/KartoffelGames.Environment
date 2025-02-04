import { EnvironmentBundleOptions, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from "@kartoffelgames/environment-command-bundle";
import { CliCommandDescription, CliParameter, FileSystem, ICliCommand, PackageInformation, Process, Project } from '@kartoffelgames/environment-core';
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

        // Create all paths.
        const lTestInputDirectory = FileSystem.pathToAbsolute(lPackageInformation.directory, 'test');
        const lTestOutputDirectory = FileSystem.pathToAbsolute(lPackageInformation.directory, '.kg-test');
        const lBundleResultDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'bundle');
        const lBundleResultJavascriptFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js');
        const lBundleResultSourceMapFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js.map');
        const lCoverageFileDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'coverage');

        // Initialize test output directory.        
        if (!FileSystem.exists(lTestOutputDirectory)) {
            FileSystem.createDirectory(lTestOutputDirectory);
        }

        // Bundle result directory.    
        if (!FileSystem.exists(lBundleResultDirectory)) {
            FileSystem.createDirectory(lBundleResultDirectory);
        }

        // Bundle test files when bundle is required.
        if (lPackageConfiguration.bundleRequired) {
            // Read all .test.ts files from the test directory.
            const lTestFileList: Array<string> = FileSystem.findFiles(lTestInputDirectory, { include: { extensions: ['ts'] } });

            // Create bundle input content with all imports.
            let lTestBundleContent: string = '';
            for (const lTestFile of lTestFileList) {
                const lRelativeTestFilePath: string = FileSystem.pathToRelative(lTestInputDirectory, lTestFile);

                // Add import to bundle content.
                lTestBundleContent += `import "${lRelativeTestFilePath}";\n`;
            }

            // Create bundle command.
            const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

            // Run bundle.
            const lBundleResult: EnvironmentBundleOutput = await lMainBundleCommand.bundle(pProjectHandler, lPackageName, (pOptions: EnvironmentBundleOptions) => {
                // Override entry file with the test bundle.ts
                pOptions.entry = {
                    content: {
                        inputResolveDirectory: lTestInputDirectory,
                        inputFileContent: lTestBundleContent,
                        outputBasename: 'bundle.test',
                        outputExtension: 'js'
                    }
                };
            });

            // Write source files.
            FileSystem.writeBinary(lBundleResultJavascriptFile, lBundleResult[0].content);
            FileSystem.writeBinary(lBundleResultSourceMapFile, lBundleResult[0].sourceMap);
        }

        // Create coverage directory.
        if (!FileSystem.exists(lCoverageFileDirectory)) {
            FileSystem.createDirectory(lCoverageFileDirectory);
        }

        // Create test with coverage command extension.
        const lTestWithCoverageCommand: Array<string> = [];
        if (lCoverageEnabled) {
            const lRelativeCoverageFileDirectory: string = FileSystem.pathToRelative(lPackageInformation.directory, lCoverageFileDirectory);
            lTestWithCoverageCommand.push(`--coverage=${lRelativeCoverageFileDirectory}`);
        }

        // Eighter test the test directory or the bundle result directory when bundle is required.
        let lTestFilesDirectory: string = `test/`;
        if (lPackageConfiguration.bundleRequired) {
            lTestFilesDirectory = FileSystem.pathToRelative(lPackageInformation.directory, lBundleResultJavascriptFile);
        }

        // Create test command parameter.
        const lTestCommandParameter: ProcessParameter = new ProcessParameter(lPackageInformation.directory, [
            'deno', 'test', '-A', lTestFilesDirectory, ...lTestWithCoverageCommand
        ]);

        // Run "deno test" command in current console process.
        const lTestProcess: Process = new Process();
        await lTestProcess.executeInConsole(lTestCommandParameter);

        // TODO: When coverage is on, run 'deno coverage' command.
        if (lCoverageEnabled) {
            const lRelativeCoverageFileDirectory: string = FileSystem.pathToRelative(lPackageInformation.directory, lCoverageFileDirectory);

            const lCoverageCommandParameter: ProcessParameter = new ProcessParameter(lPackageInformation.directory, [
                'deno', 'coverage', lRelativeCoverageFileDirectory, '--include=source/'
            ]);

            // Run "deno coverage" command in current console process.
            const lCoverageProcess: Process = new Process();
            await lCoverageProcess.executeInConsole(lCoverageCommandParameter);
        }

        // Remove test output directory.
        FileSystem.deleteDirectory(lTestOutputDirectory);
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