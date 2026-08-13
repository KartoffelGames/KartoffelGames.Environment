import { EnvironmentBundle, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand<BuildConfiguration> {
    /**
     * Output directory (relative to the package) for each build type.
     */
    private static readonly mOutputDirectoryByType: Record<string, Array<string>> = {
        bundle: ['library', 'bundle'],
        page: ['page', 'build']
    };

    /**
     * Command description.
     */
    public get information(): CliCommandDescription<BuildConfiguration> {
        return {
            command: {
                description: 'Build package files into distributable artifacts.',
                parameters: {
                    root: 'build',
                    optional: {
                        // Restrict the build to entries of a single build type.
                        type: {
                            shortName: 't'
                        },
                        // Inject the live-reload client into the bundle.
                        injectreload: {
                            shortName: 'r'
                        }
                    }
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
     * @param pParameter - Command parameter.
     */
    public async run(_pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Needs a package to build.
        if (pPackage === null) {
            throw new Error('Package to build not specified.');
        }

        const lConsole: Console = new Console();

        // Read the build configuration of the package.
        const lConfiguration: BuildConfiguration = pPackage.cliConfigurationOf(this);
        let lBuildEntryList: Array<[string, BuildConfigurationEntry]> = Object.entries(lConfiguration);

        // Restrict the build to a single type when the type parameter is set.
        const lTypeFilter: string | null = pParameter.has('type') ? pParameter.get('type') : null;
        if (lTypeFilter !== null) {
            lBuildEntryList = lBuildEntryList.filter(([, lBuildEntry]) => lBuildEntry.type === lTypeFilter);
        }

        // Skip when nothing is configured (or nothing matches the type filter) to build.
        if (lBuildEntryList.length === 0) {
            lConsole.writeLine('Nothing configured to build. Skip build.');
            return;
        }

        // The inject-reload flag injects the live-reload client into every built bundle.
        const lReloadEnabled: boolean = pParameter.has('injectreload');

        // Build every configured input file into its build type output directory.
        for (const [lInputFilePath, lBuildEntry] of lBuildEntryList) {
            // Resolve the output directory for the build type.
            const lOutputSubPath: Array<string> | undefined = KgCliCommand.mOutputDirectoryByType[lBuildEntry.type];
            if (!lOutputSubPath) {
                throw new Error(`Unknown build type "${lBuildEntry.type}" for input file "${lInputFilePath}".`);
            }

            const lOutputDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, ...lOutputSubPath);
            await this.buildEntry(pPackage, lInputFilePath, lBuildEntry.name, lOutputDirectory, lReloadEnabled);
        }

        lConsole.writeLine('Build successful');
    }

    /**
     * Build a single input file into a browser IIFE bundle and write it into the given output directory.
     * The output is written to `<outputDirectory>/<name>.js` together with its source map.
     *
     * When reload is enabled the input file is wrapped in a temporary entry file that prepends the live-reload
     * client and imports the real input file, so the produced bundle refreshes the browser once it is rebuilt.
     *
     * @param pPackage - Package the input file belongs to.
     * @param pInputFilePath - Local path of the input file inside the package.
     * @param pOutputName - Base name of the produced output file.
     * @param pOutputDirectory - Absolute directory the produced files are written into.
     * @param pReload - Whether to inject the live-reload client into the bundle.
     *
     * @throws {@link Error}
     * When the input file does not exist.
     */
    private async buildEntry(pPackage: Package, pInputFilePath: string, pOutputName: string, pOutputDirectory: string, pReload: boolean): Promise<void> {
        // Convert the input file path from local to absolute path.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Determine the entry file to bundle. Without reload the input file is bundled directly.
        let lEntryFilePath: string = lAbsoluteInputFilePath;
        let lTemporaryEntryFilePath: string | null = null;

        // When reload is enabled generate a temporary wrapper entry that injects the live-reload client.
        if (pReload) {
            // Read the live-reload client source shipped with this package.
            const lRefresherFileUrl: URL = new URL('./page-refresher.ts', import.meta.url);
            const lRefresherFileRequest: Response = await fetch(lRefresherFileUrl);
            const lRefresherFileText: string = await lRefresherFileRequest.text();

            // Build the wrapper entry outside the package so it never shows up in the users project. It prepends the
            // live-reload client and imports the real input file by absolute url.
            const lInputFileUrl: string = FileSystem.pathToFileUrl(lAbsoluteInputFilePath).href;
            const lEntryFileContent: string = `${lRefresherFileText}\nimport ${JSON.stringify(lInputFileUrl)};\n`;

            // Write the wrapper entry into the os temporary directory.
            lTemporaryEntryFilePath = Deno.makeTempFileSync({ suffix: '.bundle-entry.ts' });
            FileSystem.write(lTemporaryEntryFilePath, lEntryFileContent);
            lEntryFilePath = lTemporaryEntryFilePath;
        }

        try {
            // Bundle the entry file.
            const lEnvironmentBundle: EnvironmentBundle = new EnvironmentBundle();
            const lBundleOutput: EnvironmentBundleOutput = await lEnvironmentBundle.bundle(pPackage, {
                files: [{ inputFilePath: lEntryFilePath, outputBasename: pOutputName, outputExtension: 'js' }]
            });

            // Write the bundle output into the output directory.
            FileSystem.createDirectory(pOutputDirectory);
            for (const lOutput of lBundleOutput) {
                FileSystem.writeBinary(FileSystem.pathToAbsolute(pOutputDirectory, lOutput.fileName), lOutput.content);
                FileSystem.writeBinary(FileSystem.pathToAbsolute(pOutputDirectory, `${lOutput.fileName}.map`), lOutput.sourceMap);
            }
        } finally {
            // Remove the temporary wrapper entry.
            if (lTemporaryEntryFilePath !== null) {
                Deno.removeSync(lTemporaryEntryFilePath);
            }
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
