import { Console, FileSystem, type Package, Process, ProcessParameter } from '@kartoffelgames/environment-core';
import type { DesktopConfiguration } from './command.ts';

/**
 * Packages a package's built `app` directory into a native desktop application using `deno desktop`.
 *
 * Builds only for the current platform: cross-platform desktop builds involve per-OS backends and code signing
 * (which must run on the target OS), so each platform is expected to build its own binary.
 */
export class DesktopBuilder {
    /**
     * Build the desktop application for the given package and the current platform.
     *
     * @param pPackage - Package to build the desktop application for.
     * @param pConfiguration - Desktop configuration.
     *
     * @throws {@link Error}
     * When the app directory does not exist or the `deno desktop` build fails.
     */
    public async build(pPackage: Package, pConfiguration: DesktopConfiguration): Promise<void> {
        const lConsole: Console = new Console();

        // Determine the output for the current platform. Cross-platform builds are intentionally not attempted.
        const lPlatform: DesktopPlatform | null = DesktopBuilder.currentPlatform();
        if (lPlatform === null) {
            lConsole.writeLine('Desktop build is not supported on this platform. Skip desktop.', 'yellow');
            return;
        }

        const lOutput: string | undefined = (pConfiguration.output ?? {})[lPlatform];
        if (!lOutput) {
            lConsole.writeLine(`No desktop output configured for "${lPlatform}". Skip desktop.`, 'yellow');
            return;
        }

        // The app directory that gets embedded into the binary. It must have been bundled beforehand.
        const lAppDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'app');
        if (!FileSystem.exists(lAppDirectory)) {
            throw new Error(`App directory "${lAppDirectory}" does not exist. Nothing to package.`);
        }

        // Resolve the absolute output path and ensure its parent directory exists.
        const lAbsoluteOutput: string = FileSystem.pathToAbsolute(pPackage.directory, lOutput);
        FileSystem.createDirectory(FileSystem.directoryOfFile(lAbsoluteOutput));

        // Assemble a temporary build directory: the server entrypoint, a copy of the app directory to embed, and a
        // deno.json providing the application name and identifier (which come from config, not CLI flags).
        const lBuildDirectory: string = Deno.makeTempDirSync();
        try {
            // Copy the app directory next to the server entry so `--include ./app` embeds it.
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

            // Assemble the deno desktop command. `deno desktop` ignores --output for bare directory targets and
            // writes the app into "<cwd>/<app-name>/", so the produced directory is moved to the output afterwards.
            const lCommandParts: Array<string> = ['deno', 'desktop', 'server.ts', '--include', './app'];

            // Rendering backend.
            if (pConfiguration.backend) {
                lCommandParts.push('--backend', pConfiguration.backend);
            }

            // Application icon for the current platform.
            const lIcon: string | undefined = (pConfiguration.icons ?? {})[lPlatform];
            if (lIcon) {
                lCommandParts.push('--icon', FileSystem.pathToAbsolute(pPackage.directory, lIcon));
            }

            // Run deno desktop from the temporary build directory.
            lConsole.writeLine(`Building desktop app "${pConfiguration.name}" for "${lPlatform}"...`);
            await new Process().executeInConsole(new ProcessParameter(lBuildDirectory, lCommandParts));

            // Locate the produced app directory (everything in the build directory except the copied "app" source).
            let lProducedDirectory: string | null = null;
            for (const lEntry of Deno.readDirSync(lBuildDirectory)) {
                if (lEntry.isDirectory && lEntry.name !== 'app') {
                    lProducedDirectory = FileSystem.pathToAbsolute(lBuildDirectory, lEntry.name);
                    break;
                }
            }
            if (lProducedDirectory === null) {
                throw new Error('Desktop build did not produce any output.');
            }

            // Replace the configured output with the freshly produced app.
            if (FileSystem.exists(lAbsoluteOutput)) {
                FileSystem.deleteDirectory(lAbsoluteOutput);
            }
            FileSystem.copyDirectory(lProducedDirectory, lAbsoluteOutput, true);
        } finally {
            // Always clean up the temporary build directory.
            FileSystem.deleteDirectory(lBuildDirectory);
        }
    }

    /**
     * Map the current OS to a desktop platform key, or null when unsupported.
     *
     * @returns Desktop platform key of the current OS.
     */
    private static currentPlatform(): DesktopPlatform | null {
        switch (Deno.build.os) {
            case 'windows':
                return 'windows';
            case 'darwin':
                return 'macos';
            case 'linux':
                return 'linux';
            default:
                return null;
        }
    }
}

type DesktopPlatform = 'windows' | 'macos' | 'linux';
