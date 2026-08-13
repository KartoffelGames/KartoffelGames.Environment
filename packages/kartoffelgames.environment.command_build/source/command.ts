import { EnvironmentBundle, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';
import { DesktopBuilder } from './desktop-builder.ts';

export class KgCliCommand implements ICliPackageCommand<BuildConfiguration> {
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
                        // Only produce the bundles, skip the (heavy) desktop packaging step.
                        'bundle-only': {
                            shortName: 'b'
                        },
                        // Inject the live-reload client into reloadable bundles.
                        injectreload: {
                            shortName: 'r'
                        }
                    }
                }
            },
            configuration: {
                name: 'build',
                // "desktop" is intentionally omitted from the default: the config merge would replace a configured
                // desktop object with a `null` default (differing object-ness overwrites). Absent desktop means disabled.
                default: {
                    files: {}
                }
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
        const lFileEntryList: Array<[string, BuildFile]> = Object.entries(lConfiguration.files ?? {});
        const lDesktop: DesktopConfiguration | null = lConfiguration.desktop ?? null;

        // Parameters.
        const lBundleOnly: boolean = pParameter.has('bundle-only');
        const lReloadEnabled: boolean = pParameter.has('injectreload');

        // Skip when nothing is configured to build (and the desktop step is disabled or skipped).
        if (lFileEntryList.length === 0 && (lBundleOnly || lDesktop === null)) {
            lConsole.writeLine('Nothing configured to build. Skip build.');
            return;
        }

        // Bundle every configured file into the shared page bundle directory.
        const lOutputDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'page', 'bundle');
        for (const [lInputFilePath, lFile] of lFileEntryList) {
            // The reload client is only injected when it was requested and the entry opts in via "reloadable".
            const lInjectReload: boolean = lReloadEnabled && lFile.reloadable === true;
            await this.bundleFile(pPackage, lInputFilePath, lFile.name, lOutputDirectory, lInjectReload);
        }

        // Build the desktop application unless only bundling was requested.
        if (!lBundleOnly && lDesktop !== null) {
            await new DesktopBuilder().build(pPackage, lDesktop);
        }

        lConsole.writeLine('Build successful');
    }

    /**
     * Bundle a single input file into a browser IIFE bundle and write it into the output directory.
     * The output is written to `<outputDirectory>/<name>.js` together with its source map.
     *
     * When reload is injected the input file is wrapped in a temporary entry file that prepends the live-reload
     * client and imports the real input file, so the produced bundle refreshes the browser once it is rebuilt.
     *
     * @param pPackage - Package the input file belongs to.
     * @param pInputFilePath - Local path of the input file inside the package.
     * @param pOutputName - Base name of the produced output file.
     * @param pOutputDirectory - Absolute directory the produced files are written into.
     * @param pInjectReload - Whether to inject the live-reload client into the bundle.
     *
     * @throws {@link Error}
     * When the input file does not exist.
     */
    private async bundleFile(pPackage: Package, pInputFilePath: string, pOutputName: string, pOutputDirectory: string, pInjectReload: boolean): Promise<void> {
        // Convert the input file path from local to absolute path.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Determine the entry file to bundle. Without reload the input file is bundled directly.
        let lEntryFilePath: string = lAbsoluteInputFilePath;
        let lTemporaryEntryFilePath: string | null = null;

        // When reload is injected generate a temporary wrapper entry that prepends the live-reload client.
        if (pInjectReload) {
            // Read the live-reload client source shipped with this package.
            const lReloadClientFileUrl: URL = new URL('./reload-client.ts', import.meta.url);
            const lReloadClientFileRequest: Response = await fetch(lReloadClientFileUrl);
            const lReloadClientFileText: string = await lReloadClientFileRequest.text();

            // Build the wrapper entry outside the package so it never shows up in the users project. It prepends the
            // live-reload client and imports the real input file by absolute url.
            const lInputFileUrl: string = FileSystem.pathToFileUrl(lAbsoluteInputFilePath).href;
            const lEntryFileContent: string = `${lReloadClientFileText}\nimport ${JSON.stringify(lInputFileUrl)};\n`;

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
    files?: Record<string, BuildFile>;
    desktop?: DesktopConfiguration | null;
};

export type BuildFile = {
    name: string;
    reloadable?: boolean;
};

export type DesktopConfiguration = {
    name: string;
    identifier: string;
    icons?: DesktopIconMap;
    output?: DesktopOutputMap;
    backend?: 'webview' | 'cef';
};

/**
 * Icon paths keyed by operating system. Icons are per-OS (format differs by OS), not per-architecture.
 */
export type DesktopIconMap = {
    windows?: string;
    macos?: string;
    linux?: string;
};

/**
 * Output paths keyed by build target. macOS is split by architecture because a single machine cross-compiles both
 * the Apple Silicon and the Intel binary, and each needs its own output path.
 */
export type DesktopOutputMap = {
    windows?: string;
    macosArm?: string;
    macosIntel?: string;
    linux?: string;
};
