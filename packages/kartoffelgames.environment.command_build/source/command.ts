import { EnvironmentBundle, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, Process, ProcessParameter, type Project } from '@kartoffelgames/environment-core';

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
                        // Comma-separated list of build types to build (e.g. "page,bundle"). When omitted, everything
                        // configured is built.
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

        // Parameters.
        const lReloadEnabled: boolean = pParameter.has('injectreload');

        // Determine which build types to produce. Without "--types" everything configured is built; with it only the
        // listed types are built. The value is a comma-separated list of build types (e.g. "page,bundle").
        const lTypeFilterEnabled: boolean = pParameter.has('types');
        const lRequestedTypes: Set<BuildType> = this.parseBuildTypes(lTypeFilterEnabled ? pParameter.get('types') : null);

        // Only build the file entries whose type was requested (or every entry when no "--types" filter is set).
        const lFileEntryList: Array<[string, BuildFile]> = Object.entries(lConfiguration.files ?? {})
            .filter(([, lFile]: [string, BuildFile]) => !lTypeFilterEnabled || lRequestedTypes.has(lFile.type));

        // Skip when nothing is configured to build.
        if (lFileEntryList.length === 0) {
            lConsole.writeLine('Nothing configured to build. Skip build.');
            return;
        }

        // Build every configured entry according to its type.
        for (const [lInputFilePath, lFile] of lFileEntryList) {
            switch (lFile.type) {
                // A "page" and a "bundle" entry are both browser bundles; only a "page" entry receives the live-reload
                // client (and only when requested).
                case 'page':
                case 'bundle': {
                    // The output path (including the filename) is configured per entry.
                    if (!lFile.output) {
                        throw new Error(`Build entry "${lInputFilePath}" has no "output" path configured.`);
                    }

                    // The reload client is only injected when requested and the entry is a "page" (a "bundle" never gets it).
                    const lInjectReload: boolean = lReloadEnabled && lFile.type === 'page';

                    // Split the configured output path into its directory and its basename (without extension); the bundle
                    // is always emitted as `<basename>.js` (+ `.map`) into that directory.
                    const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, lFile.output);
                    const lOutputDirectory: string = FileSystem.directoryOfFile(lAbsoluteOutput);
                    const lOutputFileName: string = FileSystem.fileOfPath(lAbsoluteOutput);
                    const lDotIndex: number = lOutputFileName.lastIndexOf('.');
                    const lOutputName: string = lDotIndex < 0 ? lOutputFileName : lOutputFileName.substring(0, lDotIndex);

                    await this.bundleFile(pPackage, lInputFilePath, lOutputName, lOutputDirectory, lInjectReload);
                    break;
                }

                // A "desktop" entry is compiled into a native application via "deno desktop".
                case 'desktop': {
                    await this.buildDesktop(pPackage, lInputFilePath, lFile);
                    break;
                }
            }
        }

        lConsole.writeLine('Build successful');
    }

    /**
     * Parse the comma-separated `--types` value into a set of build types.
     *
     * @param pRawTypes - Raw comma-separated types value, or null when no "--types" filter was set.
     *
     * @returns The set of requested build types. Empty when no filter was set.
     *
     * @throws {@link Error}
     * When an unknown build type is requested, or when the filter is set but resolves to no valid type.
     */
    private parseBuildTypes(pRawTypes: string | null): Set<BuildType> {
        const lRequestedTypes: Set<BuildType> = new Set<BuildType>();

        // No filter set: an empty set means "build everything".
        if (pRawTypes === null) {
            return lRequestedTypes;
        }

        for (const lRawType of pRawTypes.split(',')) {
            // Ignore empty segments produced by stray or trailing commas.
            const lType: string = lRawType.trim();
            if (lType === '') {
                continue;
            }

            // Validate against the known build types.
            if (lType !== 'page' && lType !== 'bundle' && lType !== 'desktop') {
                throw new Error(`Unknown build type "${lType}". Valid build types are: page, bundle, desktop.`);
            }

            lRequestedTypes.add(lType);
        }

        // A set "--types" filter must resolve to at least one valid type.
        if (lRequestedTypes.size === 0) {
            throw new Error('Parameter "--types" needs at least one build type.');
        }

        return lRequestedTypes;
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

    /**
     * Build a native desktop application from a single entry file using `deno desktop`.
     *
     * A dedicated `desktop-build-deno.json` is written next to the package's `deno.json`: a copy of the package
     * configuration with the desktop app metadata (name, identifier) injected under a `desktop.app` block. `deno
     * desktop` reads name/identifier from it via `--config`, while running from the package directory keeps the
     * package's own module/import resolution intact. Backend, icon and output are passed as command-line flags.
     *
     * Unlike the previous implementation this does not spin up an http server or embed the `page` directory; it just
     * compiles the given entry file.
     *
     * `deno desktop` produces host-platform binaries only, so only the configured output targets whose OS/arch match
     * this host are built; the others are skipped and must be built on their own OS (e.g. a CI matrix).
     *
     * @param pPackage - Package the desktop app belongs to.
     * @param pInputFilePath - Local path of the desktop entry file inside the package.
     * @param pConfiguration - Desktop build entry configuration.
     *
     * @throws {@link Error}
     * When the entry file does not exist.
     */
    private async buildDesktop(pPackage: Package, pInputFilePath: string, pConfiguration: BuildFileDesktop): Promise<void> {
        const lConsole: Console = new Console();

        // The entry file compiled into the desktop binary must exist.
        const lAbsoluteInputFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, pInputFilePath);
        if (!FileSystem.exists(lAbsoluteInputFilePath)) {
            throw new Error(`Build input file "${lAbsoluteInputFilePath}" does not exist.`);
        }

        // Validate the configured include directories up-front so a misconfiguration fails before the (heavy) build.
        const lIncludes: Array<BuildFileDesktopInclude> = pConfiguration.include ?? [];
        for (const lInclude of lIncludes) {
            const lIncludeDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, lInclude.directory);
            if (!FileSystem.pathInformation(lIncludeDirectory).isDirectory) {
                throw new Error(`Desktop include directory "${lIncludeDirectory}" does not exist.`);
            }
        }

        // Read every configured output target. Nothing configured means nothing to do.
        const lOutputEntries: Array<[string, string]> = Object.entries(pConfiguration.output ?? {}).filter(
            (pEntry): pEntry is [string, string] => typeof pEntry[1] === 'string' && pEntry[1] !== ''
        );
        if (lOutputEntries.length === 0) {
            lConsole.writeLine('No desktop output configured. Skip desktop.', 'yellow');
            return;
        }

        // deno desktop only builds for the host platform, so keep only the configured targets whose OS/arch match this
        // host; the rest have to be built on their own OS.
        const lHostBuilds: Array<[string, DesktopTarget, string]> = [];
        for (const [lTargetKey, lOutput] of lOutputEntries) {
            const lTarget: DesktopTarget | undefined = DESKTOP_TARGETS[lTargetKey as DesktopTargetKey];
            if (!lTarget) {
                lConsole.writeLine(`Unknown desktop output target "${lTargetKey}". Skip.`, 'yellow');
                continue;
            }
            if (lTarget.os !== Deno.build.os || lTarget.arch !== Deno.build.arch) {
                lConsole.writeLine(`Desktop target "${lTargetKey}" (${lTarget.triple}) cannot be cross-built on this host (${Deno.build.os}/${Deno.build.arch}); build it on that OS. Skip.`, 'yellow');
                continue;
            }
            lHostBuilds.push([lTargetKey, lTarget, lOutput]);
        }
        if (lHostBuilds.length === 0) {
            lConsole.writeLine(`No configured desktop output matches this host platform (${Deno.build.os}/${Deno.build.arch}). Skip desktop.`, 'yellow');
            return;
        }

        // Write the dedicated desktop build configuration next to the package deno.json: a copy of the original config
        // with the desktop app metadata injected. It sits inside the package directory so relative import resolution is
        // unchanged, and deno desktop reads the app name/identifier from it via --config.
        const lPackageConfigurationPath: string = FileSystem.pathToAbsolute(pPackage.directory, 'deno.json');
        const lDesktopConfigurationPath: string = FileSystem.pathToAbsolute(pPackage.directory, 'desktop-build-deno.json');
        const lPackageConfiguration: Record<string, unknown> = JSON.parse(FileSystem.read(lPackageConfigurationPath));
        lPackageConfiguration['desktop'] = {
            app: {
                name: pConfiguration.name,
                identifier: pConfiguration.identifier
            }
        };
        FileSystem.write(lDesktopConfigurationPath, JSON.stringify(lPackageConfiguration, null, 4));

        try {
            // Build every host-matching target.
            for (const [lTargetKey, lTarget, lOutput] of lHostBuilds) {
                // The output directory deno desktop produces the application into.
                const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, lOutput);

                // Assemble the deno desktop command. Name/identifier come from the generated config; backend, icon and
                // output are passed as flags. --target is intentionally omitted (host-platform build only).
                const lCommandParts: Array<string> = ['deno', 'desktop', '--config', lDesktopConfigurationPath];

                // Output path of the produced application.
                lCommandParts.push('--output', lAbsoluteOutput);

                // Rendering backend.
                if (pConfiguration.backend) {
                    lCommandParts.push('--backend', pConfiguration.backend);
                }

                // Application icon for the target's operating system.
                const lIcon: string | undefined = (pConfiguration.icons ?? {})[lTarget.icon];
                if (lIcon) {
                    lCommandParts.push('--icon', FileSystem.pathToAbsolute(pPackage.directory, lIcon));
                }

                // The entry file to compile (script argument comes last).
                lCommandParts.push(lAbsoluteInputFilePath);

                lConsole.writeLine(`Building desktop app "${pConfiguration.name}" for "${lTargetKey}" (${lTarget.triple})...`);
                await new Process().executeInConsole(new ProcessParameter(pPackage.directory, lCommandParts));

                // Copy the configured include directories into this target's output so the running application can read
                // them as real files. Each target gets its own copy.
                this.copyDesktopIncludes(pPackage.directory, lAbsoluteOutput, lIncludes);
            }
        } finally {
            // Always remove the generated desktop build configuration.
            if (FileSystem.exists(lDesktopConfigurationPath)) {
                Deno.removeSync(lDesktopConfigurationPath);
            }
        }
    }

    /**
     * Copy the configured include directories into a desktop output directory. Each include directory is copied,
     * preserving its own name, into `<output>/<include directory name>/...`; only the files matching one of the
     * include's `filter` glob patterns are copied (a file matching multiple patterns is copied once).
     *
     * @param pPackageDirectory - Package directory the include directories are resolved against.
     * @param pOutputDirectory - Desktop output directory the include directories are copied into.
     * @param pIncludes - Configured include directories.
     */
    private copyDesktopIncludes(pPackageDirectory: string, pOutputDirectory: string, pIncludes: Array<BuildFileDesktopInclude>): void {
        for (const lInclude of pIncludes) {
            const lIncludeDirectory: string = FileSystem.pathToAbsolute(pPackageDirectory, lInclude.directory);
            const lIncludeName: string = FileSystem.fileOfPath(lIncludeDirectory);

            // Collect the files to copy. Without a filter every file in the directory is copied; otherwise every file
            // matching any of the filter patterns (a file matching multiple patterns is copied once).
            let lMatchedFiles: Array<string>;
            if (!lInclude.filter || lInclude.filter.length === 0) {
                lMatchedFiles = FileSystem.findFiles(lIncludeDirectory);
            } else {
                const lFilteredFiles: Set<string> = new Set<string>();
                for (const lPattern of lInclude.filter) {
                    for (const lFile of FileSystem.glob(lIncludeDirectory, lPattern)) {
                        lFilteredFiles.add(lFile);
                    }
                }
                lMatchedFiles = [...lFilteredFiles];
            }

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
 * A "page" entry: a browser bundle that receives the live-reload client when the build runs with `--injectreload`
 * (i.e. from the `page` dev server).
 */
export type BuildFilePage = {
    type: 'page';

    /**
     * Output path of the produced bundle, including the filename (e.g. `./page/bundle/app.js`).
     */
    output: string;
};

/**
 * A "bundle" entry: a browser bundle that never receives the live-reload client (e.g. a worker).
 */
export type BuildFileBundle = {
    type: 'bundle';

    /**
     * Output path of the produced bundle, including the filename (e.g. `./page/bundle/worker.js`).
     */
    output: string;
};

/**
 * A "desktop" entry: a native desktop application compiled from its entry file (the record key) via `deno desktop`.
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
     * Destination path for each build target's produced application (macOS split by architecture).
     */
    output?: DesktopOutputMap;

    /**
     * Rendering backend. Defaults to `deno desktop`'s default when omitted.
     */
    backend?: 'webview' | 'cef' | 'raw';

    /**
     * Directories copied into every produced desktop output after the build, so the running application can read them
     * as real files (e.g. the website files served by the app).
     */
    include?: Array<BuildFileDesktopInclude>;
};

/**
 * A directory copied into a desktop output. The directory is copied preserving its own name into
 * `<output>/<directory name>/...`; `filter` selects which files inside it are copied.
 */
export type BuildFileDesktopInclude = {
    /**
     * Directory whose matching files are copied into every desktop output (e.g. `./page`).
     */
    directory: string;

    /**
     * Optional glob patterns (globstar) selecting which files inside `directory` are copied; a file is copied when it
     * matches any pattern (e.g. `["**\/*.js", "**\/*.html", "**\/*.css"]`). When omitted or empty, every file in
     * `directory` is copied.
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
 * Output paths keyed by build target. macOS is split by architecture because each architecture needs its own binary
 * and therefore its own output path.
 */
export type DesktopOutputMap = {
    windows?: string;
    macosArm?: string;
    macosIntel?: string;
    linux?: string;
};

/**
 * Target triple, host OS/arch, and icon operating system for each configured desktop output key. `os`/`arch` are
 * compared against `Deno.build.os`/`Deno.build.arch` to decide whether the host can build a target.
 */
const DESKTOP_TARGETS: Record<DesktopTargetKey, DesktopTarget> = {
    windows: { triple: 'x86_64-pc-windows-msvc', os: 'windows', arch: 'x86_64', icon: 'windows' },
    macosArm: { triple: 'aarch64-apple-darwin', os: 'darwin', arch: 'aarch64', icon: 'macos' },
    macosIntel: { triple: 'x86_64-apple-darwin', os: 'darwin', arch: 'x86_64', icon: 'macos' },
    linux: { triple: 'x86_64-unknown-linux-gnu', os: 'linux', arch: 'x86_64', icon: 'linux' }
};

type DesktopTargetKey = 'windows' | 'macosArm' | 'macosIntel' | 'linux';

type DesktopTarget = {
    triple: string;
    os: typeof Deno.build.os;
    arch: typeof Deno.build.arch;
    icon: 'windows' | 'macos' | 'linux';
};
