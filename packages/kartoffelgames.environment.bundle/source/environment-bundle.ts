import { FileSystem, Import, type Package, type PathInformation } from '@kartoffelgames/environment-core';

export class EnvironmentBundle {
    /**
     * Bundle a package with set settings and loader.
     *
     * @param pPackage - Package to bundle.
     * @param pOptions - Bundle options.
     *
     * @returns Build output of Deno bundle.
     */
    public async bundle(pPackage: Package, pOptions: EnvironmentBundleOptions): Promise<EnvironmentBundleOutput> {
        // Normalize bundle options.
        const lEnvironmentBundleOptions: EnvironmentBundleOptions = {
            ...pOptions,
        };

        // Normalize input files.
        lEnvironmentBundleOptions.files = pOptions.files.map((pInputFile) => {
            return {
                ...pInputFile,
                // Replace <packagename> with package name.
                outputBasename: pInputFile.outputBasename.replace('<packagename>', pPackage.id),
                // Convert entry point paths into absolute file paths rooted in the package directory.
                inputFilePaths: pInputFile.inputFilePaths
            };
        });

        // Bundle based on entry type.
        return this.runBundleProcess(lEnvironmentBundleOptions);
    }

    /**
     * Run a generic bundle process.
     *
     * @param pOptions - Bundle options.
     *
     * @returns bundle output files.
     */
    private async runBundleProcess(pOptions: EnvironmentBundleOptions): Promise<EnvironmentBundleOutput> {
        // Create base bundle configuration.
        const lBaseBundleConfiguration = {
            platform: 'browser',
            format: 'iife',

            // Optimization.
            minify: true,
            sourcemap: 'linked',

            // Override default settings.
            keepNames: false,
            packages: 'bundle',

            // Write to memory.
            write: false,
        } as const;

        // Collect all output files.
        const lBuildOutput: EnvironmentBundleOutput = [];

        // Bundle each file individually. Deno can only bundle one file at a time.
        for (const lFile of pOptions.files) {
            // Create explicit bundle configuration.
            const lBundleConfiguration: Deno.bundle.Options = {
                ...lBaseBundleConfiguration,
                entrypoints: lFile.inputFilePaths,
                outputPath: lFile.outputBasename
            };

            // Start bundling.
            const lBundleResult: Deno.bundle.Result = await Deno.bundle(lBundleConfiguration);

            // On any error, return an empty result.
            if (!lBundleResult.outputFiles) {
                return [];
            }

            // Grouped file output with its source map.
            const lFileOutput: { [fileName: string]: Partial<EnvironmentBundleOutput[number]>; } = {};

            // Read and map all output files that belong to each other.
            for (const lOutFile of lBundleResult.outputFiles) {
                const lOutFileInformation: PathInformation = FileSystem.pathInformation(lOutFile.path);

                // Get file name without extension. When it ends with .js it is a map file.
                let lOutFileName: string = lOutFileInformation.filename;
                if (lOutFileName.endsWith('.js')) {
                    // Remove .js from file name.
                    lOutFileName = lOutFileName.substring(0, lOutFileName.length - 3);
                }

                // Get or create file output entry mapping.
                let lFileOutputEntry: Partial<EnvironmentBundleOutput[number]> | undefined = lFileOutput[lOutFileName];
                if (!lFileOutputEntry) {
                    // Create and register empty file output entry.
                    lFileOutputEntry = { fileName: lOutFileName };
                    lFileOutput[lOutFileName] = lFileOutputEntry;
                }

                // Add either content or source map, based on file extension, to the file output entry.
                if (lOutFile.contents) {
                    if (lOutFileInformation.extension === '.js') {
                        lFileOutputEntry.content = lOutFile.contents;
                    } else if (lOutFileInformation.extension === '.map') {
                        lFileOutputEntry.sourceMap = lOutFile.contents;
                    }
                }
            }

            // Get the output entry for this input file.
            const lFileOutputEntry: Partial<EnvironmentBundleOutput[number]> | undefined = lFileOutput[lFile.outputBasename];

            // Missing everything.
            if (!lFileOutputEntry) {
                throw new Error(`Output file not emited for input file: ${lFile.outputBasename}`);
            }

            // Missing content.
            if (!lFileOutputEntry.content) {
                throw new Error(`Output file content not emited for input file: ${lFile.outputBasename}`);
            }

            // Missing source map.
            if (!lFileOutputEntry.sourceMap) {
                throw new Error(`Output file map not emited for input file: ${lFile.outputBasename}`);
            }

            // Replace sourcemap url in output file with the right extension.
            // Convert Uint8Array into text. Replace sourcemapping url.
            const lSourceText: string = new TextDecoder().decode(lFileOutputEntry.content).replace(
                `//# sourceMappingURL=${lFile.outputBasename}.js.map`,
                `//# sourceMappingURL=${lFile.outputBasename}.${lFile.outputExtension}.map`
            );

            // Encode text again into Uint8Array.
            lFileOutputEntry.content = new TextEncoder().encode(lSourceText);

            // Add file to output.
            lBuildOutput.push({
                content: lFileOutputEntry.content,
                fileName: `${lFile.outputBasename}.${lFile.outputExtension}`,
                sourceMap: lFileOutputEntry.sourceMap
            });
        }

        return lBuildOutput;
    }
}

export type EnvironmentBundleInputFile = {
    /**
     * Absolute path of input file.
     */
    inputFilePaths: Array<string>;

    /**
     * Base name of file use <packagename> to replace with package name.
     */
    outputBasename: string;

    /**
     * File extension without leading dot.
     */
    outputExtension: string;
};

export type EnvironmentBundleOutput = Array<{
    /**
     * File content.
     */
    content: Uint8Array<ArrayBuffer>;

    /**
     * Filename without extension.
     */
    fileName: string;

    /**
     * Files source map.
     */
    sourceMap: Uint8Array<ArrayBuffer>;
}>;

export type EnvironmentBundleOptions = {
    files: Array<EnvironmentBundleInputFile>;
};