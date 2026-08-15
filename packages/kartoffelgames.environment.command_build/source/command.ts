import { EnvironmentBundle, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, Process, ProcessParameter, type Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand<BuildConfiguration> {
    /**
     * Operating system of each supported desktop target triple.
     * Used to pick the per-OS icon and to alias a `raw` macOS output to an `app` bundle.
     */
    private static readonly DESKTOP_TARGET_OS: Record<string, DesktopTargetOs> = {
        'x86_64-pc-windows-msvc': 'windows',
        'aarch64-pc-windows-msvc': 'windows',
        'x86_64-apple-darwin': 'macos',
        'aarch64-apple-darwin': 'macos',
        'x86_64-unknown-linux-gnu': 'linux',
        'aarch64-unknown-linux-gnu': 'linux'
    };

    /**
     * Desktop extensions and their os restrictions.
     */
    private static readonly DESKTOP_TARGET_OS_EXTENSIONS: Record<DesktopTargetOs, Partial<Record<DesktopExtension, DesktopExtensionRestriction>>> = {
        'windows': {
            'raw': { name: 'raw', alias: [], type: 'directory' },
            'msi': { name: 'msi', alias: [], type: 'file' }
        },
        'macos': {
            'app': { name: 'app', alias: ['raw'], type: 'directory' },
            'dmg': { name: 'dmg', alias: [], type: 'file' }
        },
        'linux': {
            'raw': { name: 'raw', alias: [], type: 'directory' },
            'appimage': { name: 'appimage', alias: [], type: 'file' },
            'deb': { name: 'deb', alias: [], type: 'file' },
            'rpm': { name: 'rpm', alias: [], type: 'file' }
        }
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
                        // Comma-separated build types to build (e.g. "page,bundle"). Omitted builds everything.
                        types: {
                            shortName: 't'
                        },
                        // Inject the live-reload client into "page" type entries.
                        injectreload: {
                            shortName: 'r'
                        }
                    }
                }
            },
            configuration: {
                name: 'build',
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

        // Determine which build types to produce. Without "--types" everything is built.
        const lRequestedTypes: Set<string> = (() => {
            if (!pParameter.has('types')) {
                return new Set<string>();
            }

            // Chain, because cli performance doesnt matter.
            const lConvertedTypes: Array<string> = pParameter.get('types').split(',').map((pItem) => {
                return pItem.trim();
            }).filter((pItem) => {
                return pItem !== '';
            });

            return new Set<string>(lConvertedTypes);
        })();

        // Only build the entries whose type was requested, or every entry when no "--types" filter is set.
        const lFileEntryList: Array<[lFilepath: string, BuildFile]> = (() => {
            const lConfiguratedFiles: Array<[string, BuildFile]> = Object.entries(lConfiguration.files ?? {});

            // Nothing is filtered.
            if (lRequestedTypes.size === 0) {
                return lConfiguratedFiles;
            }

            return lConfiguratedFiles.filter(([_, lFile]) => {
                return lRequestedTypes.has(lFile.type);
            });
        })();

        // Skip when nothing is configured to build.
        if (lFileEntryList.length === 0) {
            lConsole.writeLine('Nothing configured to build. Skip build.');
            return;
        }

        // Parameters.
        const lReloadEnabled: boolean = pParameter.has('injectreload');

        // Build every configured entry according to its type.
        for (const [lInputFilePath, lFile] of lFileEntryList) {
            lConsole.writeLine('');
            lConsole.writeLine(`Building ${lFile.type} entry "${lInputFilePath}"...`);

            switch (lFile.type) {
                // A "page" and a "bundle" entry are both browser bundles. Only a "page" entry receives the live-reload client, and only when requested.
                case 'page':
                case 'bundle': {
                    // The reload client is only injected when requested and the entry is a "page".
                    const lInjectReload: boolean = lReloadEnabled && lFile.type === 'page';

                    await this.bundleFile(pPackage, lInputFilePath, lFile.output, lInjectReload);

                    lConsole.writeLine(`Bundled into "${lFile.output}".`);
                    break;
                }

                // A "desktop" entry is compiled into a native application via "deno desktop".
                case 'desktop': {
                    await this.buildDesktop(pPackage, lInputFilePath, lFile);
                    break;
                }

                // An entry with an unrecognized "type".
                default: {
                    throw new Error(`Unknown build type "${(lFile as BuildFile).type}" for entry "${lInputFilePath}".`);
                }
            }
        }

        lConsole.writeLine('');
        lConsole.writeLine('Build successful');
    }

    /**
     * Bundle a single input file into a browser IIFE and write `<output directory>/<name>.js` plus its source map.
     *
     * When reload is injected, the input is wrapped in a temporary entry that prepends the live-reload client and
     * imports the real file, so the bundle refreshes the browser after each rebuild.
     *
     * @param pPackage - Package the input file belongs to.
     * @param pInputFilePath - Local path of the input file inside the package.
     * @param pOutput - Configured output path, including the filename (e.g. `./page/bundle/app.js`).
     * @param pInjectReload - Whether to inject the live-reload client into the bundle.
     *
     * @throws {@link Error}
     * When no output path is configured or the input file does not exist.
     */
    private async bundleFile(pPackage: Package, pInputFilePath: string, pOutput: string, pInjectReload: boolean): Promise<void> {
        // The output path (including the filename) is configured per entry.
        if (!pOutput) {
            throw new Error(`Build entry "${pInputFilePath}" has no "output" path configured.`);
        }

        // Convert the input file path from local to absolute path.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Split the output path into directory and basename (without extension). The bundle is emitted as
        // `<basename>.js` (+ `.map`) into that directory.
        const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, pOutput);
        const lOutputDirectory: string = FileSystem.directoryOfFile(lAbsoluteOutput);
        const lOutputFileName: string = FileSystem.fileOfPath(lAbsoluteOutput);
        const lDotIndex: number = lOutputFileName.lastIndexOf('.');
        const lOutputName: string = lDotIndex < 0 ? lOutputFileName : lOutputFileName.substring(0, lDotIndex);

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
                files: [{ inputFilePath: lEntryFilePath, outputBasename: lOutputName, outputExtension: 'js' }]
            });

            // Write the bundle output into the output directory.
            FileSystem.createDirectory(lOutputDirectory);
            for (const lOutput of lBundleOutput) {
                FileSystem.writeBinary(FileSystem.pathToAbsolute(lOutputDirectory, lOutput.fileName), lOutput.content);
                FileSystem.writeBinary(FileSystem.pathToAbsolute(lOutputDirectory, `${lOutput.fileName}.map`), lOutput.sourceMap);
            }
        } finally {
            // Remove the temporary wrapper entry.
            if (lTemporaryEntryFilePath !== null) {
                Deno.removeSync(lTemporaryEntryFilePath);
            }
        }
    }

    /**
     * Resolve a configured desktop output into a build target. The target triple selects the operating system, and the
     * requested extension is resolved against {@link DESKTOP_TARGET_OS_EXTENSIONS} for that OS: it must be a supported
     * extension or an alias of one (e.g. on macOS `raw` is an alias for `app`). The resolved extension and its
     * restriction decide the output shape (a plain directory, a bundle directory or a packaged file).
     *
     * @param pTriple - Target triple (e.g. `x86_64-pc-windows-msvc`).
     * @param pOutput - Configured output location for the triple.
     *
     * @returns The resolved build target.
     *
     * @throws {@link Error}
     * When the triple is unknown or the requested extension is not supported for the target operating system.
     */
    private resolveDesktopTarget(pTriple: string, pOutput: DesktopOutput): ResolvedDesktopTarget {
        // Operating system of the target triple.
        const lTargetOs: DesktopTargetOs | undefined = KgCliCommand.DESKTOP_TARGET_OS[pTriple];
        if (!lTargetOs) {
            throw new Error(`Unknown desktop target triple "${pTriple}". Valid triples are: ${Object.keys(KgCliCommand.DESKTOP_TARGET_OS).join(', ')}.`);
        }

        // Requested extension, defaulting to "raw".
        const lRequestedExtension: string = (pOutput.extension ?? 'raw').toLowerCase();

        // Resolve the requested extension against the target OS. It matches a supported extension directly or as one of
        // its aliases (e.g. macOS "raw" resolves to "app").
        const lOsExtensions: Partial<Record<DesktopExtension, DesktopExtensionRestriction>> = KgCliCommand.DESKTOP_TARGET_OS_EXTENSIONS[lTargetOs];
        for (const [lExtension, lRestriction] of Object.entries(lOsExtensions) as Array<[DesktopExtension, DesktopExtensionRestriction]>) {
            if (lExtension === lRequestedExtension || lRestriction.alias.includes(lRequestedExtension as DesktopExtension)) {
                return { triple: pTriple, os: lTargetOs, directory: pOutput.directory, extension: lRestriction };
            }
        }

        // The requested extension is not supported for this operating system.
        throw new Error(`Unsupported desktop output extension "${lRequestedExtension}" for target "${pTriple}". Supported extensions: ${Object.keys(lOsExtensions).join(', ')}.`);
    }

    /**
     * Build a native desktop application from a single entry file using `deno desktop`, one build per configured output
     * target.
     *
     * A dedicated `desktop-build-deno.json` (a copy of the package `deno.json` with the desktop app metadata injected
     * under `desktop.app`, plus the optional `backend`) is written next to the package `deno.json`. `deno desktop` reads
     * the name, identifier and backend from it via `--config`, and running from the package directory keeps the
     * package's own import resolution intact. Target, icon and output are passed as flags.
     *
     * `deno desktop --target` cross-compiles, so every configured output target is built regardless of the host
     * platform.
     *
     * @param pPackage - Package the desktop app belongs to.
     * @param pInputFilePath - Local path of the desktop entry file inside the package.
     * @param pConfiguration - Desktop build entry configuration.
     *
     * @throws {@link Error}
     * When the entry file does not exist, an include directory is missing, a target triple is unknown, an output
     * extension is unsupported, or an include is combined with a packaged (file) output.
     */
    private async buildDesktop(pPackage: Package, pInputFilePath: string, pConfiguration: BuildFileDesktop): Promise<void> {
        const lConsole: Console = new Console();

        // The entry file compiled into the desktop binary must exist.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Validate the configured include directories up-front so a misconfiguration fails before the heavy build.
        const lIncludes: Array<BuildFileDesktopInclude> = pConfiguration.include ?? [];
        for (const lInclude of lIncludes) {
            const lIncludeDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, lInclude.directory);
            if (!FileSystem.pathInformation(lIncludeDirectory).isDirectory) {
                throw new Error(`Desktop include directory "${lIncludeDirectory}" does not exist.`);
            }
        }

        // Read every configured output target, keyed by its target triple. Nothing configured means nothing to do.
        const lOutputEntries: Array<[string, DesktopOutput]> = Object.entries(pConfiguration.output ?? {});
        if (lOutputEntries.length === 0) {
            lConsole.writeLine('No desktop output configured. Skip desktop.', 'yellow');
            return;
        }

        // Resolve every configured target. "deno desktop --target" cross-compiles, so every configured target is built
        // regardless of the host platform.
        const lTargets: Array<ResolvedDesktopTarget> = lOutputEntries.map(([lTriple, lOutput]) => {
            return this.resolveDesktopTarget(lTriple, lOutput);
        });

        // Includes are copied into the produced artifact, which only works for a directory-shaped output (a "raw"
        // directory or a macOS "app" bundle). Reject includes for any packaged (file) output up-front.
        if (lIncludes.length > 0) {
            for (const lTarget of lTargets) {
                if (lTarget.extension.type !== 'directory') {
                    throw new Error(`Desktop target "${lTarget.triple}" produces a "${lTarget.extension.name}" file but the entry has "include" files. Includes are only supported for directory outputs (e.g. "raw" or "app").`);
                }
            }
        }

        // Write the desktop build config next to the package deno.json: a copy with the desktop app metadata injected.
        // It sits in the package directory so import resolution is unchanged, and deno desktop reads the app
        // name/identifier and backend from it via --config. It holds no target information; the target is selected per
        // build via --target.
        const lPackageConfigurationPath: string = FileSystem.pathToAbsolute(pPackage.directory, 'deno.json');
        const lDesktopConfigurationPath: string = FileSystem.pathToAbsolute(pPackage.directory, 'desktop-build-deno.json');
        const lPackageConfiguration: Record<string, unknown> = JSON.parse(FileSystem.read(lPackageConfigurationPath));
        const lDesktopConfiguration: Record<string, unknown> = {
            app: {
                name: pConfiguration.name,
                identifier: pConfiguration.identifier
            }
        };

        // Rendering backend. Defaults to deno desktop's default when omitted.
        if (pConfiguration.backend) {
            lDesktopConfiguration['backend'] = pConfiguration.backend;
        }

        lPackageConfiguration['desktop'] = lDesktopConfiguration;
        FileSystem.write(lDesktopConfigurationPath, JSON.stringify(lPackageConfiguration, null, 4));

        try {
            // Build every configured target.
            for (const lTarget of lTargets) {
                // The absolute output path. A "raw" output is the directory itself, every other extension appends
                // ".<extension>" to it (the last path segment of the directory is treated as the artifact name).
                const lBaseAbsolute: string = FileSystem.pathToAbsolute(pPackage.directory, lTarget.directory);
                const lAbsoluteOutput: string = lTarget.extension.name === 'raw' ? lBaseAbsolute : `${lBaseAbsolute}.${lTarget.extension.name}`;

                // Assemble the deno desktop command.
                const lCommandParts: Array<string> = ['deno', 'desktop', '-A', '--config', lDesktopConfigurationPath, '--target', lTarget.triple];

                // Output path of the produced application.
                lCommandParts.push('--output', lAbsoluteOutput);

                // Application icon for the target's operating system.
                const lIcon: string | undefined = (pConfiguration.icons ?? {})[lTarget.os];
                if (lIcon) {
                    lCommandParts.push('--icon', FileSystem.pathToAbsolute(pPackage.directory, lIcon));
                }

                // The entry file to compile (script argument comes last).
                lCommandParts.push(lAbsoluteInputFilePath);

                lConsole.writeLine(`Building desktop app "${pConfiguration.name}" for "${lTarget.triple}"...`);
                await new Process().executeInConsole(new ProcessParameter(pPackage.directory, lCommandParts));

                // Copy the configured include directories into this target's output so the running application can read them next to its executable. 
                if (lIncludes.length > 0) {
                    const lIncludeRoot: string = (() => {
                        // For an "app" bundle the executable lives in "Contents/MacOS", so the includes are copied there.
                        if(lTarget.extension.name === 'app'){
                            return FileSystem.pathToAbsolute(lAbsoluteOutput, 'Contents', 'MacOS');
                        }

                        // For a "raw" output that is the output directory itself. 
                        return  lAbsoluteOutput;
                    })();
                    this.copyDesktopIncludes(pPackage.directory, lIncludeRoot, lIncludes);
                }
            }
        } finally {
            // Always remove the generated desktop build configuration.
            if (FileSystem.exists(lDesktopConfigurationPath)) {
                Deno.removeSync(lDesktopConfigurationPath);
            }
        }
    }

    /**
     * Copy the configured include directories into a desktop output directory.
     * Each is copied, preserving its own directory and file name.
     * Only files matching one of the include's `filter` glob patterns are copied.
     *
     * @param pPackageDirectory - Package directory the include directories are resolved against.
     * @param pOutputDirectory - Desktop output directory the include directories are copied into.
     * @param pIncludes - Configured include directories.
     */
    private copyDesktopIncludes(pPackageDirectory: string, pOutputDirectory: string, pIncludes: Array<BuildFileDesktopInclude>): void {
        for (const lInclude of pIncludes) {
            const lIncludeDirectory: string = FileSystem.pathToAbsolute(pPackageDirectory, lInclude.directory);
            const lIncludeName: string = FileSystem.fileOfPath(lIncludeDirectory);

            // Collect the files to copy. Without a filter, every file in the directory. Otherwise every file matching
            // any filter pattern, deduplicated.
            const lMatchedFiles: Array<string> = (() => {
                if (!lInclude.filter || lInclude.filter.length === 0) {
                    return FileSystem.findFiles(lIncludeDirectory);
                }

                // Concat all filtered files. Use a set to remove duplicates.
                const lFilteredFiles: Set<string> = new Set<string>();
                for (const lPattern of lInclude.filter) {
                    for (const lFile of FileSystem.glob(lIncludeDirectory, lPattern)) {
                        lFilteredFiles.add(lFile);
                    }
                }

                return [...lFilteredFiles];
            })();

            // Copy every matched file into "<output>/<include name>/<path relative to the include directory>".
            for (const lFile of lMatchedFiles) {
                const lRelativePath: string = FileSystem.pathToRelative(lIncludeDirectory, lFile);
                const lDestination: string = FileSystem.pathToAbsolute(pOutputDirectory, lIncludeName, lRelativePath);
                FileSystem.createDirectory(FileSystem.directoryOfFile(lDestination));
                FileSystem.copyFile(lFile, lDestination);
            }
        }
    }
}

