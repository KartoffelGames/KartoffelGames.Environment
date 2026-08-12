import { FileSystem, type Package, type PathInformation } from '@kartoffelgames/environment-core';

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
                inputFilePath: pInputFile.inputFilePath
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
            outputDir: "./"
        } as const;

        // Collect all entrypoints from all input file configurations.
        const lAllEntrypoints: Array<string> = pOptions.files.map((pFile) => pFile.inputFilePath);

        // Bundle all files in a single Deno.bundle call.
        const lBundleResult: Deno.bundle.Result = await Deno.bundle({
            ...lBaseBundleConfiguration,
            entrypoints: lAllEntrypoints,
        });

        // On any error, throw with all error messages.
        if (!lBundleResult.success || !lBundleResult.outputFiles) {
            throw new Error(lBundleResult.errors.map((pError) => pError.text).join('\n'));
        }

        // Group output files by their path stem (content + source map).
        // Output paths end with .js or .js.map. Two files share a stem when
        // one is {stem}.js and the other is {stem}.js.map.
        const lGroupedByPathStem: Map<string, { content?: Uint8Array<ArrayBuffer>; sourceMap?: Uint8Array<ArrayBuffer>; }> = new Map();

        for (const lOutFile of lBundleResult.outputFiles) {
            // Normalize path separators for consistent matching.
            const lNormalizedPath: string = lOutFile.path.replaceAll('\\', '/');
            let lStem: string;
            let lIsSourceMap: boolean;

            if (lNormalizedPath.endsWith('.js.map')) {
                lStem = lNormalizedPath.substring(0, lNormalizedPath.length - '.js.map'.length);
                lIsSourceMap = true;
            } else if (lNormalizedPath.endsWith('.js')) {
                lStem = lNormalizedPath.substring(0, lNormalizedPath.length - '.js'.length);
                lIsSourceMap = false;
            } else {
                continue; // Skip unknown extensions.
            }

            // Get or create group entry for this stem.
            let lGroup = lGroupedByPathStem.get(lStem);
            if (!lGroup) {
                lGroup = {};
                lGroupedByPathStem.set(lStem, lGroup);
            }

            // Assign content or source map.
            if (lOutFile.contents) {
                if (lIsSourceMap) {
                    lGroup.sourceMap = lOutFile.contents;
                } else {
                    lGroup.content = lOutFile.contents;
                }
            }
        }

        // Map output groups back to input files by matching filename stems.
        // Deno outputs files as {outputDir}/{inputStem}.js, so we match by filename without extension.
        const lBuildOutput: EnvironmentBundleOutput = [];

        for (const lFile of pOptions.files) {
            // Get the input file's filename without extension (stem).
            const lInputInfo: PathInformation = FileSystem.pathInformation(lFile.inputFilePath);
            const lInputStem: string = lInputInfo.filename; // filename without extension.

            // Find the matching output group by comparing the last path segment (filename stem).
            let lMatchedGroup: { content?: Uint8Array<ArrayBuffer>; sourceMap?: Uint8Array<ArrayBuffer>; } | undefined;
            for (const [lStem, lGroup] of lGroupedByPathStem) {
                // Extract the filename stem from the output path stem.
                const lOutputStem: string = lStem.substring(lStem.lastIndexOf('/') + 1);
                if (lOutputStem === lInputStem) {
                    lMatchedGroup = lGroup;
                    break;
                }
            }

            // Missing everything.
            if (!lMatchedGroup) {
                throw new Error(`Output file not emitted for input file: ${lFile.inputFilePath}`);
            }

            // Missing content.
            if (!lMatchedGroup.content) {
                throw new Error(`Output file content not emitted for input file: ${lFile.inputFilePath}`);
            }

            // Missing source map.
            if (!lMatchedGroup.sourceMap) {
                throw new Error(`Output file map not emitted for input file: ${lFile.inputFilePath}`);
            }

            // Replace sourcemap URL with the desired output basename and extension.
            // The sourcemap URL in the output references the input file stem (e.g. "index.js.map").
            const lSourceText: string = new TextDecoder().decode(lMatchedGroup.content).replace(
                `//# sourceMappingURL=${lInputStem}.js.map`,
                `//# sourceMappingURL=${lFile.outputBasename}.${lFile.outputExtension}.map`
            );

            // Encode text again into Uint8Array.
            const lContent: Uint8Array<ArrayBuffer> = new TextEncoder().encode(lSourceText);

            // Add file to output.
            lBuildOutput.push({
                content: lContent,
                fileName: `${lFile.outputBasename}.${lFile.outputExtension}`,
                sourceMap: lMatchedGroup.sourceMap
            });
        }

        return lBuildOutput;
    }
}

export type EnvironmentBundleInputFile = {
    /**
     * Absolute path of input file.
     */
    inputFilePath: string;

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