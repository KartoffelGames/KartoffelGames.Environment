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
        // Replace <packagename> with package name and convert entry point path into absolute file path url.
        pInputFiles = pInputFiles.map((pInputFile) => {
            return {
                outputBasename: pInputFile.outputBasename.replace('<packagename>', pPackageInformation.idName),
                inputFilePath: 'file://' + FileSystem.pathToAbsolute(pPackageInformation.directory, pInputFile.inputFilePath),
                outputExtension: pInputFile.outputExtension
            };
        });

        // Build bundle options.
        const lEnvironmentBundleOptions: EnvironmentBundleOptions = {
            loader: pLoader,
            plugins: [...denoPlugins({
                configPath: FileSystem.pathToAbsolute(pPackageInformation.directory, 'deno.json')
            })] as unknown as Array<esbuild.Plugin>,
            entry: {
                files: pInputFiles
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

        // List of input names.
        const lInputFileNames: Array<{ basename: string; extension: string; }> = new Array<{ basename: string; extension: string; }>();

        // Eighter build files or a file content.
        if (pOptions.entry.files) {
            // Convert entry files into a filename to input file mapping.
            const lEntryPoints: { [key: string]: string; } = {};
            for (const lInputFile of pOptions.entry.files) {
                //
                lEntryPoints[lInputFile.outputBasename] = lInputFile.inputFilePath;

                // Add input file name.
                lInputFileNames.push({
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
                loader: 'ts'
            };

            // Add input file name.
            lInputFileNames.push({
                basename: pOptions.entry.content.outputBasename,
                extension: pOptions.entry.content.outputExtension
            });
        } else {
            throw new Error('No file input was specified.');
        }

        // Create bundle settings.
        const lBuildResult = await esbuild.build(lEsBuildConfiguration);
        await esbuild.stop();

        // Read all output files and convert into EnvironmentBuildedFiles.
        const lBuildOutput: EnvironmentBundleOutput = [];

        // On any error, return an empty result.
        if (lBuildResult.errors.length > 0 || !lBuildResult.outputFiles) {
            return lBuildOutput;
        }

        // Grouped file output with its source map.
        const lFileOutput: { [fileName: string]: Partial<EnvironmentBundleOutput[number]>; } = {};

        // Read and save all output files.
        for (const lOutFile of lBuildResult.outputFiles) {
            const lOutFileInformation: PathInformation = FileSystem.pathInformation(lOutFile.path);

            // Get file name without extension. When it ends with .js it is a map file.
            let lOutFileName: string = lOutFileInformation.filename;
            if (lOutFileName.endsWith('.js')) {
                lOutFileName = lOutFileName.substring(0, lOutFileName.length - 3);
            }

            // Get or create file output entry.
            let lFileOutputEntry: Partial<EnvironmentBundleOutput[number]> | undefined = lFileOutput[lOutFileName];
            if (!lFileOutputEntry) {
                lFileOutputEntry = { fileName: lOutFileName };
                lFileOutput[lOutFileName] = lFileOutputEntry;
            }

            // Create a new outfile entry for any new js file.
            if (lOutFileInformation.extension === '.js') {
                lFileOutputEntry.content = lOutFile.contents;
            } else if (lOutFileInformation.extension === '.map') {
                lFileOutputEntry.sourceMap = lOutFile.contents;
            }
        }

        // Map output files with the coresponding input files.
        for (const lInputFile of lInputFileNames) {
            const lFileOutputEntry: Partial<EnvironmentBundleOutput[number]> | undefined = lFileOutput[lInputFile.basename];

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

            // Add file to output.
            lBuildOutput.push({
                content: lFileOutputEntry.content,
                fileName: `${lInputFile.basename}.${lInputFile.extension}`,
                sourceMap: lFileOutputEntry.sourceMap
            });
        }

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