export type BuildConfiguration = {
    files?: Record<string, BuildFile>;
};

/**
 * Selectable build type.
 */
export type BuildType = 'page' | 'bundle' | 'desktop';

/**
 * A single build entry, discriminated by its `type`.
 */
export type BuildFile = BuildFilePage | BuildFileBundle | BuildFileDesktop;

/**
 * A "page" entry. A browser bundle that receives the live-reload client under `--injectreload`.
 */
export type BuildFilePage = {
    type: 'page';

    /**
     * Output path of the produced bundle, including the filename (e.g. `./page/bundle/app.js`).
     */
    output: string;
};

/**
 * A "bundle" entry. A browser bundle that never receives the live-reload client (e.g. a worker).
 */
export type BuildFileBundle = {
    type: 'bundle';

    /**
     * Output path of the produced bundle, including the filename (e.g. `./page/bundle/worker.js`).
     */
    output: string;
};

/**
 * A "desktop" entry. A native desktop application compiled from its entry file (the record key) via `deno desktop`.
 */
export type BuildFileDesktop = {
    type: 'desktop';

    /**
     * Application display name.
     */
    name: string;

    /**
     * Reverse-DNS application id.
     */
    identifier: string;

    /**
     * Per-OS icon paths.
     */
    icons?: DesktopIconMap;

    /**
     * Output configuration for each build target, keyed by the target triple passed to `deno desktop --target`.
     */
    output?: DesktopOutputMap;

    /**
     * Rendering backend. Defaults to `deno desktop`'s default when omitted.
     */
    backend?: 'webview' | 'cef' | 'raw';

    /**
     * Directories copied into every produced desktop output after the build,
     * so the running application can read them as real files (e.g. the website files served by the app).
     */
    include?: Array<BuildFileDesktopInclude>;
};

