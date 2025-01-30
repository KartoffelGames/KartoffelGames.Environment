import { FileSystem, PackageInformation, PathInformation } from '@kartoffelgames/environment-core';
import { denoPlugins } from "@luca/esbuild-deno-loader";
import * as esbuild from 'esbuild';

export class EnvironmentBundle {
    /**
     * Bundle a custom content in the context of a package with set settings and loader.
     * 
     * @param pPackageInformation - Package information.
     * @param pInputContent - Input source content.
     * @param pLoader - file extension loader.
     *  
     * @returns Build output of webpack build. 
     */
    public async bundlePackageContent(pPackageInformation: PackageInformation, pInputContent: EnvironmentBundleInputContent, lLoader: EnvironmentBundleExtentionLoader): Promise<EnvironmentBundleOutput> {
        // Convert the relative resolve path into a absolute path.
        pInputContent.outputBasename = pInputContent.outputBasename.replace('<packagename>', pPackageInformation.idName);
        pInputContent.inputResolveDirectory = FileSystem.pathToAbsolute(pPackageInformation.directory, pInputContent.inputResolveDirectory);

        // Build bundle options.
        const lEnvironmentBundleOptions: EnvironmentBundleOptions = {
            loader: lLoader,

            // For some higher reason the deno plugins does not have the correct type definition.
            plugins: [...denoPlugins({
                configPath: FileSystem.pathToAbsolute(pPackageInformation.directory, 'deno.json')
            })] as unknown as Array<esbuild.Plugin>,
            
            entry: {
                content: pInputContent
            }
        };

        // Run bundle.
        return this.runBundleProcess(lEnvironmentBundleOptions);
    }

    /**
     * Bundle package files with set settings and loader.
     * 
     * @param pPackageInformation - Package information.
     * @param pInputFiles - Input files.
     * @param pLoader - file extension loader.
     *  
     * @returns Build output of webpack build. 
     */
    public async bundlePackageFiles(pPackageInformation: PackageInformation, pInputFiles: EnvironmentBundleInputFiles, pLoader: EnvironmentBundleExtentionLoader): Promise<EnvironmentBundleOutput> {
        // Convert input files into a proper input file format the bundler command understands.
        const lInputFile = pInputFiles.map((pInputFile) => {
            return {
                // Replace <packagename> with package name.
                outputBasename: pInputFile.outputBasename.replace('<packagename>', pPackageInformation.idName),
                // Convert entry point path into absolute file path rooted in the package directory.
                inputFilePath: FileSystem.pathToAbsolute(pPackageInformation.directory, pInputFile.inputFilePath),
                outputExtension: pInputFile.outputExtension
            };
        });

        // Build bundle options.
        const lEnvironmentBundleOptions: EnvironmentBundleOptions = {
            loader: pLoader,

            // For some higher reason the deno plugins does not have the correct type definition.
            plugins: [...denoPlugins({
                configPath: FileSystem.pathToAbsolute(pPackageInformation.directory, 'deno.json')
            })] as unknown as Array<esbuild.Plugin>,

            entry: {
                files: lInputFile
            }
        };

        // Run bundle.
        return this.runBundleProcess(lEnvironmentBundleOptions);
    }

    /**
     * Read all module declarations for file.
     * @param pModuleDeclaration - Module declaration file content.
     * 
     * @returns Loader list.
     */
    public fetchLoaderFromModuleDeclaration(pModuleDeclaration: string): EnvironmentBundleExtentionLoader {
        // Regex to read information from a module declaration.
        /*
         * declare module '*.css' { 
         *   const text: string;
         *   export default text;
         * }
         */
        const lFileExtensionRegex = /declare\s+module\s+(?:"|')\*([.a-zA-Z0-9]+)(?:"|')\s*\{[^\}]*export\s+default\s+([a-zA-Z0-9]+)[^\}]*\}/gms;

        // Get all declaration informations by reading the extension and the loader information from the comment.
        const lLoaderList: EnvironmentBundleExtentionLoader = {};

        // Read all module declarations.
        for (const lMatch of pModuleDeclaration.matchAll(lFileExtensionRegex)) {
            // Get extension and assigned loader.
            const lExtension: string = lMatch[1];
            const lLoader: string = lMatch[2];

            // Add found to loader list.
            lLoaderList[lExtension] = lLoader as EnvironmentBundleLoader;
        }

        return lLoaderList;
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
            platform: "neutral",
            format: "esm",
            target: "esnext",

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
        if (pOptions.entry.files) {
            // Convert entry files into a filename to input file mapping.
            const lEntryPoints: { [key: string]: string; } = {};
            for (const lInputFile of pOptions.entry.files) {
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
        } else if (pOptions.entry.content) {
            // Configurate a stdin content.
            lEsBuildConfiguration.stdin = {
                contents: pOptions.entry.content.inputFileContent,
                resolveDir: pOptions.entry.content.inputResolveDirectory,
                loader: 'ts',
                sourcefile: `standard-input-file.js`
            };

            // Add input file name. For some reason esbuild allways uses stdin.js as an output file name for stdin content.
            lInputFileNames.push({
                outputBaseName: 'stdin',
                basename: pOptions.entry.content.outputBasename,
                extension: pOptions.entry.content.outputExtension
            });
        } else {
            throw new Error('No file input was specified.');
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

export type EnvironmentBundleLoader = "base64" | "dataurl" | "empty" | "js" | "json" | "text" | "ts";
export type EnvironmentBundleExtentionLoader = { [extension: string]: EnvironmentBundleLoader; };

export type EnvironmentBundleInputFiles = Array<{
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
}>;

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

export type EnvironmentBundleSettingFiles = {
    moduleDeclarationFilePath: string | null;
    bundleSettingsFilePath: string | null;
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


type EnvironmentBundleOptions = {
    plugins: Array<esbuild.Plugin>;
    loader: EnvironmentBundleExtentionLoader;
    entry: {
        files?: EnvironmentBundleInputFiles;
        content?: EnvironmentBundleInputContent;
    };
};