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
                description: 'Build and serve the page directory over a local http server.',
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
        // Needs a package to run the page server.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage.cliConfigurationOf(this);

        // Create console.
        const lConsole = new Console();

        // Page directory of www files and the generated bundle output directory inside it.
        const lPageDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'page');
        const lPageBundleDirectory: string = FileSystem.pathToAbsolute(lPageDirectory, 'bundle');

        // Ensure the page directory exists so the file watcher and http server have a valid root. The page content
        // itself is owned by the package and is not scaffolded by this command.
        FileSystem.createDirectory(lPageDirectory);

        // Create watch paths for package source and page directory.
        const lWatchPaths: Array<string> = [
            pPackage.sourceDirectory,
            lPageDirectory
        ];

        // Build page http-server.
        const lHttpServer: PageHttpServer = new PageHttpServer(lPackageConfiguration.port, lPageDirectory, lPackageConfiguration.mimeTypeMapping);

        // Build initial bundle files.
        lConsole.writeLine('Starting initial bundle...');
        await this.bundlePage(pProject, pPackage);

        // Flag to halt other watcher events while the current one is still processing, to prevent multiple builds at the same time.
        let lBuilding: boolean = false;

        // Rebundle page files and refresh connected browsers when files have changed.
        // The bundle output directory is ignored so the bundler writing its own output does not trigger another build.
        const lWatcher: PageFileWatcher = new PageFileWatcher(lWatchPaths, [lPageBundleDirectory]);
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
     * Bundle the page by running the build command in bundle-only mode with the live-reload client injected.
     * The build command writes the bundled files into their configured output paths. Only "page" type entries
     * receive the live-reload client. The desktop packaging step is skipped (bundle-only) to keep the watch fast.
     *
     * @param pProject - Project.
     * @param pPackage - Package to bundle the page for.
     */
    private async bundlePage(pProject: Project, pPackage: Package): Promise<void> {
        // Run the build command in bundle-only mode with the live-reload client injected.
        const lBuildParameter: CliParameter = new CliParameter('build');
        lBuildParameter.set('bundle-only', null);
        lBuildParameter.set('injectreload', null);

        await new BuildCommand().run(pProject, pPackage, lBuildParameter);
    }
}


type PageConfiguration = {
    mimeTypeMapping: Record<string, string>;
    port: number;
};
