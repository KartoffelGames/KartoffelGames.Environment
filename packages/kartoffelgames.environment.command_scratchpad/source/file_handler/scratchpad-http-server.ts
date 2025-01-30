import { Console, FileSystem } from '@kartoffelgames/environment-core';

export class ScratchpadHttpServer {
    private readonly mScratchpadFiles: ScratchpadHttpServerScratchpadFiles;
    private readonly mRootPath: string;
    private readonly mPort: number;
    private readonly mOpenWebsockets: Set<WebSocket>;
    private mServer: Deno.HttpServer<Deno.NetAddr> | null;

    /**
     * Constructor.
     * 
     * @param pPort - Listening port.
     * @param pRootPath - Root path for webserver files.
     */
    public constructor(pPort: number, pRootPath: string) {
        this.mPort = pPort;
        this.mRootPath = pRootPath;
        this.mOpenWebsockets = new Set<WebSocket>();
        this.mServer = null;
        this.mScratchpadFiles = {
            source: new Uint8Array(0),
            map: new Uint8Array(0),
        };
    }

    /**
     * Set scratchpad bundle files served by the server.
     * 
     * @param pSourceFile - Javascript source file.
     * @param pSourceMapFile - Source map file.
     */
    public setScratchpadBundle(pSourceFile: Uint8Array, pSourceMapFile: Uint8Array) {
        this.mScratchpadFiles.source = pSourceFile;
        this.mScratchpadFiles.map = pSourceMapFile;
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
     * Serves scratchpad.js and scratchpad.js.map from cache only on root path.
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

        // Start webserver on defined port.
        this.mServer = Deno.serve({ port: this.mPort, hostname: '127.0.0.1' }, async (pReqest: Request): Promise<Response> => {
            // Upgrade to websocket.
            if (pReqest.headers.get("upgrade") === "websocket") {
                return this.upgradeToWebsocketConnection(pReqest);
            }

            const lFilePathName: string = new URL(pReqest.url).pathname;
            let lFilePath: string = FileSystem.pathToAbsolute(this.mRootPath, '.' + lFilePathName);

            // Special case for bundle directory.
            if (lFilePathName.toLowerCase().startsWith('/bundle/')) {
                lFilePath = FileSystem.pathToAbsolute(this.mRootPath, '..', 'library', lFilePathName.substring(7));
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
                        const file = await Deno.open(lExistigFilePath, { read: true });
                        return new Response(file.readable, { headers: { 'Content-Type': lMimeTypeMapping.get(lFileInformation.extension) ?? 'text/plain' } });
                    } catch (e) {
                        // Somthing went wrong idk what.
                        return new Response("File could not be read.", { status: 500 });
                    }
                }
            }

            // Send cached buidl scratchpad.js for a special path.
            if (lFilePathName.toLowerCase() === '/scratchpad.js') {
                return new Response(this.mScratchpadFiles.source, { headers: { 'Content-Type': 'application/javascript' } });
            }

            // Send cached buidl scratchpad.js for a special path.
            if (lFilePathName.toLowerCase() === '/scratchpad.js.map') {
                return new Response(this.mScratchpadFiles.map, { headers: { 'Content-Type': 'application/json' } });
            }

            return new Response("404 Not Found", { status: 404 });
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
}

type ScratchpadHttpServerScratchpadFiles = {
    source: Uint8Array;
    map: Uint8Array;
};