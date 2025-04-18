import { EnvironmentBundle, type EnvironmentBundleInputContent, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from '@kartoffelgames/environment-command-bundle';
import { CliParameter, Console, FileSystem, type Package, type Project } from '@kartoffelgames/environment-core';

export class ScratchpadBundler {
    private readonly mBundledFiles: ScratchpadBundlerFiles;
    private readonly mBundledSettingFilePath: string;
    private readonly mCoreBundleRequired: boolean;
    private readonly mPackage: Package;
    private readonly mProjectHandler: Project;
    private readonly mWebsocketPort: number;

    /**
     * Get source file.
     */
    public get sourceFile(): Uint8Array {
        return this.mBundledFiles.javascriptFileContent;
    }

    /**
     * Get source map file.
     */
    public get sourceMapFile(): Uint8Array {
        return this.mBundledFiles.mapFileContent;
    }

    /**
     * Constructor.
     * 
     * @param pParameters - Constructor parameters.
     */
    public constructor(pParameters: ScratchpadBundlerConstructor) {
        this.mProjectHandler = pParameters.projectHandler;
        this.mPackage = pParameters.package;
        this.mCoreBundleRequired = pParameters.coreBundleRequired;
        this.mWebsocketPort = pParameters.websocketPort;
        this.mBundledFiles = {
            javascriptFileContent: new Uint8Array(0),
            mapFileContent: new Uint8Array(0),
        };
        this.mBundledSettingFilePath = pParameters.bundledSettingFilePath;
    }

    /**
     * Rebundle scratchpad files.
     * When main source bundle is required, main source is bundled first with the native kg bundle command.
     */
    public async bundle(): Promise<boolean> {
        const lConsole = new Console();

        // Create bundle command.
        const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

        // Bundle native when native is required.
        if (this.mCoreBundleRequired) {
            // Create main bundle parameter with force flag.
            const lMainBundleParameter: CliParameter = new CliParameter('root');
            lMainBundleParameter.set('force', null);

            // Try to bundle main source.
            try {
                // The original bundle command puts the files in the right directories.
                await lMainBundleCommand.run(this.mProjectHandler, this.mPackage, lMainBundleParameter);
            } catch (e) {
                lConsole.writeLine('Failed to bundle core source.', 'red');
                lConsole.writeLine((<Error>e).message, 'red');
            }
        }

        // Create default scratchpad input.
        const lBundleSettings: EnvironmentBundleInputContent = {
            inputResolveDirectory: './scratchpad/source/',
            outputBasename: 'scratchpad',
            outputExtension: 'js',
            inputFileContent:
                `(() => {\n` +
                `    const socket = new WebSocket('ws://127.0.0.1:${this.mWebsocketPort}');\n` +
                `    socket.addEventListener('open', () => {\n` +
                `        console.log('Refresh connection established');\n` +
                `    });\n` +
                `    socket.addEventListener('message', (event) => {\n` +
                `        console.log('Bundle finished. Start refresh');\n` +
                `        if (event.data === 'REFRESH') {\n` +
                `            window.location.reload();\n` +
                `        }\n` +
                `    });\n` +
                `})();\n` +
                `import('./index.ts');\n`
        };

        // Start bundling.
        const lBundleResult: { content: Uint8Array, sourcemap: Uint8Array; } = await (async () => {
            try {
                // Create environment bundle object.
                const lEnvironmentBundle = new EnvironmentBundle();

                // Load local bundle settings.
                const lBundleSettingsFilePath: string | null = this.mBundledSettingFilePath.trim() !== '' ? FileSystem.pathToAbsolute(this.mPackage.directory, this.mBundledSettingFilePath) : null;
                const lBundleOptions: EnvironmentBundleOptions = await lEnvironmentBundle.loadBundleOptions(lBundleSettingsFilePath);

                // Replace input file with fixed bundle input.
                lBundleOptions.files = lBundleSettings;

                // Run bundle.
                const lBundleResult: EnvironmentBundleOutput = await lEnvironmentBundle.bundle(this.mPackage, lBundleOptions);

                // Return bundle result. Its allways one file.
                return {
                    content: lBundleResult[0].content,
                    sourcemap: lBundleResult[0].sourceMap
                };
            } catch (e) {
                // Pass through error message.
                lConsole.writeLine((<Error>e).message, 'red');

                // Return empty bundle result on error.
                return {
                    content: new Uint8Array(0),
                    sourcemap: new Uint8Array(0)
                };
            }
        })();

        // Cache bundled files.
        const lTextDecoder = new TextDecoder();
        if (lTextDecoder.decode(this.mBundledFiles.javascriptFileContent) === lTextDecoder.decode(lBundleResult.content)) {
            // Signal bundle was not changed.
            return false;
        }

        // Cache bundled files.
        this.mBundledFiles.javascriptFileContent = lBundleResult.content;
        this.mBundledFiles.mapFileContent = lBundleResult.sourcemap;

        return true;
    }
}

type ScratchpadBundlerFiles = {
    javascriptFileContent: Uint8Array;
    mapFileContent: Uint8Array;
};

export type ScratchpadBundlerConstructor = {
    projectHandler: Project;
    package: Package;
    coreBundleRequired: boolean;
    websocketPort: number;
    bundledSettingFilePath: string;
};