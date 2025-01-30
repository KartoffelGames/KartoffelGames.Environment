import { EnvironmentBundle, EnvironmentBundleExtentionLoader, EnvironmentBundleInputFiles, EnvironmentBundleOutput } from '@kartoffelgames/environment-bundle';
import { KgCliCommand as MainBundleCommand } from "@kartoffelgames/environment-command-bundle";
import { CliParameter, Console, FileSystem, PackageInformation, Project } from '@kartoffelgames/environment-core';

export class HttpServer {
    private readonly mBuildFiles: HttpServerBuildFiles;
    private readonly mConfiguration: HttpServerRunConfiguration;
    private readonly mPackageInformation: PackageInformation;
    private readonly mOpenWebsockets: Set<WebSocket>;

    public constructor(pPackageInformation: PackageInformation, pConfiguration: HttpServerRunConfiguration) {
        this.mPackageInformation = pPackageInformation;
        this.mConfiguration = pConfiguration;
        this.mOpenWebsockets = new Set<WebSocket>();
        this.mBuildFiles = {
            javascriptFileContent: new Uint8Array(0),
            mapFileContent: new Uint8Array(0),
        };
    }

    /**
     * Start http server.
     * Refreshes build files any time a file changes in the watch paths.
     * Triggers a browser refresh after build files are updated.
     */
    public async start(): Promise<void> {
        const lConsole = new Console();

        // Build initial build files.
        lConsole.writeLine("Starting initial build...");
        await this.rebuildBuildFiles();

        // Standalone web server.
        lConsole.writeLine("Starting scratchpad server...");
        this.startWebserver(this.mConfiguration.port, this.mConfiguration.rootPath);

        // Start watcher to rebuild build files and trigger a browser refresh when any watched file changes.
        lConsole.writeLine("Starting watcher...");
        this.startWatcher(this.mConfiguration.watchPaths, async () => {
            if (await this.rebuildBuildFiles()) {
                this.triggerBrowserRefresh();
            }
        });
    }

