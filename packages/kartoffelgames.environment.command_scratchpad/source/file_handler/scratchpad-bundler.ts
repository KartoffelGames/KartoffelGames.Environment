import { EnvironmentBundle, EnvironmentBundleExtentionLoader, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from "@kartoffelgames/environment-command-bundle";
import { CliParameter, Console, FileSystem, PackageInformation, Project } from '@kartoffelgames/environment-core';
import { EnvironmentBundleInputContent } from "../../../kartoffelgames.environment.bundle/source/environment-bundle.ts";

export class ScratchpadBundler {
    private readonly mCoreBundleRequired: boolean;
    private readonly mPackageInformation: PackageInformation;
    private readonly mProjectHandler: Project;
    private readonly mBuildFiles: ScratchpadBundlerBuildedFiles;
    private readonly mModuleDeclaration: string;

    /**
     * Get source file.
     */
    public get sourceFile(): Uint8Array {
        return this.mBuildFiles.javascriptFileContent;
    }

    /**
     * Get source map file.
     */
    public get sourceMapFile(): Uint8Array {
        return this.mBuildFiles.mapFileContent;
    }

    /**
     * Constructor.
     * 
     * @param pProjectHandler - Project handler.
     * @param pPackageInformation - Package information.
     * @param pModuleDeclaration - Module declaration.
     * @param pCoreBundleRequired - Bundle of core source files required.
     */
    public constructor(pProjectHandler: Project, pPackageInformation: PackageInformation, pModuleDeclaration: string, pCoreBundleRequired: boolean) {
        this.mProjectHandler = pProjectHandler;
        this.mPackageInformation = pPackageInformation;
        this.mModuleDeclaration = pModuleDeclaration;
        this.mCoreBundleRequired = pCoreBundleRequired;
        this.mBuildFiles = {
            javascriptFileContent: new Uint8Array(0),
            mapFileContent: new Uint8Array(0),
        };
    }

    /**
     * Rebuild scratchpad files.
     * When build is required, main source is build first with the native kg bundle command.
     */
    public async bundle(): Promise<boolean> {
        const lConsole = new Console();

        // Build native when native is required.
        if (this.mCoreBundleRequired) {
            // Create main build parameter with force flag.
            const lMainBuildParameter: CliParameter = new CliParameter();
            lMainBuildParameter.parameter.set('package_name', this.mPackageInformation.packageName);
            lMainBuildParameter.flags.add('force');

            // Create bundle command.
            const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

            // Try to build main source.
            try {
                await lMainBundleCommand.run(lMainBuildParameter, this.mProjectHandler);
            } catch (e) {
                lConsole.writeLine('Failed to bundle core source.', 'red');
                lConsole.writeLine((<Error>e).message, 'red');
            }
        }

        // Create default scratchpad input.
        const lBundleSettings: EnvironmentBundleInputContent = {
            inputResolveDirectory: './scratchpad/source/',
            outputBasename: 'scratchpad',
            outputExtension: 'js',
            inputFileContent:
                "(() => {\n" +
                "    const socket = new WebSocket('ws://127.0.0.1:8888');\n" +
                "    socket.addEventListener('open', () => {\n" +
                "        console.log('Refresh connection established');\n" +
                "    });\n" +
                "    socket.addEventListener('message', (event) => {\n" +
                "        console.log('Build finished. Start refresh');\n" +
                "        if (event.data === 'REFRESH') {\n" +
                "            window.location.reload();\n" +
                "        }\n" +
                "    });\n" +
                "})();\n" +
                "import './index.ts';\n"
        };

        // Create environment bundle.
        const lEnvironmentBundle: EnvironmentBundle = new EnvironmentBundle();

        // Load local resolver from module declaration
        let lLoader: EnvironmentBundleExtentionLoader = (() => {
            const lModuleDeclarationFilePath = FileSystem.pathToAbsolute(this.mPackageInformation.directory, this.mModuleDeclaration);

            // Check for file exists.
            if (!FileSystem.exists(lModuleDeclarationFilePath)) {
                lConsole.writeLine(`No module declaration found in "${lModuleDeclarationFilePath}". Skipping.`, 'yellow');

                // Use empty loader to load with default loader.
                return {};
            }

            // Check for path is a file.
            if (!FileSystem.pathInformation(lModuleDeclarationFilePath).isFile) {
                lConsole.writeLine(`Invalid module declaration file "${lModuleDeclarationFilePath}". Skipping.`, 'yellow');

                // Use empty loader to load with default loader.
                return {};
            }

            // Read module declaration file content.
            const lModuleDeclarationFileContent = FileSystem.read(lModuleDeclarationFilePath);

            // Read module declaration text from file.
            return lEnvironmentBundle.fetchLoaderFromModuleDeclaration(lModuleDeclarationFileContent);
        })();

        // Start bundling.
        const lBuildResult: { content: Uint8Array, sourcemap: Uint8Array; } = await (async () => {
            try {
                // Run bundle.
                const lBundleResult: EnvironmentBundleOutput = await lEnvironmentBundle.bundlePackageContent(this.mPackageInformation, lBundleSettings, lLoader);

                // Return build result. Its allways one file.
                return {
                    content: lBundleResult[0].content,
                    sourcemap: lBundleResult[0].sourceMap
                };
            } catch (e) {
                // Pass through error message.
                lConsole.writeLine((<Error>e).message, 'red');

                // Return empty build result on error.
                return {
                    content: new Uint8Array(0),
                    sourcemap: new Uint8Array(0)
                };
            }
        })();

        // Cache build files.
        const lTextDecoder = new TextDecoder();
        if (lTextDecoder.decode(this.mBuildFiles.javascriptFileContent) === lTextDecoder.decode(lBuildResult.content)) {
            // Signal build was not changed.
            return false;
        }

        // Cache build files.
        this.mBuildFiles.javascriptFileContent = lBuildResult.content;
        this.mBuildFiles.mapFileContent = lBuildResult.sourcemap;

        return true;
    }
}

type ScratchpadBundlerBuildedFiles = {
    javascriptFileContent: Uint8Array;
    mapFileContent: Uint8Array;
};