import { EnvironmentBundle, EnvironmentBundleInputFile, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from '@kartoffelgames/environment-command-bundle';
import { CliParameter, Console, FileSystem, type Package, type Project } from '@kartoffelgames/environment-core';

export class ScratchpadBundler {
    private readonly mBundledFiles: ScratchpadBundlerFiles;
    private readonly mCoreBundleRequired: boolean;
    private readonly mPackage: Package;
    private readonly mProjectHandler: Project;
    private readonly mWebsocketPort: number;

    /**
     * Get source file.
     */
    public get sourceFile(): Uint8Array<ArrayBuffer> {
        return this.mBundledFiles.javascriptFileContent;
    }

    /**
     * Get source map file.
     */
    public get sourceMapFile(): Uint8Array<ArrayBuffer> {
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

        // Read the scratchpad-refresher-input.ts file content and create a temporary file for bundling.
        const lScratchpadRefresherInputFilePath: URL = new URL('./scratchpad-refresher-input.ts', import.meta.url);
        const lScratchpadRefresherInputFileRequest: Response = await fetch(lScratchpadRefresherInputFilePath);

        // Load as text to replace the [[WEBSOCKET_PORT]] placeholder.
        const lScratchpadRefresherInputFileText: string = (await lScratchpadRefresherInputFileRequest.text())
            .replace('[[WEBSOCKET_PORT]]', this.mWebsocketPort.toString());

        // Create temporary file for bundling.
        const lTempFilePath: string = await Deno.makeTempFile({ suffix: '.ts' });
        await Deno.writeFile(lTempFilePath, new TextEncoder().encode(lScratchpadRefresherInputFileText));

        // Start bundling.
        const lBundleResult: { content: Uint8Array<ArrayBuffer>, sourcemap: Uint8Array<ArrayBuffer>; } = await (async () => {
            try {
                // Create environment bundle object.
                const lEnvironmentBundle = new EnvironmentBundle();

                // Create an absolute path for the scratchpad index.ts file.
                const lScratchpadIndexFilePath: string = FileSystem.pathToAbsolute(this.mPackage.directory, './scratchpad/source/index.ts');

                // Create the single inpput file configuration.
                const lInputFile: EnvironmentBundleInputFile = {
                    inputFilePaths: [lTempFilePath, lScratchpadIndexFilePath],
                    outputBasename: 'scratchpad',
                    outputExtension: 'js'
                };

                // Replace input file with fixed bundle input.
                const lBundleOptions: EnvironmentBundleOptions = {
                    files: [lInputFile]
                };

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
    javascriptFileContent: Uint8Array<ArrayBuffer>;
    mapFileContent: Uint8Array<ArrayBuffer>;
};

export type ScratchpadBundlerConstructor = {
    projectHandler: Project;
    package: Package;
    coreBundleRequired: boolean;
    websocketPort: number;
};