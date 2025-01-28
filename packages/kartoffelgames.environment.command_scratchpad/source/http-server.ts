import { EnvironmentBundle, EnvironmentBundleOutput, EnvironmentSettingFiles } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';

export class HttpServer {
    private readonly mWatchPaths: Array<string>;
    private readonly mBuildFiles: HttpServerBuildFiles;
    private readonly mPort: number;
    private readonly mRootPath: string;

    public constructor(pWatchPaths: Array<string>, pPort: number, pRootPath: string) {
        this.mWatchPaths = pWatchPaths;
        this.mPort = pPort;
        this.mRootPath = pRootPath;
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
    public start(): void {
        // Standalone web server.
        this.startWebserver(this.mPort, this.mRootPath);

        this.startWatcher(this.mWatchPaths, async () => {
            await this.rebuildBuildFiles();
            this.triggerBrowserRefresh();
        });

    }

    private async rebuildBuildFiles(): Promise<void> {
        const lConsole = new Console();

        // Start bundling.
        const lBundleResult: EnvironmentBundleOutput = await new EnvironmentBundle().bundle(pProjectHandler, lPackageInformation, lEnvironmentSettingFiles);

        // Output build warn console.
        for (const lOutput of lBundleResult.console.errors) {
            lConsole.writeLine(lOutput, 'yellow');
        }

        // Output build error console.
        for (const lOutput of lBundleResult.console.errors) {
            lConsole.writeLine(lOutput, 'red');
        }

        // Cache build files.
        this.mBuildFiles.javascriptFileContent = lBundleResult.files[0].content;
        this.mBuildFiles.mapFileContent = lBundleResult.files[0].soureMap;
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
        Deno.serve({ port: pPort, hostname: '127.0.0.1' }, async (pReqest): Promise<Response> => {
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
                if (FileSystem.pathInformation(lFilePath).extension === '') {
                    lExistigFilePath = FileSystem.pathToAbsolute(lFilePath, 'index.html');
                }

                // Check if file exists again, just in case the file path was extended.
                if (FileSystem.exists(lExistigFilePath)) {
                    const lFileInformation = FileSystem.pathInformation(lExistigFilePath);

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

    private triggerBrowserRefresh(): void {
        // TODO: Implement browser refresh with webpack.
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