import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, Process, ProcessParameter, type Project } from '@kartoffelgames/environment-core';

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
                        },
                        detailed: {
                            shortName: 'd'
                        },
                        inspect: {
                            shortName: 'i'
                        }
                    }
                },
            },
            configuration: {
                name: 'test',
                default: {
                    directory: './test'
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
    public async run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
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
        const lTestInputDirectory = FileSystem.pathToAbsolute(pPackage.directory, lPackageConfiguration.directory);
        const lTestOutputDirectory = FileSystem.pathToAbsolute(pPackage.directory, '.kg-test');
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

        // Find the package test and source directory.
        const lRelativeTestDirectory: string = FileSystem.pathToRelative(pPackage.directory, lTestInputDirectory).slice(2).replace(/\\/g, '/');
        const lTestFilesDirectory: string = `${lRelativeTestDirectory}/**/*.ts`;

        // Add inspect command when inspect is enabled.
        const lTestInspectCommand: Array<string> = pParameter.has('inspect') ? ['--inspect-wait=0.0.0.0:9229'] : [];

        // Test failed flag to throw error only at the end.
        let lTestFailed: boolean = false;

        // Create test command parameter.
        const lTestCommandParameter: ProcessParameter = new ProcessParameter(pPackage.directory, [
            'deno', 'test', '-A', ...lTestInspectCommand, lTestFilesDirectory, ...lTestWithCoverageCommand
        ]);

        // Run "deno test" command in current console process.
        const lTestProcess: Process = new Process();
        await lTestProcess.executeInConsole(lTestCommandParameter).catch(() => {
            lTestFailed = true;
        });

        // When coverage is on, run 'deno coverage' command.
        if (lCoverageEnabled) {
            const lRelativeCoverageFileDirectory: string = FileSystem.pathToRelative(pPackage.directory, lCoverageFileDirectory);

            // Get package directory base name.
            const lPackageDirectoryBaseName: string = FileSystem.pathInformation(pPackage.directory).basename;
            const lPackageSourceDirectory: string = FileSystem.pathToRelative(pPackage.directory, pPackage.sourceDirectory);

            // Get the relative source direcory from project root of the package with correct format
            const lAbsoluteSourceDirectory: string = FileSystem.pathToAbsolute(pProject.packagesDirectory, lPackageDirectoryBaseName, lPackageSourceDirectory);
            const lRelativeSouceDirectory: string = FileSystem.pathToRelative(pProject.directory, lAbsoluteSourceDirectory).slice(2).replace(/\\/g, '/');

            // Set detailed coverage parameter when command parameter was set.
            const lDetailedParameter: Array<string> = pParameter.has('detailed') ? ['--detailed'] : new Array<string>();

            // Create coverage command parameter.
            const lCoverageCommandParameter: ProcessParameter = new ProcessParameter(pPackage.directory, [
                'deno', 'coverage', lRelativeCoverageFileDirectory, `--include=${lRelativeSouceDirectory}`, ...lDetailedParameter
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
    directory: string;
};