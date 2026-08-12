import { EnvironmentBundle, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand<BuildConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<BuildConfiguration> {
        return {
            command: {
                description: 'Build package files into distributable artifacts.',
                parameters: {
                    root: 'build'
                }
            },
            configuration: {
                name: 'build',
                default: {}
            }
        };
    }

    /**
     * Execute command.
     *
     * @param _pProject - Project.
     * @param pPackage - Package the command is applied to.
     * @param _pParameter - Command parameter.
     */
    public async run(_pProject: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to build.
        if (pPackage === null) {
            throw new Error('Package to build not specified.');
        }

        const lConsole: Console = new Console();

        // Read the build configuration of the package.
        const lConfiguration: BuildConfiguration = pPackage.cliConfigurationOf(this);
        const lBuildEntryList: Array<[string, BuildConfigurationEntry]> = Object.entries(lConfiguration);

        // Skip when nothing is configured to build.
        if (lBuildEntryList.length === 0) {
            lConsole.writeLine('Nothing configured to build. Skip build.');
            return;
        }

        // Build every configured input file by its build type.
        for (const [lInputFilePath, lBuildEntry] of lBuildEntryList) {
            switch (lBuildEntry.type) {
                case 'bundle':
                    await this.buildBundle(pPackage, lInputFilePath, lBuildEntry.name);
                    break;
                default:
                    throw new Error(`Unknown build type "${lBuildEntry.type}" for input file "${lInputFilePath}".`);
            }
        }

        lConsole.writeLine('Build successful');
    }

    /**
     * Build a single input file with the "bundle" type and write it into the packages library directory.
     * The output is written to `<package>/library/bundle/<name>.js` together with its source map.
     *
     * @param pPackage - Package the input file belongs to.
     * @param pInputFilePath - Local path of the input file inside the package.
     * @param pOutputName - Base name of the produced output file.
     *
     * @throws {@link Error}
     * When the input file does not exist.
     */
    private async buildBundle(pPackage: Package, pInputFilePath: string, pOutputName: string): Promise<void> {
        // Convert the input file path from local to absolute path.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Bundle the input file.
        const lEnvironmentBundle: EnvironmentBundle = new EnvironmentBundle();
        const lBundleOutput: EnvironmentBundleOutput = await lEnvironmentBundle.bundle(pPackage, {
            files: [{ inputFilePath: lAbsoluteInputFilePath, outputBasename: pOutputName, outputExtension: 'js' }]
        });

        // Write the bundle output into the packages library type directory.
        const lOutputDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'library', 'bundle');
        FileSystem.createDirectory(lOutputDirectory);
        for (const lOutput of lBundleOutput) {
            FileSystem.writeBinary(FileSystem.pathToAbsolute(lOutputDirectory, lOutput.fileName), lOutput.content);
            FileSystem.writeBinary(FileSystem.pathToAbsolute(lOutputDirectory, `${lOutput.fileName}.map`), lOutput.sourceMap);
        }
    }
}

export type BuildConfiguration = {
    [inputFilePath: string]: BuildConfigurationEntry;
};

type BuildConfigurationEntry = {
    name: string;
    type: string;
};
