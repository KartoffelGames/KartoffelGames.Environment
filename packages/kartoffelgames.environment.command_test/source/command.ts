import { EnvironmentBundleOptions, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from "@kartoffelgames/environment-command-bundle";
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, Package, Process, Project } from '@kartoffelgames/environment-core';
import { ProcessParameter } from "../../kartoffelgames.environment.core/source/index.ts";

export class KgCliCommand implements ICliPackageCommand<TestConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<TestConfiguration> {
        return {
            command: {
                description: 'Test package',
                parameters: {
                    root: 'test',
                    required: [],
                    optional: {
                        coverage: {
                            shortName: 'c'
                        }
                    }
                },
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
     * @param pProject - Project.
     */
    public async run(_pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Needs a package to run test.
        if (pPackage === null) {
            throw new Error('Package to run test not specified.');
        }

        // Cli parameter.
        const lCoverageEnabled: boolean = pParameter.has('coverage');

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage?.cliConfigurationOf(this);

        // initialize test directory.
        this.initialTestDirectory(pPackage);

        // Create all paths.
        const lTestInputDirectory = FileSystem.pathToAbsolute(pPackage.directory, 'test');
        const lSourceInputDirectory = FileSystem.pathToAbsolute(pPackage.directory, 'source');
        const lTestOutputDirectory = FileSystem.pathToAbsolute(pPackage.directory, '.kg-test');
        const lBundleResultDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'bundle');
        const lBundleResultJavascriptFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js');
        const lBundleResultSourceMapFile: string = FileSystem.pathToAbsolute(lBundleResultDirectory, 'bundle.test.js.map');
        const lCoverageFileDirectory = FileSystem.pathToAbsolute(lTestOutputDirectory, 'coverage');
        const lConsole: Console = new Console();

        // Skip testing when no test files are specified.
        if (FileSystem.findFiles(lTestInputDirectory, { include: { extensions: ['ts'] } }).length === 0) {
            lConsole.writeLine('No test files found.', 'yellow');
            return;
        }

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
            const lSourceFileList: Array<string> = FileSystem.findFiles(lSourceInputDirectory, { include: { extensions: ['ts'] } });

            // Create bundle input content with all imports.
            let lTestBundleContent: string = '';
            for (const lTestFile of [...lTestFileList, ...lSourceFileList]) {
                const lRelativePath: string = FileSystem.pathToRelative(lTestInputDirectory, lTestFile).replace(/\\/g, '/');

                // Add import to bundle content.
                lTestBundleContent += `import "${lRelativePath}";\n`;
            }

            // Create bundle command.
            const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

            // Run bundle.
            const lBundleResult: EnvironmentBundleOutput = await lMainBundleCommand.bundle(pPackage, (pOptions: EnvironmentBundleOptions) => {
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
            const lRelativeCoverageFileDirectory: string = FileSystem.pathToRelative(pPackage.directory, lCoverageFileDirectory);
            lTestWithCoverageCommand.push(`--coverage=${lRelativeCoverageFileDirectory}`);
        }

        // Eighter test the test directory or the bundle result directory when bundle is required.
        let lTestFilesDirectoryList: Array<string> = [];
        if (lPackageConfiguration.bundleRequired) {
            lTestFilesDirectoryList.push(FileSystem.pathToRelative(pPackage.directory, lBundleResultJavascriptFile));
        } else {
            lTestFilesDirectoryList.push(`test/**/*.ts`);
            lTestFilesDirectoryList.push(`source/**/*.ts`);
        }

        // Test failed flag to throw error only at the end.
        let lTestFailed: boolean = false;

        // Create test command parameter.
        const lTestCommandParameter: ProcessParameter = new ProcessParameter(pPackage.directory, [
            'deno', 'test', '-A', ...lTestFilesDirectoryList, ...lTestWithCoverageCommand
        ]);

        // Run "deno test" command in current console process.
        const lTestProcess: Process = new Process();
        await lTestProcess.executeInConsole(lTestCommandParameter).catch(() => {
            lTestFailed = true;
        });

        // Somehow tell that coverage does not work for bundled tests... for now. 
        if (lCoverageEnabled && lPackageConfiguration.bundleRequired) {
            lConsole.writeLine('Coverage is not supported for bundled tests.', 'yellow');
        }

        // When coverage is on, run 'deno coverage' command.
        if (lCoverageEnabled && !lPackageConfiguration.bundleRequired) {
            const lRelativeCoverageFileDirectory: string = FileSystem.pathToRelative(pPackage.directory, lCoverageFileDirectory);

            // Get package directory base name.
            const lPackageDirectoryBaseName: string = FileSystem.pathInformation(pPackage.directory).basename;

            // Create coverage command parameter.
            const lCoverageCommandParameter: ProcessParameter = new ProcessParameter(pPackage.directory, [
                'deno', 'coverage', lRelativeCoverageFileDirectory, `--include=packages/${lPackageDirectoryBaseName}/source/`
            ]);

            // Run "deno coverage" command in current console process.
            const lCoverageProcess: Process = new Process();
            await lCoverageProcess.executeInConsole(lCoverageCommandParameter).catch(() => {
                lTestFailed = true;
            });
        }

        // Remove test output directory.
        FileSystem.deleteDirectory(lTestOutputDirectory);

        // Throw error when test failed.
        if (lTestFailed) {
            throw new Error('Test failed.');
        }
    }

    /**
     * Initialize test directory.
     * 
     * @param pPackage - Package.
     */
    private initialTestDirectory(pPackage: Package): void {
        const lTestDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'test');

        // Create test directory when not exists.
        if (!FileSystem.exists(lTestDirectory)) {
            FileSystem.createDirectory(lTestDirectory);
        }
    }
}

type TestConfiguration = {
    bundleRequired: boolean;
};