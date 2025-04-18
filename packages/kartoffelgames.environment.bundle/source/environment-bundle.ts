import { FileSystem, Import, type Package, type PathInformation } from '@kartoffelgames/environment-core';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import * as esbuild from 'esbuild';

export class EnvironmentBundle {
    /**
     * Bundle a package with set settings and loader.
     * 
     * @param pPackage - Package to bundle.
     * @param pOptions - Bundle options.
     * 
     * @returns Build output of esbuild build. 
     */
    public async bundle(pPackage: Package, pOptions: EnvironmentBundleOptions): Promise<EnvironmentBundleOutput> {
        // Normalize bundle options.
        const lEnvironmentBundleOptions: EnvironmentBundleOptions = {
            ...pOptions,
            plugins: [...pOptions.plugins]
        };

        // Normalize bundle plugins.
        lEnvironmentBundleOptions.plugins.unshift(...denoPlugins({ configPath: FileSystem.pathToAbsolute(pPackage.directory, 'deno.json') }));

        // Normalize input files.
        lEnvironmentBundleOptions.files = (() => {
            // Based on entry type.
            if (Array.isArray(pOptions.files)) {
                return pOptions.files.map((pInputFile) => {
                    return {
                        ...pInputFile,
                        // Replace <packagename> with package name.
                        outputBasename: pInputFile.outputBasename.replace('<packagename>', pPackage.id),
                        // Convert entry point path into absolute file path rooted in the package directory.
                        inputFilePath: FileSystem.pathToAbsolute(pPackage.directory, pInputFile.inputFilePath),
                        outputExtension: pInputFile.outputExtension
                    };
                });
            } else {
                return {
                    ...pOptions.files,
                    outputBasename: pOptions.files.outputBasename.replace('<packagename>', pPackage.id),
                    // Convert the relative resolve path into a absolute path.
                    inputResolveDirectory: FileSystem.pathToAbsolute(pPackage.directory, pOptions.files.inputResolveDirectory)
                } satisfies EnvironmentBundleInputContent;
            }
        })();

        // Bundle based on entry type.
        return this.runBundleProcess(lEnvironmentBundleOptions);
    }

    /**
     * Bundle package with the bundle options specified in the package deno.json.
     * 
     * @param pPackage - Package bundle.
     * @param pOverrideCallback  - Override functionality of bundle options.
     * 
     * @returns Bundle output.
     */
    public async loadBundleOptions(pBundleSettingFilePath: string | null): Promise<EnvironmentBundleOptions> {
        // Load local bundle settings.
        let lBundleOptions: Partial<EnvironmentBundleOptions> = await (async () => {
            // Use default settings.
            if (!pBundleSettingFilePath || pBundleSettingFilePath.trim() === '') {
                return {};
            }

            const lBundleSettingsFilePath = FileSystem.pathToAbsolute(pBundleSettingFilePath);

            // Check for file exists.
            if (!FileSystem.exists(lBundleSettingsFilePath)) {
                throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
            }

            // Check for file exists.
            if (!FileSystem.exists(lBundleSettingsFilePath)) {
                throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
            }

            // Import bundle as js file.
            const lBundleSettingObject: { default: () => EnvironmentBundleOptions; } = await Import.import(`file://${lBundleSettingsFilePath}`);
            if (typeof lBundleSettingObject.default !== 'function') {
                throw new Error(`Bundle settings file does not export a default function: ${lBundleSettingsFilePath}`);
            }

            return lBundleSettingObject.default();

        })();

        // Extend bundle files options when information was not set.
        if (!lBundleOptions.files) {
            lBundleOptions.files = []; // Default files.
        }

        // Extend bundle loader when information was not set.
        if (!lBundleOptions.loader) {
            lBundleOptions.loader = {}; // Default loader.
        }

        // Extend bundle plugins when information was not set.
        if (!lBundleOptions.plugins) {
            lBundleOptions.plugins = []; // Default plugins.
        }

        // Extend bundle mime types when information was not set.
        if (!lBundleOptions.mimeTypes) {
            lBundleOptions.mimeTypes = {}; // Default mime types.
        }

        // Start bundling.
        return lBundleOptions as EnvironmentBundleOptions;
    }

