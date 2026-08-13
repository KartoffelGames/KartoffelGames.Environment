import { KgCliCommand as BuildCommand } from '@kartoffelgames/environment-command-build';
import { type CliCommandDescription, CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';
import { PageFileWatcher } from './file_handler/page-file-watcher.ts';
import { PageHttpServer } from './file_handler/page-http-server.ts';

export class KgCliCommand implements ICliPackageCommand<PageConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<PageConfiguration> {
        return {
            command: {
                description: 'Build and serve html page files over local http server.',
                parameters: {
                    root: 'page'
                }
            },
            configuration: {
                name: 'page',
                default: {
                    mimeTypeMapping: {},
                    port: 8088
                },
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pProject - Project.
     */
    public async run(pProject: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to run page.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage.cliConfigurationOf(this);

        // Create console.
        const lConsole = new Console();

        // Create watch paths for package source and page directory.
        const lWatchPaths: Array<string> = [
            pPackage.sourceDirectory,
            FileSystem.pathToAbsolute(pPackage.directory, 'page')
        ];

        // Init page files.
        this.initPageFiles(pPackage);

        // Source directory of www files and the generated build output directory inside it.
        const lSourceDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'page');
        const lPageBuildDirectory: string = FileSystem.pathToAbsolute(lSourceDirectory, 'build');

        // Build page http-server.
        const lHttpServer: PageHttpServer = new PageHttpServer(lPackageConfiguration.port, lSourceDirectory, lPackageConfiguration.mimeTypeMapping);

        // Build initial build files.
        lConsole.writeLine('Starting initial bundle...');
        await this.bundlePage(pProject, pPackage);

        // Flag to halt other watcher events while the current one is still processing, to prevent multiple builds at the same time.
        let lBuilding: boolean = false;

        // Rebundle page files and refresh connected browsers when files have changed.
        // The build output directory is ignored so the bundler writing its own output does not trigger another build.
        const lWatcher: PageFileWatcher = new PageFileWatcher(lWatchPaths, [lPageBuildDirectory]);
        lWatcher.addListener(async () => {
            // Skip when a build is already running, to prevent multiple builds at the same time.
            if (lBuilding) {
                return;
            }
            lBuilding = true;

            // Signal that a rebuild has started, as bundling can take a while and would otherwise look unresponsive.
            lConsole.writeLine('File change detected. Bundling...', 'yellow');

            // Rebundle the page. Bundle errors are reported but must not stop the watcher.
            try {
                await this.bundlePage(pProject, pPackage);
                lConsole.writeLine('Build finished', 'green');
            } catch (pError) {
                lConsole.writeLine((<Error>pError).message, 'red');
            }

            lBuilding = false;

            // Refresh connected browsers
            lHttpServer.refreshConnectedBrowser();
        });

        // Start watcher.
        lConsole.writeLine('Starting watcher...');
        lWatcher.start();

        // Start http server asnyc and keep process running as long as server is running.
        lConsole.writeLine('Starting page server...');
        await lHttpServer.start();
    }

    /**
     * Bundle the page by running the build command for every "page" build type entry with the debug option set.
     * The build command writes the bundled files into the page build directory and injects the live-reload client.
     *
     * @param pProject - Project.
     * @param pPackage - Package to bundle the page for.
     */
    private async bundlePage(pProject: Project, pPackage: Package): Promise<void> {
        // Run the build command restricted to the "page" build type with the live-reload client injected.
        const lBuildParameter: CliParameter = new CliParameter('build');
        lBuildParameter.set('type', 'page');
        lBuildParameter.set('injectreload', null);

        await new BuildCommand().run(pProject, pPackage, lBuildParameter);
    }

    /**
     * Initializes the initial page files for the given package.
     *
     * This method creates the necessary directory structure and initializes
     * the HTML, CSS, and TypeScript files if they do not already exist.
     *
     * @param pPackage - The package for which the page files are to be initialized.
     *
     * @remarks
     * - Creates a 'page' directory inside the package directory.
     * - Creates a 'source' directory inside the 'page' directory.
     * - Initializes an 'index.html' file with basic HTML content.
     * - Initializes an 'index.css' file with basic CSS content.
     * - Initializes an 'index.ts' file inside the 'source' directory with basic TypeScript content.
     */
    private initPageFiles(pPackage: Package): void {
        const lPageDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'page');

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
}


type PageConfiguration = {
    mimeTypeMapping: Record<string, string>;
    port: number;
};
