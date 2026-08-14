import { type CliCommandDescription, type CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';
import { ScratchpadBundler } from './file_handler/scratchpad-bundler.ts';
import { ScratchpadFileWatcher } from './file_handler/scratchpad-file-watcher.ts';
import { ScratchpadHttpServer } from './file_handler/scratchpad-http-server.ts';

export class KgCliCommand implements ICliPackageCommand<ScratchpadConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<ScratchpadConfiguration> {
        return {
            command: {
                description: 'Serve scratchpad files over local http server.',
                parameters: {
                    root: 'scratchpad',
                }
            },
            configuration: {
                name: 'scratchpad',
                default: {
                    directory: './scratchpad',
                    mimeTypeMapping: {},
                    build: false,
                    port: 8088
                },
            }
        };
    }

    /**
     * Execute command.
     *
     * @param pProjectHandler - Project.
     * @param pPackage - Package the command is applied to.
     * @param _pParameter - Command parameter.
     */
    public async run(pProjectHandler: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to run scratchpad.
        if (pPackage === null) {
            throw new Error('Package to run scratchpad not specified.');
        }

        // Read cli configuration from cli package.
        const lPackageConfiguration = pPackage.cliConfigurationOf(this);

        // Scratchpad directory of www files (configurable).
        const lScratchpadDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, lPackageConfiguration.directory);

        // Create watch paths for package source and scratchpad directory.
        const lWatchPaths: Array<string> = [
            pPackage.sourceDirectory,
            lScratchpadDirectory
        ];

        // Init scratchpad files.
        this.initScratchpadFiles(lScratchpadDirectory);

        // Create console.
        const lConsole = new Console();

        // Build scratchpad http-server, watcher and bundler.
        const lHttpServer: ScratchpadHttpServer = new ScratchpadHttpServer(lPackageConfiguration.port, lScratchpadDirectory, lPackageConfiguration.mimeTypeMapping);
        const lWatcher: ScratchpadFileWatcher = new ScratchpadFileWatcher(lWatchPaths);
        const lScratchpadBundler: ScratchpadBundler = new ScratchpadBundler({
            projectHandler: pProjectHandler,
            package: pPackage,
            build: lPackageConfiguration.build,
            websocketPort: lPackageConfiguration.port,
            directory: lPackageConfiguration.directory,
        });

        // Build initial build files.
        lConsole.writeLine('Starting initial bundle...');
        await lScratchpadBundler.bundle();
        lHttpServer.setScratchpadBundle(lScratchpadBundler.sourceFile, lScratchpadBundler.sourceMapFile);
        
        // Halt other watcher events while one is processing, to prevent concurrent builds.
        let lBuilding: boolean = false;

        // Rebundle scratchpad files and refresh connected browsers when files have changed.
        lWatcher.addListener(async () => {
            // Skip when a build is already running.
            if (lBuilding) {
                return;
            }
            lBuilding = true;

            // Signal the rebuild, since bundling can take a while.
            lConsole.writeLine('File change detected. Bundling...', 'yellow');

            // Bundle files and update server served scratchpad files once they have changed.
            if (await lScratchpadBundler.bundle()) {
                lHttpServer.setScratchpadBundle(lScratchpadBundler.sourceFile, lScratchpadBundler.sourceMapFile);

                // Output bundle finished.
                lConsole.writeLine('Build finished', 'green');
            } else {
                // Signal bundle was not changed.
                lConsole.writeLine('No changes detected in bundled files.', 'yellow');
            }

            lBuilding = false;

            // Refresh connected browsers
            lHttpServer.refreshConnectedBrowser();
        });

        // Start watcher.
        lConsole.writeLine('Starting watcher...');
        lWatcher.start();

        // Start http server asnyc and keep process running as long as server is running.
        lConsole.writeLine('Starting scratchpad server...');
        await lHttpServer.start();
    }

    /**
     * Create the scratchpad directory and its starter files (index.html, index.css, source/index.ts) if they do not
     * already exist.
     *
     * @param pScratchpadDirectory - Absolute path of the scratchpad directory the files are initialized in.
     */
    private initScratchpadFiles(pScratchpadDirectory: string): void {
        const lScratchpadDirectory: string = pScratchpadDirectory;

        // Create scratchpad directorys.
        FileSystem.createDirectory(lScratchpadDirectory);
        FileSystem.createDirectory(FileSystem.pathToAbsolute(lScratchpadDirectory, 'source'));

        // Init html file.
        const lHtmlFile: string = FileSystem.pathToAbsolute(lScratchpadDirectory, 'index.html');
        if (!FileSystem.exists(lHtmlFile)) {
            FileSystem.write(lHtmlFile,
                '<html>\n' +
                '<head>\n' +
                '    <title>Scratchpad</title>\n' +
                '    <link rel="stylesheet" href="./index.css">\n' +
                '    <script src="scratchpad.js" defer></script>\n' +
                '</head>\n' +
                '<body>\n' +
                '    <p>Hello World!!!</p>\n' +
                '</body>\n' +
                '</html>'
            );
        }

        // Init css file.
        const lCssFile: string = FileSystem.pathToAbsolute(lScratchpadDirectory, 'index.css');
        if (!FileSystem.exists(lCssFile)) {
            FileSystem.write(lCssFile,
                'p {\n' +
                '    color: red;\n' +
                '}\n'
            );
        }

        // Init ts file in source directory.
        const lTsFile: string = FileSystem.pathToAbsolute(lScratchpadDirectory, 'source', 'index.ts');
        if (!FileSystem.exists(lTsFile)) {
            FileSystem.write(lTsFile,
                `console.log('Hello World!!!');`
            );
        }
    }
}


type ScratchpadConfiguration = {
    directory: string;
    mimeTypeMapping: Record<string, string>;
    build: boolean;
    port: number;
};