import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';
import { PageBundler } from "./file_handler/page-bundler.ts";
import { PageFileWatcher } from "./file_handler/page-file-watcher.ts";
import { PageHttpServer } from "./file_handler/page-http-server.ts";

export class KgCliCommand implements ICliPackageCommand<PageConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<PageConfiguration> {
        return {
            command: {
                description: 'Build and eventually serve html page files over local http server.',
                name: 'page',
                parameters: ['<package_name>'],
                flags: ['force', 'build-only'],
            },
            configuration: {
                name: 'page',
                default: {
                    enabled: false,
                    mainBundleRequired: false,
                    port: 8088
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
        const lPackageName: string = pParameter.parameter.get('package_name') as string;
        const lForceBuild: boolean = pParameter.parameter.has('force');

        // Read package information and bundle config. 
        // Configuration is filled up with default information.
        const lPackageInformation: PackageInformation = pProjectHandler.getPackage(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);

        // Create console.
        const lConsole = new Console();

        // Exit when no build is configurated.
        if (!lForceBuild && !lPackageConfiguration.enabled) {
            lConsole.writeLine('Disabled page build. Skip page...');
            return;
        }

        // Create watch paths for package source and page directory.
        const lWatchPaths: Array<string> = [
            FileSystem.pathToAbsolute(lPackageInformation.directory, 'source'),
            FileSystem.pathToAbsolute(lPackageInformation.directory, 'page')
        ];

        // Init page files.
        this.initPageFiles(lPackageInformation);

        // Source directory of www files.
        const lSourceDirectory: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'page');

        // Build page http-server, watcher and bundler.
        const lHttpServer: PageHttpServer = new PageHttpServer(lPackageConfiguration.port, lSourceDirectory);
        const lWatcher: PageFileWatcher = new PageFileWatcher(lWatchPaths);
        const lPageBundler: PageBundler = new PageBundler({
            projectHandler: pProjectHandler,
            packageInformation: lPackageInformation,
            coreBundleRequired: lPackageConfiguration.mainBundleRequired,
            websocketPort: lPackageConfiguration.port,
        });

        // Build initial build files.
        lConsole.writeLine("Starting initial bundle...");
        await lPageBundler.bundle();
        this.writePageBundeFiles(lSourceDirectory, lPageBundler.sourceFile, lPageBundler.sourceMapFile);

        // Rebundle page files and refresh connected browsers when files have changed.
        lWatcher.addListener(async () => {
            // Bundle files and update server served page files once they have changed.
            if (await lPageBundler.bundle()) {
                // Write bundle files.
                this.writePageBundeFiles(lSourceDirectory, lPageBundler.sourceFile, lPageBundler.sourceMapFile);

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
        lConsole.writeLine("Starting page server...");
        await lHttpServer.start();
    }

    /***
     * Initialize page files.
     */
    public initPageFiles(pPackageInformation: PackageInformation): void {
        const lPageDirectory: string = FileSystem.pathToAbsolute(pPackageInformation.directory, 'page');

        // Create page directorys.
        FileSystem.createDirectory(lPageDirectory);
        FileSystem.createDirectory(FileSystem.pathToAbsolute(lPageDirectory, 'source'));

        // Init html file.
        const lHtmlFile: string = FileSystem.pathToAbsolute(lPageDirectory, 'index.html');
        if (!FileSystem.exists(lHtmlFile)) {
            FileSystem.write(lHtmlFile,
                '<html>\n' +
                '<head>\n' +
                '    <title>page</title>\n' +
                '    <link rel="stylesheet" href="./index.css">\n' +
                '    <script src="/build/page.js" defer></script>\n' +
                '</head>\n' +
                '<body>\n' +
                '    <p>Hello World!!!</p>\n' +
                '</body>\n' +
                '</html>'
            );
        }

        // Init css file.
        const lCssFile: string = FileSystem.pathToAbsolute(lPageDirectory, 'index.css');
        if (!FileSystem.exists(lCssFile)) {
            FileSystem.write(lCssFile,
                'p {\n' +
                '    color: red;\n' +
                '}\n'
            );
        }

        // Init ts file in source directory.
        const lTsFile: string = FileSystem.pathToAbsolute(lPageDirectory, 'source', 'index.ts');
        if (!FileSystem.exists(lTsFile)) {
            FileSystem.write(lTsFile,
                `console.log('Hello World!!!');`
            );
        }
    }

    /**
     * Write page bundle files into file system.
     * 
     * @param pSource - Source file. 
     * @param pSourceMap - Source map file.
     */
    private writePageBundeFiles(pPageDirectory: string, pSource: Uint8Array, pSourceMap: Uint8Array): void {
        // Get absolute build directory.
        const lPageBuildDirectory: string = FileSystem.pathToAbsolute(pPageDirectory, 'build');

        // Create build directory if not exists.
        if (!FileSystem.exists(lPageBuildDirectory)) {
            FileSystem.createDirectory(lPageBuildDirectory);
        }

        // Write source file.
        const lPageJsFile: string = FileSystem.pathToAbsolute(lPageBuildDirectory, 'page.js');
        FileSystem.writeBinary(lPageJsFile, pSource);

        // Write source map file.
        const lPageJsMapFile: string = FileSystem.pathToAbsolute(lPageBuildDirectory, 'page.js.map');
        FileSystem.writeBinary(lPageJsMapFile, pSourceMap);
    }
}


type PageConfiguration = {
    enabled: boolean;
    mainBundleRequired: boolean;
    port: number;
};