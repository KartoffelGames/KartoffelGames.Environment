import { PackageInformation, Project, FileSystem, PathInformation, Package } from '@kartoffelgames/environment-core';
import * as esbuild from 'esbuild';
import { denoPlugins } from "@luca/esbuild-deno-loader";

export class EnvironmentBundle {
    /**
     * 
     * @param pProject - Project.
     * @param pPackageInformation - Package information.
     *  
     * @returns Build output of webpack build. 
     */
    public async bundleProject(pProject: Project, pPackageInformation: PackageInformation, pSettingFiles: EnvironmentSettingFiles): Promise<EnvironmentBundleOutput> {
        // Load local bundle settings.
        const lBundleSettings: EnvironmentBundleSettings = await (async () => {
            if (pSettingFiles.bundleSettingsFilePath) {
                // Create local bundle settings file path.
                const lBundleSettingsFilePath: string = FileSystem.pathToAbsolute(pProject.projectRootDirectory, pPackageInformation.directory, pSettingFiles.bundleSettingsFilePath);

                // Check for file exists.
                if (!FileSystem.exists(lBundleSettingsFilePath)) {
                    throw new Error(`Bundle settings file not found: ${lBundleSettingsFilePath}`);
                }

                // Import bundle as js file.
                const lBundleSettingObject: { default: EnvironmentBundleSettings; } = await Package.import(`file://${lBundleSettingsFilePath}`);

                return lBundleSettingObject.default;
            }

            // Use default settings.
            return {
                inputFiles: [{
                    path: './source/index.ts',
                    basename: '<packagename>',
                    extension: 'js'
                }]
            };
        })();

        // Load local resolver from module declaration
        let lLoader: { [ext: string]: esbuild.Loader; } = (() => {
            if (pSettingFiles.moduleDeclarationFilePath) {
                // Create local module declaration file path.
                const lModuleDeclarationFilePath: string = FileSystem.pathToAbsolute(pProject.projectRootDirectory, pPackageInformation.directory, pSettingFiles.moduleDeclarationFilePath);

                // Check for file exists.
                if (!FileSystem.exists(lModuleDeclarationFilePath)) {
                    throw new Error(`Module declaration file not found: ${lModuleDeclarationFilePath}`);
                }

                // Read module declaration file content.
                const lModuleDeclarationFileContent = FileSystem.read(lModuleDeclarationFilePath);

                // Read module declaration text from file.
                return this.loadModuleExtensions(lModuleDeclarationFileContent);
            }

            // Use empty / default loader.
            return {};
        })();

        // Replace <packagename> with package name and convert entry point path into absolute file path url.
        lBundleSettings.inputFiles = lBundleSettings.inputFiles.map((pInputFile) => {
            return {
                basename: pInputFile.basename.replace('<packagename>', pPackageInformation.idName),
                path: 'file://' + FileSystem.pathToAbsolute(pPackageInformation.directory, pInputFile.path),
                extension: pInputFile.extension
            };
        });

        // Create custom entry point for each file.
        const lEntryPoints: { [key: string]: string; } = {};
        for (const lInputFile of lBundleSettings.inputFiles) {
            lEntryPoints[lInputFile.basename] = lInputFile.path;
        }

        // Create bundle settings.
        const lBuildResult = await esbuild.build({
            // User setupable.
            plugins: [...denoPlugins({
                configPath: FileSystem.pathToAbsolute(pPackageInformation.directory, 'deno.json')
            })] as unknown as Array<esbuild.Plugin>,
            entryPoints: lEntryPoints,
            loader: lLoader,

            // Default settings.
            bundle: true,
            platform: "neutral",
            format: "esm",
            target: "esnext",

            // Optimization.
            minify: true,
            sourcemap: 'external',
            treeShaking: true,

            // Write to memory.
            write: false,
            outdir: 'out'
        });
        await esbuild.stop();

        // Read all output files and convert into EnvironmentBuildedFiles.
        const lBuildOutput: EnvironmentBundleOutput = {
            files: [],
            console: {
                warnings: lBuildResult.warnings.map(pWarning => pWarning.text),
                errors: lBuildResult.errors.map(pError => pError.text)
            }
        };

        // On any error, return an empty result.
        if (lBuildResult.errors.length > 0) {
            return lBuildOutput;
        }

        // Grouped file output with its source map.
        const lFileOutput: { [fileName: string]: Partial<EnvironmentBundleFile>; } = {};

        // Read and save all output files.
        for (const lOutFile of lBuildResult.outputFiles) {
            const lOutFileInformation: PathInformation = FileSystem.pathInformation(lOutFile.path);

            // Get file name without extension. When it ends with .js it is a map file.
            let lOutFileName: string = lOutFileInformation.filename;
            if (lOutFileName.endsWith('.js')) {
                lOutFileName = lOutFileName.substring(0, lOutFileName.length - 3);
            }

            // Get or create file output entry.
            let lFileOutputEntry: Partial<EnvironmentBundleFile> | undefined = lFileOutput[lOutFileName];
            if (!lFileOutputEntry) {
                lFileOutputEntry = { fileName: lOutFileName };
                lFileOutput[lOutFileName] = lFileOutputEntry;
            }

            // Create a new outfile entry for any new js file.
            if (lOutFileInformation.extension === '.js') {
                lFileOutputEntry.content = lOutFile.contents;
            } else if (lOutFileInformation.extension === '.map') {
                lFileOutputEntry.soureMap = lOutFile.contents;
            }
        }

        // Map output files with the coresponding input files.
        for(const lInputFile of lBundleSettings.inputFiles) {
            const lFileOutputEntry: Partial<EnvironmentBundleFile> | undefined = lFileOutput[lInputFile.basename];
            
            // Missing everything.
            if (!lFileOutputEntry) {
                throw new Error(`Output file not emited for input file: ${lInputFile.basename}`);
            }

            // Missing content.
            if(!lFileOutputEntry.content) {
                throw new Error(`Output file content not emited for input file: ${lInputFile.basename}`);
            }

            // Missing source map.
            if(!lFileOutputEntry.soureMap) {
                throw new Error(`Output file map not emited for input file: ${lInputFile.basename}`);
            }

            // Add file to output.
            lBuildOutput.files.push({
                content: lFileOutputEntry.content,
                fileName: `${lInputFile.basename}.${lInputFile.extension}`,
                soureMap: lFileOutputEntry.soureMap
            });
        }

        return lBuildOutput;
    }

