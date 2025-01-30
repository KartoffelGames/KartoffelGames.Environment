import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';
import { ScratchpadBundler } from "./file_handler/scratchpad-bundler.ts";
import { ScratchpadFileWatcher } from "./file_handler/scratchpad-file-watcher.ts";
import { ScratchpadHttpServer } from "./file_handler/scratchpad-http-server.ts";

export class KgCliCommand implements ICliCommand<ScratchpadConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<ScratchpadConfiguration> {
        return {
            command: {
                description: 'Serve scratchpad files over local http server.',
                name: 'scratchpad',
                parameters: ['<package_name>'],
                flags: [],
            },
            configuration: {
                name: 'scratchpad',
                default: {
                    mainBundleRequired: false,
                    port: 8088,
                    moduleDeclaration: ''
                },
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pProjectHandler - Project.
     */
    public async run(pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');

        // Read package information and bundle config. 
        // Configuration is filled up with default information.
        const lPackageInformation: PackageInformation = pProjectHandler.getPackageInformation(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

        // Create watch paths for package source and scratchpad directory.
        const lWatchPaths: Array<string> = [
            FileSystem.pathToAbsolute(lPackageInformation.directory, 'source'),
            FileSystem.pathToAbsolute(lPackageInformation.directory, 'scratchpad')
        ];

        // Init scratchpad files.
        this.initScratchpadFiles(lPackageInformation);

        // Source directory of www files.
        const lSourceDirectory: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'scratchpad');

        // Create console.
        const lConsole = new Console();

        // Build scratchpad http-server, watcher and bundler.
        const lHttpServer: ScratchpadHttpServer = new ScratchpadHttpServer(lPackageConfiguration.port, lSourceDirectory);
        const lWatcher: ScratchpadFileWatcher = new ScratchpadFileWatcher(lWatchPaths);
        const lScratchpadBundler: ScratchpadBundler = new ScratchpadBundler(pProjectHandler, lPackageInformation, lPackageConfiguration.moduleDeclaration, lPackageConfiguration.mainBundleRequired);

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
    public initScratchpadFiles(pPackageInformation: PackageInformation): void {
        const lScratchpadDirectory: string = FileSystem.pathToAbsolute(pPackageInformation.directory, 'scratchpad');

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
    moduleDeclaration: string;
};