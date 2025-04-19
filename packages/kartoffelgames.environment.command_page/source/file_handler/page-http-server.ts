import { EnvironmentBundle, type EnvironmentBundleOptions } from '@kartoffelgames/environment-bundle';
import { Console, FileSystem, Package } from '@kartoffelgames/environment-core';


export class PageHttpServer {
    private readonly mBundledSettingFilePath: string;
    private readonly mOpenWebsockets: Set<WebSocket>;
    private readonly mPackage: Package;
    private readonly mPort: number;
    private readonly mRootPath: string;
    private mServer: Deno.HttpServer<Deno.NetAddr> | null;

    /**
     * Constructor.
     * 
     * @param pPort - Listening port.
     * @param pRootPath - Root path for webserver files.
     */
    public constructor(pPackage: Package, pPort: number, pRootPath: string, pBundledSettingFilePath: string) {
        this.mPackage = pPackage;
        this.mPort = pPort;
        this.mRootPath = pRootPath;
        this.mOpenWebsockets = new Set<WebSocket>();
        this.mServer = null;
        this.mBundledSettingFilePath = pBundledSettingFilePath;
    }

    /**
     * Trigger a browser refresh for all connected websockets.
     */
    public refreshConnectedBrowser(): void {
        const lConsole = new Console();

        lConsole.writeLine('Refreshing browser...');
        for (const lSocket of this.mOpenWebsockets) {
            lSocket.send('REFRESH');
        }
    }

    /**
     * Start webserver.
     * Listens on localhost and serves files from root path.
     * Serves bundled files from library directory when any /bundle/ path is requested.
     * Serves page.js and page.js.map from cache only on root path.
     * 
     * @param pPort - Listening port.
     * @param pRootPath - Root path for webserver files.
     */
    public async start(): Promise<void> {
        // Prevent server from starting multiple times.
        if (this.mServer !== null) {
            return this.mServer.finished;
        }

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

        // Create environment bundle object.
        const lEnvironmentBundle = new EnvironmentBundle();

        // Load local bundle settings.
        const lBundleSettingsFilePath: string | null = this.mBundledSettingFilePath.trim() !== '' ? FileSystem.pathToAbsolute(this.mPackage.directory, this.mBundledSettingFilePath) : null;
        const lBundleOptions: EnvironmentBundleOptions = await lEnvironmentBundle.loadBundleOptions(lBundleSettingsFilePath);

        // Load additional mime types from bundle settings file.
        for(const [lExtension, lMimeType] of Object.entries(lBundleOptions.mimeTypes)) {
            lMimeTypeMapping.set(lExtension, lMimeType);
        }

        // Start webserver on defined port.
        this.mServer = Deno.serve({ port: this.mPort, hostname: '127.0.0.1' }, async (pReqest: Request): Promise<Response> => {
            // Upgrade to websocket.
            if (pReqest.headers.get('upgrade') === 'websocket') {
                return this.upgradeToWebsocketConnection(pReqest);
            }

            const lFilePathName: string = new URL(pReqest.url).pathname;
            let lFilePath: string = FileSystem.pathToAbsolute(this.mRootPath, '.' + lFilePathName);

            // Special case for bundle directory.
            if (lFilePathName.toLowerCase().startsWith('/bundle/')) {
                lFilePath = FileSystem.pathToAbsolute(this.mRootPath, '..', 'library', lFilePathName.substring(8));
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

                    // Try catch when file is locked or locking while reading.
                    try {
                        // Open file and return response.
                        const lFile = await Deno.open(lExistigFilePath, { read: true });
                        return new Response(lFile.readable, { headers: { 'Content-Type': lMimeTypeMapping.get(lFileInformation.extension) ?? 'text/plain' } });
                    } catch (pError) {
                        // Somthing went wrong idk what.
                        return new Response('File could not be read.' + pError, { status: 500 });
                    }
                }
            }

            return new Response('404 Not Found', { status: 404 });
        });

        // Return promise that resolves once the server is closed.
        return this.mServer.finished;
    }

    /**
     * Stop webserver.
     */
    public stop(): void {
        if (this.mServer !== null) {
            this.mServer.shutdown();
            this.mServer = null;
        }
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
        lSocket.addEventListener('open', () => {
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
}