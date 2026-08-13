import { Console, FileSystem, type Package, Process, ProcessParameter } from '@kartoffelgames/environment-core';
import type { DesktopConfiguration } from './command.ts';

/**
 * Packages a package's built `page` directory into native desktop applications using `deno desktop`.
 *
 * Three behaviours of `deno desktop` (verified against Deno 2.9.5) shape this implementation:
 * - Static files are **not** embedded via `--include`; only the module graph is embedded. So the page directory is
 *   embedded by generating a server entry that imports every page file as a raw module (`with { type: "text" }` for
 *   text, `{ type: "bytes" }` for binary) and serves them from an in-memory manifest — no runtime filesystem access.
 * - `--output` is ignored for bare (unpackaged) directory targets: the build always writes to `<cwd>/<app-name>/`.
 *   So the build runs in a temp directory and the produced app directory is moved to the configured output path.
 * - `--target` is **not** honoured for the unpackaged directory build: it always produces host-platform binaries
 *   (a `--target linux`/`darwin` build on Windows still emits Windows PE files). Cross-OS desktop builds are
 *   therefore not possible from a single host with this version. So only the configured output whose platform
 *   matches the host OS/arch is built; the others are skipped and must be built on their own OS (e.g. a CI matrix).
 */
export class DesktopBuilder {
    /**
     * Build the desktop application for the given package and every configured output target.
     *
     * @param pPackage - Package to build the desktop application for.
     * @param pConfiguration - Desktop configuration.
     *
     * @throws {@link Error}
     * When the page directory does not exist or a `deno desktop` build fails or produces no output.
     */
    public async build(pPackage: Package, pConfiguration: DesktopConfiguration): Promise<void> {
        const lConsole: Console = new Console();

        // Read every configured output target. Nothing configured means nothing to do.
        const lOutputEntries: Array<[string, string]> = Object.entries(pConfiguration.output ?? {}).filter(
            (pEntry): pEntry is [string, string] => typeof pEntry[1] === 'string' && pEntry[1] !== ''
        );
        if (lOutputEntries.length === 0) {
            lConsole.writeLine('No desktop output configured. Skip desktop.', 'yellow');
            return;
        }

        // deno desktop only builds for the host platform (its --target is ignored for the directory build), so keep
        // only the configured targets whose OS/arch match this host; the rest have to be built on their own OS.
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

        // The page directory that gets embedded into the binary. It must have been bundled beforehand.
        const lPageDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'page');
        if (!FileSystem.exists(lPageDirectory)) {
            throw new Error(`Page directory "${lPageDirectory}" does not exist. Nothing to package.`);
        }

