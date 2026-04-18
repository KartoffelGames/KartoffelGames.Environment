import { EnvironmentBundle, EnvironmentBundleInputFile, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from '@kartoffelgames/environment-command-bundle';
import { CliParameter, Console, FileSystem, type Package, type Project } from '@kartoffelgames/environment-core';

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

        // Read the scratchpad-refresher-input.ts file content and create a temporary file for bundling.
        const lPageRefresherInputFilePath: URL = new URL('./page-refresher-input.ts', import.meta.url);
        const lPageRefresherInputFileRequest: Response = await fetch(lPageRefresherInputFilePath);

        // Load as text to replace the [[WEBSOCKET_PORT]] placeholder.
        const lPageRefresherInputFileText: string = (await lPageRefresherInputFileRequest.text())
            .replace('[[WEBSOCKET_PORT]]', this.mWebsocketPort.toString());

        // Create an absolute path for the page index.ts file.
        const lPageIndexFilePath: string = FileSystem.pathToAbsolute(this.mPackage.directory, './page/source/index.ts');

        // Create a temporary file as sibbling file of the index file for bundling and write the RefresherInputFileText first and then the index.ts content to it.
        const lTempFilePath: string = await Deno.makeTempFile({ suffix: '.bundle-entry.ts', dir: FileSystem.pathToAbsolute(this.mPackage.directory, './page/source') });
        await Deno.writeFile(lTempFilePath, new TextEncoder().encode(lPageRefresherInputFileText));
        await Deno.writeFile(lTempFilePath, await Deno.readFile(lPageIndexFilePath), { append: true });

        // Start bundling.
        const lBundleResult: { content: Uint8Array, sourcemap: Uint8Array; } = await (async () => {
            try {
                // Create environment bundle object.
                const lEnvironmentBundle = new EnvironmentBundle();

                // Create the single input file configuration.
                const lInputFile: EnvironmentBundleInputFile = {
                    inputFilePath: lTempFilePath,
                    outputBasename: 'page',
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
            } finally {
                // Remove temporary file.
                await Deno.remove(lTempFilePath);
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