/**
 * A directory copied into a desktop output, preserving its own name into `<output>/<directory name>/`. `filter`
 * selects which files inside it are copied.
 */
export type BuildFileDesktopInclude = {
    /**
     * Directory whose matching files are copied into every desktop output (e.g. `./page`).
     */
    directory: string;

    /**
     * Optional glob patterns (globstar) selecting which files inside `directory` are copied. A file is copied when it
     * matches any pattern (e.g. `["**\/*.js", "**\/*.html", "**\/*.css"]`). When omitted or empty, every file is copied.
     */
    filter?: Array<string>;
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
 * Output configuration keyed by the target triple passed to `deno desktop --target` (e.g. `x86_64-pc-windows-msvc`).
 * Every configured target is built, cross-compiled from the host.
 */
export type DesktopOutputMap = Record<string, DesktopOutput>;

/**
 * A single desktop output target.
 */
export type DesktopOutput = {
    /**
     * Output directory. Its last path segment is the produced artifact's name. A packaged extension writes the artifact
     * as `<directory>.<extension>`, `raw` uses the directory itself as the output.
     */
    directory: string;

    /**
     * Produced artifact kind. `raw` produces a plain directory without extension (on macOS an alias for `app`). Any
     * other value is used as the output file extension (e.g. `app`, `dmg`, `msi`, `deb`). Defaults to `raw`.
     */
    extension?: string;
};

type DesktopTargetOs = 'windows' | 'macos' | 'linux';

/**
 * A resolved desktop build target: the target triple, its operating system, the output directory and the resolved extension.
 */
type ResolvedDesktopTarget = {
    triple: string;
    os: DesktopTargetOs;
    directory: string;
    extension: DesktopExtensionRestriction;
};

type DesktopExtension = 'raw' | "app" | "dmg" | "msi" | "appimage" | "deb" | "rpm";

type DesktopExtensionRestriction = {
    name: DesktopExtension,
    alias: Array<DesktopExtension>,
    type: 'file' | 'directory';
};