        // Collect every file under the page directory as a page-root-relative posix path (e.g. "index.html",
        // "bundle/app.js"). These become the embedded module-graph imports of the generated server.
        const lRelativeFiles: Array<string> = FileSystem.findFiles(lPageDirectory).map((pAbsolute: string): string => {
            return pAbsolute.substring(lPageDirectory.length).replaceAll('\\', '/').replace(/^\//, '');
        });
        if (lRelativeFiles.length === 0) {
            throw new Error(`Page directory "${lPageDirectory}" is empty. Run the bundle step before packaging the desktop app.`);
        }

        // Assemble a temporary build directory shared by every target: the generated server entrypoint, a copy of the
        // page directory to embed, and a deno.json providing the application metadata and enabling raw imports.
        const lBuildDirectory: string = Deno.makeTempDirSync();
        try {
            // Copy the page directory next to the server entry so the generated imports (`./page/...`) resolve.
            FileSystem.copyDirectory(lPageDirectory, FileSystem.pathToAbsolute(lBuildDirectory, 'page'), true);

            // Write the generated server entry: the shipped template with its markers replaced by the page's
            // embedded module imports and manifest entries.
            const lTemplate: string = await (await fetch(new URL('./desktop-server-template.ts', import.meta.url))).text();
            const lManifest: { imports: string; entries: string } = DesktopBuilder.buildServerManifest(lRelativeFiles);
            const lServerSource: string = lTemplate
                .replace('// __DESKTOP_SERVER_IMPORTS__', lManifest.imports)
                .replace('    // __DESKTOP_SERVER_MANIFEST__', lManifest.entries);

            // Guard against template drift: both markers must have been substituted.
            if (lServerSource.includes('__DESKTOP_SERVER_IMPORTS__') || lServerSource.includes('__DESKTOP_SERVER_MANIFEST__')) {
                throw new Error('Desktop server template markers were not replaced. The template is out of sync with DesktopBuilder.');
            }

            FileSystem.write(FileSystem.pathToAbsolute(lBuildDirectory, 'server.ts'), lServerSource);

            // Write the desktop metadata. `raw-imports` is required for the `{ type: "bytes" }` asset imports.
            const lDenoConfiguration: Record<string, unknown> = {
                unstable: ['raw-imports'],
                desktop: {
                    app: {
                        name: pConfiguration.name,
                        identifier: pConfiguration.identifier
                    }
                }
            };
            FileSystem.write(FileSystem.pathToAbsolute(lBuildDirectory, 'deno.json'), JSON.stringify(lDenoConfiguration, null, 4));

            // Build every host-matching target.
            for (const [lTargetKey, lTarget, lOutput] of lHostBuilds) {
                // Assemble the deno desktop command. The app is embedded through the generated server's module graph,
                // so no --include is needed; --output is omitted because it is ignored for bare directory targets; and
                // --target is omitted because it does not cross-compile the directory build (host platform is used).
                const lCommandParts: Array<string> = ['deno', 'desktop', 'server.ts'];

                // Rendering backend.
                if (pConfiguration.backend) {
                    lCommandParts.push('--backend', pConfiguration.backend);
                }

                // Application icon for the target's operating system.
                const lIcon: string | undefined = (pConfiguration.icons ?? {})[lTarget.icon];
                if (lIcon) {
                    lCommandParts.push('--icon', FileSystem.pathToAbsolute(pPackage.directory, lIcon));
                }

                // Run deno desktop from the temporary build directory. It writes the app into "<build dir>/<app name>/".
                lConsole.writeLine(`Building desktop app "${pConfiguration.name}" for "${lTargetKey}" (${lTarget.triple})...`);
                await new Process().executeInConsole(new ProcessParameter(lBuildDirectory, lCommandParts));

                // Locate the produced app directory (every directory in the build dir except the copied "page" source).
                let lProducedDirectory: string | null = null;
                for (const lEntry of Deno.readDirSync(lBuildDirectory)) {
                    if (lEntry.isDirectory && lEntry.name !== 'page') {
                        lProducedDirectory = FileSystem.pathToAbsolute(lBuildDirectory, lEntry.name);
                        break;
                    }
                }
                if (lProducedDirectory === null) {
                    throw new Error(`Desktop build for "${lTargetKey}" did not produce any output.`);
                }

                // Move the produced app to the configured output path.
                const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, lOutput);
                FileSystem.createDirectory(FileSystem.directoryOfFile(lAbsoluteOutput));
                if (FileSystem.exists(lAbsoluteOutput)) {
                    FileSystem.deleteDirectory(lAbsoluteOutput);
                }
                FileSystem.copyDirectory(lProducedDirectory, lAbsoluteOutput, true);

                // Remove the produced directory so the next target starts from a clean build directory.
                FileSystem.deleteDirectory(lProducedDirectory);
            }
        } finally {
            // Always clean up the temporary build directory.
            FileSystem.deleteDirectory(lBuildDirectory);
        }
    }

    /**
     * Build the two pieces injected into the server template: the raw-module imports and the manifest entries, one
     * per page file. Together they embed the whole page directory into the binary through the module graph.
     *
     * @param pRelativeFiles - App-root-relative posix paths of every file to embed (e.g. "index.html", "bundle/app.js").
     *
     * @returns Import lines and manifest-entry lines to substitute into the server template markers.
     */
    private static buildServerManifest(pRelativeFiles: Array<string>): { imports: string; entries: string } {
        const lImportLines: Array<string> = [];
        const lManifestLines: Array<string> = [];

        pRelativeFiles.forEach((pRelativeFile: string, pIndex: number): void => {
            const lExtension: string = DesktopBuilder.extensionOf(pRelativeFile);
            const lIsText: boolean = TEXT_EXTENSIONS.has(lExtension);
            const lAttributeType: string = lIsText ? 'text' : 'bytes';
            const lMimeType: string = MIME_TYPES[lExtension] ?? (lIsText ? 'text/plain' : 'application/octet-stream');

            const lVariable: string = `lFile${pIndex}`;
            const lSpecifier: string = JSON.stringify(`./page/${pRelativeFile}`);
            const lManifestKey: string = JSON.stringify(`/${pRelativeFile}`);

            lImportLines.push(`import ${lVariable} from ${lSpecifier} with { type: ${JSON.stringify(lAttributeType)} };`);
            lManifestLines.push(`    [${lManifestKey}, { body: ${lVariable}, type: ${JSON.stringify(lMimeType)} }],`);
        });

        return { imports: lImportLines.join('\n'), entries: lManifestLines.join('\n') };
    }

    /**
     * Lower-cased file extension including the leading dot, or an empty string when there is none.
     *
     * @param pPath - File path.
     *
     * @returns File extension.
     */
    private static extensionOf(pPath: string): string {
        const lIndex: number = pPath.lastIndexOf('.');
        return lIndex < 0 ? '' : pPath.substring(lIndex).toLowerCase();
    }
}

/**
 * Target triple, host OS/arch it can be built on, and icon operating system for each configured output key.
 * `os`/`arch` are compared against `Deno.build.os`/`Deno.build.arch` to decide whether the host can build a target.
 */
const DESKTOP_TARGETS: Record<DesktopTargetKey, DesktopTarget> = {
    windows: { triple: 'x86_64-pc-windows-msvc', os: 'windows', arch: 'x86_64', icon: 'windows' },
    macosArm: { triple: 'aarch64-apple-darwin', os: 'darwin', arch: 'aarch64', icon: 'macos' },
    macosIntel: { triple: 'x86_64-apple-darwin', os: 'darwin', arch: 'x86_64', icon: 'macos' },
    linux: { triple: 'x86_64-unknown-linux-gnu', os: 'linux', arch: 'x86_64', icon: 'linux' }
};

/**
 * Extensions embedded as text modules; everything else is embedded as raw bytes.
 */
const TEXT_EXTENSIONS: Set<string> = new Set<string>([
    '.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.map', '.svg', '.txt', '.xml', '.webmanifest'
]);

/**
 * Content type per file extension.
 */
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.cjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.map': 'application/json',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
};

type DesktopTargetKey = 'windows' | 'macosArm' | 'macosIntel' | 'linux';

type DesktopTarget = {
    triple: string;
    os: typeof Deno.build.os;
    arch: typeof Deno.build.arch;
    icon: 'windows' | 'macos' | 'linux';
};