    /**
     * Read all module declarations for file.
     * @param pModuleDeclaration - Module declaration file content.
     * 
     * @returns Loader list.
     */
    private loadModuleExtensions(pModuleDeclaration: string): { [ext: string]: esbuild.Loader; } {
        const lFileExtensionRegex = /declare\s+module\s+(?:"|')\*([.a-zA-Z0-9]+)(?:"|')\s*\{[^\}]*export\s+default\s+([a-zA-Z0-9]+)[^\}]*\}/gms;

        // Get all declaration informations by reading the extension and the loader information from the comment.
        const lLoaderList: { [ext: string]: esbuild.Loader; } = {};

        // Read all module declarations.
        for (const lMatch of pModuleDeclaration.matchAll(lFileExtensionRegex)) {
            // Get extension and assigned loader.
            const lExtension: string = lMatch[1];
            const lLoader: string = lMatch[2];

            // Add found to loader list.
            lLoaderList[lExtension] = lLoader as esbuild.Loader;
        }

        return lLoaderList;
    }
}

export type EnvironmentBundleSettings = {
    inputFiles: Array<{
        /**
         * Relative path of package root.
         */
        path: string;

        /**
         * Base name of file use <packagename> to replace with package name.
         */
        basename: string;

        /**
         * File extension without leading dot.
         */
        extension: string;
    }>;
};

export type EnvironmentBundleOutput = {
    files: Array<EnvironmentBundleFile>;
    console: {
        errors: Array<string>;
        warnings: Array<string>;
    };
};

export type EnvironmentBundleFile = {
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
    soureMap: Uint8Array;
};

export type EnvironmentSettingFiles = {
    moduleDeclarationFilePath: string | null;
    bundleSettingsFilePath: string | null;
};