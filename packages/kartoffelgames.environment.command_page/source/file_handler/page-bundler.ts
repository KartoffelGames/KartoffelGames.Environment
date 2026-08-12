import { EnvironmentBundle, EnvironmentBundleInputFile, type EnvironmentBundleOptions, type EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { Console, FileSystem, type Package } from '@kartoffelgames/environment-core';

export class PageBundler {
    private readonly mBundledFiles: PageBundlerFiles;
    private readonly mCoreBundleRequired: boolean;
    private readonly mPackage: Package;
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
     * When main source bundle is required, the package library is bundled first into the package library directory.
     */
    public async bundle(): Promise<boolean> {
        const lConsole = new Console();

        // Bundle the package library first when required. It is written into the package library directory.
        if (this.mCoreBundleRequired) {
            try {
                await new EnvironmentBundle().bundleLibrary(this.mPackage);
            } catch (e) {
                lConsole.writeLine('Failed to bundle core source.', 'red');
                lConsole.writeLine((<Error>e).message, 'red');
            }
        }

        // Read the page-refresher-input.ts file content.
        const lPageRefresherInputFilePath: URL = new URL('./page-refresher-input.ts', import.meta.url);
        const lPageRefresherInputFileRequest: Response = await fetch(lPageRefresherInputFilePath);

        // Load as text to replace the [[WEBSOCKET_PORT]] placeholder.
        const lPageRefresherInputFileText: string = (await lPageRefresherInputFileRequest.text())
            .replace('[[WEBSOCKET_PORT]]', this.mWebsocketPort.toString());

        // Build the bundle entry outside of the package directory so it never appears in the users project.
        // The entry imports the real index file by absolute url and prepends the refresher script.
        const lPageIndexFilePath: string = FileSystem.pathToAbsolute(this.mPackage.directory, './page/source/index.ts');
        const lPageIndexFileUrl: string = FileSystem.pathToFileUrl(lPageIndexFilePath).href;
        const lEntryFileContent: string = `${lPageRefresherInputFileText}\nimport ${JSON.stringify(lPageIndexFileUrl)};\n`;

        // Write the entry file into the os temporary directory.
        const lTempFilePath: string = await Deno.makeTempFile({ suffix: '.bundle-entry.ts' });
        await Deno.writeTextFile(lTempFilePath, lEntryFileContent);

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
    package: Package;
    coreBundleRequired: boolean;
    websocketPort: number;
};
