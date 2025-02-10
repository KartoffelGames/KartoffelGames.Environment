import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, Project } from '@kartoffelgames/environment-core';
import { Package } from "../../kartoffelgames.environment.core/source/project/package.ts";
import { ScratchpadBundler } from "./file_handler/scratchpad-bundler.ts";
import { ScratchpadFileWatcher } from "./file_handler/scratchpad-file-watcher.ts";
import { ScratchpadHttpServer } from "./file_handler/scratchpad-http-server.ts";

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
                    mainBundleRequired: false,
                    port: 8088
                },
            }
        };
    }

    /**
     * Execute command.
     * 
     * @param pParameter - Command parameter.
     * @param pProjectHandler - Project.
     */
    public async run(pProjectHandler: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to run test.
        if (pPackage === null) {
            throw new Error('Package to run scratchpad not specified.');
        }

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage?.cliConfigurationOf(this);

        // Create watch paths for package source and scratchpad directory.
        const lWatchPaths: Array<string> = [
            FileSystem.pathToAbsolute(pPackage.directory, 'source'),
            FileSystem.pathToAbsolute(pPackage.directory, 'scratchpad')
        ];

        // Init scratchpad files.
        this.initScratchpadFiles(pPackage);

        // Source directory of www files.
        const lSourceDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'scratchpad');

        // Create console.
        const lConsole = new Console();

        // Build scratchpad http-server, watcher and bundler.
        const lHttpServer: ScratchpadHttpServer = new ScratchpadHttpServer(lPackageConfiguration.port, lSourceDirectory);
        const lWatcher: ScratchpadFileWatcher = new ScratchpadFileWatcher(lWatchPaths);
        const lScratchpadBundler: ScratchpadBundler = new ScratchpadBundler({
            projectHandler: pProjectHandler,
            package: pPackage,
            coreBundleRequired: lPackageConfiguration.mainBundleRequired,
            websocketPort: lPackageConfiguration.port,
        });

        // Build initial build files.
        lConsole.writeLine("Starting initial bundle...");
        await lScratchpadBundler.bundle();
        lHttpServer.setScratchpadBundle(lScratchpadBundler.sourceFile, lScratchpadBundler.sourceMapFile);

        // Rebundle scratchpad files and refresh connected browsers when files have changed.
        lWatcher.addListener(async () => {
            // Bundle files and update server served scratchpad files once they have changed.
            if (await lScratchpadBundler.bundle()) {
                lHttpServer.setScratchpadBundle(lScratchpadBundler.sourceFile, lScratchpadBundler.sourceMapFile);

                // Output bundle finished.
                lConsole.writeLine('Build finished', 'green');
            } else {
                // Signal bundle was not changed.
                lConsole.writeLine('No changes detected in bundled files.', 'yellow');
            }

            // Refresh connected browsers
            lHttpServer.refreshConnectedBrowser();
        });

        // Start watcher.
        lConsole.writeLine("Starting watcher...");
        lWatcher.start();

        // Start http server asnyc and keep process running as long as server is running.
        lConsole.writeLine("Starting scratchpad server...");
        await lHttpServer.start();
    }

    /***
     * Initialize scratchpad files.
     */
    public initScratchpadFiles(pPackage: Package): void {
        const lScratchpadDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'scratchpad');

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
    mainBundleRequired: boolean;
    port: number;
};