    /**
     * Rebuild scratchpad files.
     * When build is required, main source is build first with the native kg bundle command.
     */
    private async rebuildBuildFiles(): Promise<boolean> {
        const lConsole = new Console();

        // Build native when native is required.
        if (this.mConfiguration.buildRequired) {
            // Create main build parameter with force flag.
            const lMainBuildParameter: CliParameter = new CliParameter();
            lMainBuildParameter.parameter.set('package_name', this.mPackageInformation.packageName);
            lMainBuildParameter.flags.add('force');

            // Create bundle command.
            const lMainBundleCommand: MainBundleCommand = new MainBundleCommand();

            // Try to build main source.
            try {
                await lMainBundleCommand.run(lMainBuildParameter, this.mConfiguration.project);
            } catch (e) {
                lConsole.writeLine('Failed to build main source.', 'red');
                lConsole.writeLine((<Error>e).message, 'red');
            }
        }

        // Create default scratchpad input.
        const lBundleSettings: EnvironmentBundleInputFiles = [
            {
                inputFilePath: './scratchpad/source/index.ts',
                outputBasename: 'scratchpad',
                outputExtension: '.js'
            }
        ];

        // Create environment bundle.
        const lEnvironmentBundle: EnvironmentBundle = new EnvironmentBundle();

        // Load local resolver from module declaration
        let lLoader: EnvironmentBundleExtentionLoader = (() => {
            const lModuleDeclarationFilePath = FileSystem.pathToAbsolute(this.mPackageInformation.directory, this.mConfiguration.moduleDeclaration);

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
                const lBundleResult: EnvironmentBundleOutput = await lEnvironmentBundle.bundlePackage(this.mPackageInformation, lBundleSettings, lLoader);

                return {
                    content: lBundleResult[0].content,
                    sourcemap: lBundleResult[0].sourceMap
                };
            } catch (e) {
                lConsole.writeLine((<Error>e).message, 'red');

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
            lConsole.writeLine('No changes detected in build files.', 'yellow');

            return false;
        }

        // Cache build files.
        this.mBuildFiles.javascriptFileContent = lBuildResult.content;
        this.mBuildFiles.mapFileContent = lBuildResult.sourcemap;

        // Output build finished.
        lConsole.writeLine('Build finished', 'green');

        return true;
    }

    /**
     * Start webserver.
     * Listens on localhost and serves files from root path.
     * Serves build files from library directory when any /build/ path is requested.
     * Serves scratchpad.js and scratchpad.js.map from cache only on root path.
     * 
     * @param pPort - Listening port.
     * @param pRootPath - Root path for webserver files.
     */
    private startWebserver(pPort: number, pRootPath: string): void {
        // Mime type mapping.
        const lMimeTypeMapping: Map<string, string> = new Map<string, string>();
        lMimeTypeMapping.set('.html', 'text/html');
        lMimeTypeMapping.set('.js', 'application/javascript');
        lMimeTypeMapping.set('.css', 'text/css');
        lMimeTypeMapping.set('.json', 'application/json');
        lMimeTypeMapping.set('.png', 'image/png');
        lMimeTypeMapping.set('.jpg', 'image/jpg');
        lMimeTypeMapping.set('.jpeg', 'image/jpeg');
        lMimeTypeMapping.set('.gif', 'image/gif');
        lMimeTypeMapping.set('.svg', 'image/svg+xml');
        lMimeTypeMapping.set('.ico', 'image/x-icon');

        // Start webserver on defined port.
        Deno.serve({ port: pPort, hostname: '127.0.0.1' }, async (pReqest: Request): Promise<Response> => {
            // Upgrade to websocket.
            if (pReqest.headers.get("upgrade") === "websocket") {
                return this.upgradeToWebsocketConnection(pReqest);
            }

            const lFilePathName: string = new URL(pReqest.url).pathname;
            let lFilePath: string = FileSystem.pathToAbsolute(pRootPath, '.' + lFilePathName);

            // Special case for build directory.
            if (lFilePathName.toLowerCase().startsWith('/build/')) {
                lFilePath = FileSystem.pathToAbsolute(pRootPath, '..', 'library', lFilePathName.substring(7));
            }

            // Send file when it is in fact a file path.
            if (FileSystem.exists(lFilePath)) {
                let lExistigFilePath: string = lFilePath;

                // Read path information to check if it is a directory.
                if (FileSystem.pathInformation(lFilePath).isDirectory) {
                    lExistigFilePath = FileSystem.pathToAbsolute(lFilePath, 'index.html');
                }

                // Check if file exists again, just in case the file path was extended.
                if (FileSystem.exists(lExistigFilePath)) {
                    const lFileInformation = FileSystem.pathInformation(lExistigFilePath);

                    // Open file and return response.
                    const file = await Deno.open(lExistigFilePath, { read: true });
                    return new Response(file.readable, { headers: { 'Content-Type': lMimeTypeMapping.get(lFileInformation.extension) ?? 'text/plain' } });
                }
            }

            // Send cached buidl scratchpad.js for a special path.
            if (lFilePathName.toLowerCase() === '/scratchpad.js') {
                return new Response(this.mBuildFiles.javascriptFileContent, { headers: { 'Content-Type': 'application/javascript' } });
            }

            // Send cached buidl scratchpad.js for a special path.
            if (lFilePathName.toLowerCase() === '/scratchpad.js.map') {
                return new Response(this.mBuildFiles.mapFileContent, { headers: { 'Content-Type': 'application/json' } });
            }

            return new Response("404 Not Found", { status: 404 });
        });
    }

    /**
     * Upgrade a http connection into a websocket connection.
     * 
     * @param pReqest - Http request.
     * 
     * @returns a new websocket connection. 
     */
    private upgradeToWebsocketConnection(pReqest: Request): Response {
        const lConsole = new Console();

        // Upgrade request to websocket.
        const { socket: lSocket, response: lResponse } = Deno.upgradeWebSocket(pReqest);

        // Save socket connection on open.
        lSocket.addEventListener("open", () => {
            lConsole.writeLine('Browser connection established');
            this.mOpenWebsockets.add(lSocket);
        });

        // Remove socket when it is closed.
        lSocket.addEventListener('close', () => {
            lConsole.writeLine('Browser connection lost');
            this.mOpenWebsockets.delete(lSocket);
        });

        return lResponse;
    }

    /**
     * Trigger a browser refresh for all connected websockets.
     */
    private triggerBrowserRefresh(): void {
        const lConsole = new Console();

        lConsole.writeLine('Refreshing browser...');
        for (const lSocket of this.mOpenWebsockets) {
            lSocket.send('REFRESH');
        }
    }

    /**
     * Initialize watcher for scratchpad files.
     * 
     * @param pWatchPaths - Watch paths.
     * @param pWatchCallback - Watch callback.
     */
    public async startWatcher(pWatchPaths: Array<string>, pWatchCallback: () => void): Promise<void> {
        // Init watcher.
        const lWatcher: Deno.FsWatcher = Deno.watchFs(pWatchPaths, { recursive: true });

        // Init debounce timer.
        let lDebounceTimer: number = 0;

        // Start watcher loop asyncron.
        for await (const _ of lWatcher) {
            // Reset debounce timer.
            clearTimeout(lDebounceTimer);

            // Set new debounce timer.
            lDebounceTimer = setTimeout(() => {
                pWatchCallback();
            }, 100);
        }
    }
}

type HttpServerBuildFiles = {
    javascriptFileContent: Uint8Array;
    mapFileContent: Uint8Array;
};

export type HttpServerRunConfiguration = {
    project: Project;
    watchPaths: Array<string>;
    port: number;
    rootPath: string;
    buildRequired: boolean;
    moduleDeclaration: string;
};