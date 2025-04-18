import type { EnvironmentBundleInputContent, EnvironmentBundleOptions, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from '@kartoffelgames/environment-command-bundle';
import { CliParameter, Console, type Project, type Package } from '@kartoffelgames/environment-core';

export class PageBundler {
    private readonly mBundledFiles: PageBundlerFiles;
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
    public constructor(pParameters: PageBundlerConstructor) {
        this.mProjectHandler = pParameters.projectHandler;
        this.mPackage = pParameters.package;
        this.mCoreBundleRequired = pParameters.coreBundleRequired;
        this.mWebsocketPort = pParameters.websocketPort;
        this.mBundledFiles = {
            javascriptFileContent: new Uint8Array(0),
            mapFileContent: new Uint8Array(0),
        };
    }

    /**
     * Rebundle page files.
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

        // Create default page input.
        const lBundleSettings: EnvironmentBundleInputContent = {
            inputResolveDirectory: './page/source/',
            outputBasename: 'page',
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
                // Run bundle.
                const lBundleResult: EnvironmentBundleOutput = await lMainBundleCommand.bundle(this.mPackage, (pOptions: EnvironmentBundleOptions) => {
                    pOptions.entry = {
                        content: lBundleSettings
                    };
                });

                // Return bundle result. Its allways one file.
                return {
                    content: lBundleResult[0].content,
                    sourcemap: lBundleResult[0].sourceMap
                };
            } catch (e) {
                // Pass through error message.
                lConsole.writeLine((<Error>e).message, 'red');
            }

            // Return empty bundle result on error.
            return {
                content: new Uint8Array(0),
                sourcemap: new Uint8Array(0)
            };
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

type PageBundlerFiles = {
    javascriptFileContent: Uint8Array;
    mapFileContent: Uint8Array;
};

export type PageBundlerConstructor = {
    projectHandler: Project;
    package: Package;
    coreBundleRequired: boolean;
    websocketPort: number;
};