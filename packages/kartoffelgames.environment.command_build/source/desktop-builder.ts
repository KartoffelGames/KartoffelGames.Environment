import { Console, FileSystem, type Package, Process, ProcessParameter } from '@kartoffelgames/environment-core';
import type { DesktopConfiguration } from './command.ts';

/**
 * Packages a package's built `app` directory into native desktop applications using `deno desktop`.
 *
 * `deno desktop` cross-compiles from a single host (the prebuilt runtime artifacts for each target are downloaded
 * automatically), so every platform configured in the desktop `output` map is built regardless of the host OS. Only
 * real code signing / notarization is host-bound; the produced binaries carry an ad-hoc signature by default.
 */
export class DesktopBuilder {
    /**
     * Build the desktop application for the given package and every configured output target.
     *
     * @param pPackage - Package to build the desktop application for.
     * @param pConfiguration - Desktop configuration.
     *
     * @throws {@link Error}
     * When the app directory does not exist or a `deno desktop` build fails.
     */
    public async build(pPackage: Package, pConfiguration: DesktopConfiguration): Promise<void> {
        const lConsole: Console = new Console();

        // Every configured output target gets built. Nothing configured means nothing to do.
        const lOutputEntries: Array<[string, string]> = Object.entries(pConfiguration.output ?? {}).filter(
            (pEntry): pEntry is [string, string] => typeof pEntry[1] === 'string' && pEntry[1] !== ''
        );
        if (lOutputEntries.length === 0) {
            lConsole.writeLine('No desktop output configured. Skip desktop.', 'yellow');
            return;
        }

        // The app directory that gets embedded into the binary. It must have been bundled beforehand.
        const lAppDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'app');
        if (!FileSystem.exists(lAppDirectory)) {
            throw new Error(`App directory "${lAppDirectory}" does not exist. Nothing to package.`);
        }

        // Assemble a temporary build directory shared by every target: the server entrypoint, a copy of the app
        // directory to embed, and a deno.json providing the application name and identifier (which come from config,
        // not CLI flags).
        const lBuildDirectory: string = Deno.makeTempDirSync();
        try {
            // Copy the app directory next to the server entry so `--include-as-is ./app` embeds it verbatim.
            FileSystem.copyDirectory(lAppDirectory, FileSystem.pathToAbsolute(lBuildDirectory, 'app'), true);

            // Write the server entrypoint from the shipped template.
            const lServerTemplate: string = await (await fetch(new URL('./desktop-server.ts', import.meta.url))).text();
            FileSystem.write(FileSystem.pathToAbsolute(lBuildDirectory, 'server.ts'), lServerTemplate);

            // Write the desktop application metadata for deno desktop to read.
            const lDenoConfiguration: Record<string, unknown> = {
                desktop: {
                    app: {
                        name: pConfiguration.name,
                        identifier: pConfiguration.identifier
                    }
                }
            };
            FileSystem.write(FileSystem.pathToAbsolute(lBuildDirectory, 'deno.json'), JSON.stringify(lDenoConfiguration, null, 4));

            // Build every configured target.
            for (const [lTargetKey, lOutput] of lOutputEntries) {
                const lTarget: DesktopTarget | undefined = DESKTOP_TARGETS[lTargetKey as DesktopTargetKey];
                if (!lTarget) {
                    lConsole.writeLine(`Unknown desktop output target "${lTargetKey}". Skip.`, 'yellow');
                    continue;
                }

                // Resolve the absolute output path and ensure its parent directory exists. `deno desktop` accepts a
                // bare directory as --output (unpackaged app folder); a packaged extension (.msi/.app/.dmg/.AppImage/…)
                // switches the output format instead.
                const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, lOutput);
                FileSystem.createDirectory(FileSystem.directoryOfFile(lAbsoluteOutput));

                // Assemble the deno desktop command. The pre-built IIFE bundles under app/ are embedded as-is (no module
                // resolution / transpilation), cross-compiled to the target triple, and written straight to the
                // configured output path.
                const lCommandParts: Array<string> = [
                    'deno', 'desktop', 'server.ts',
                    '--include-as-is', './app',
                    '--target', lTarget.triple,
                    '--output', lAbsoluteOutput
                ];

                // Rendering backend.
                if (pConfiguration.backend) {
                    lCommandParts.push('--backend', pConfiguration.backend);
                }

                // Application icon for the target's operating system.
                const lIcon: string | undefined = (pConfiguration.icons ?? {})[lTarget.icon];
                if (lIcon) {
                    lCommandParts.push('--icon', FileSystem.pathToAbsolute(pPackage.directory, lIcon));
                }

                // Run deno desktop from the temporary build directory.
                lConsole.writeLine(`Building desktop app "${pConfiguration.name}" for "${lTargetKey}" (${lTarget.triple})...`);
                await new Process().executeInConsole(new ProcessParameter(lBuildDirectory, lCommandParts));
            }
        } finally {
            // Always clean up the temporary build directory.
            FileSystem.deleteDirectory(lBuildDirectory);
        }
    }
}

/**
 * Cross-compilation target triple and icon operating system for each configured output key.
 */
const DESKTOP_TARGETS: Record<DesktopTargetKey, DesktopTarget> = {
    windows: { triple: 'x86_64-pc-windows-msvc', icon: 'windows' },
    macosArm: { triple: 'aarch64-apple-darwin', icon: 'macos' },
    macosIntel: { triple: 'x86_64-apple-darwin', icon: 'macos' },
    linux: { triple: 'x86_64-unknown-linux-gnu', icon: 'linux' }
};

type DesktopTargetKey = 'windows' | 'macosArm' | 'macosIntel' | 'linux';

type DesktopTarget = {
    triple: string;
    icon: 'windows' | 'macos' | 'linux';
};