    /**
     * Run a generic bundle process.
     * 
     * @param pOptions - Bundle options.
     * 
     * @returns bundle output files. 
     */
    private async runBundleProcess(pOptions: EnvironmentBundleOptions): Promise<EnvironmentBundleOutput> {
        // Create esbuild configuration object.
        const lEsBuildConfiguration: esbuild.BuildOptions = {
            // User setupable.
            plugins: pOptions.plugins,
            loader: pOptions.loader,

            // Default settings.
            bundle: true,
            platform: 'neutral',
            format: 'esm',
            target: "es2022",

            // Optimization.
            minify: true,
            sourcemap: true,
            treeShaking: true,

            // Write to memory.
            write: false,
            outdir: 'out'
        };

        // List of input names and their expected output names.
        const lInputFileNames: Array<{ outputBaseName: string; basename: string; extension: string; }> = new Array<{ outputBaseName: string; basename: string; extension: string; }>();

        // Eighter build files or a file content.
        if (Array.isArray(pOptions.files)) {
            // Convert entry files into a filename to input file mapping.
            const lEntryPoints: { [key: string]: string; } = {};
            for (const lInputFile of pOptions.files) {
                // Add input file path. Prepend file:// to make it a valid url.
                lEntryPoints[lInputFile.outputBasename] = `file://${lInputFile.inputFilePath}`;

                // Add input file name.
                lInputFileNames.push({
                    outputBaseName: lInputFile.outputBasename,
                    basename: lInputFile.outputBasename,
                    extension: lInputFile.outputExtension
                });
            }

            lEsBuildConfiguration.entryPoints = lEntryPoints;
        } else {
            // Configurate a stdin content.
            lEsBuildConfiguration.stdin = {
                contents: pOptions.files.inputFileContent,
                resolveDir: pOptions.files.inputResolveDirectory,
                loader: 'ts',
                sourcefile: `standard-input-file.js`
            };

            // Add input file name. For some reason esbuild allways uses stdin.js as an output file name for stdin content.
            lInputFileNames.push({
                outputBaseName: 'stdin',
                basename: pOptions.files.outputBasename,
                extension: pOptions.files.outputExtension
            });
        }

        // Start esbuild.
        const lBuildResult = await esbuild.build(lEsBuildConfiguration);

        // On any error, return an empty result.
        if (!lBuildResult.outputFiles) {
            return [];
        }

        // Grouped file output with its source map.
        const lFileOutput: { [fileName: string]: Partial<EnvironmentBundleOutput[number]>; } = {};

        // Read and map all output files that belong to each other.
        for (const lOutFile of lBuildResult.outputFiles) {
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

            // Add eighter content or source map, based on file extension, to the file output entry.
            if (lOutFileInformation.extension === '.js') {
                lFileOutputEntry.content = lOutFile.contents;
            } else if (lOutFileInformation.extension === '.map') {
                lFileOutputEntry.sourceMap = lOutFile.contents;
            }
        }

        // Read all output files and convert into EnvironmentBuildedFiles.
        const lBuildOutput: EnvironmentBundleOutput = [];

        // Map output files with the coresponding input files.
        for (const lInputFile of lInputFileNames) {
            const lFileOutputEntry: Partial<EnvironmentBundleOutput[number]> | undefined = lFileOutput[lInputFile.outputBaseName];

            // Missing everything.
            if (!lFileOutputEntry) {
                throw new Error(`Output file not emited for input file: ${lInputFile.basename}`);
            }

            // Missing content.
            if (!lFileOutputEntry.content) {
                throw new Error(`Output file content not emited for input file: ${lInputFile.basename}`);
            }

            // Missing source map.
            if (!lFileOutputEntry.sourceMap) {
                throw new Error(`Output file map not emited for input file: ${lInputFile.basename}`);
            }

            // Replace sourcemap url in output file when the output file name is different from the input file name.
            if (lInputFile.outputBaseName !== lInputFile.basename) {
                // Convert Uint8Array into text. Replace sourcemapping url.
                const lSourceText: string = new TextDecoder().decode(lFileOutputEntry.content).replace(
                    `//# sourceMappingURL=${lInputFile.outputBaseName}.js.map`,
                    `//# sourceMappingURL=${lInputFile.basename}.${lInputFile.extension}.map`
                );

                // Encode text again into Uint8Array
                lFileOutputEntry.content = new TextEncoder().encode(lSourceText);
            }

            // Add file to output.
            lBuildOutput.push({
                content: lFileOutputEntry.content,
                fileName: `${lInputFile.basename}.${lInputFile.extension}`,
                sourceMap: lFileOutputEntry.sourceMap
            });
        }

        // Wait for the esbuild process to stop before returning the output.
        await esbuild.stop();

        return lBuildOutput;
    }
}

export type EnvironmentBundleExtentionLoader = { [extension: string]: 'base64' | 'dataurl' | 'empty' | 'js' | 'json' | 'text' | 'ts'; };

export type EnvironmentBundleInputFile = {
    /**
     * Relative path of input file.
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

export type EnvironmentBundleInputContent = {
    /**
     * Relative path all relative paths respond to.
     */
    inputResolveDirectory: string;

    /**
     * Source content of input file.
     */
    inputFileContent: string;

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
    content: Uint8Array;

    /**
     * Filename without extension.
     */
    fileName: string;

    /**
     * Files source map.
     */
    sourceMap: Uint8Array;
}>;

export type EnvironmentBundleOptions = {
    plugins: Array<esbuild.Plugin>;
    loader: EnvironmentBundleExtentionLoader;
    files: Array<EnvironmentBundleInputFile> | EnvironmentBundleInputContent;
    /**
     * Types of bundled files. Extensions are specified with leading dot.
     */
    mimeTypes: { [extension: string]: string; };
};