import { KgCliCommand as BuildCommand } from '@kartoffelgames/environment-command-build';
import { type CliCommandDescription, CliParameter, Console, FileSystem, type ICliPackageCommand, type Package, type Project } from '@kartoffelgames/environment-core';
import { AppFileWatcher } from './file_handler/app-file-watcher.ts';
import { AppHttpServer } from './file_handler/app-http-server.ts';

export class KgCliCommand implements ICliPackageCommand<AppConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<AppConfiguration> {
        return {
            command: {
                description: 'Build and serve the app directory over a local http server.',
                parameters: {
                    root: 'app'
                }
            },
            configuration: {
                name: 'app',
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
        // Needs a package to run the app server.
        if (pPackage === null) {
            throw new Error('Package to run app not specified.');
        }

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pPackage.cliConfigurationOf(this);

        // Create console.
        const lConsole = new Console();

        // App directory of www files and the generated bundle output directory inside it.
        const lAppDirectory: string = FileSystem.pathToAbsolute(pPackage.directory, 'app');
        const lAppBundleDirectory: string = FileSystem.pathToAbsolute(lAppDirectory, 'bundle');

        // Ensure the app directory exists so the file watcher and http server have a valid root. The app content
        // itself is owned by the package and is not scaffolded by this command.
        FileSystem.createDirectory(lAppDirectory);

        // Create watch paths for package source and app directory.
        const lWatchPaths: Array<string> = [
            pPackage.sourceDirectory,
            lAppDirectory
        ];

        // Build app http-server.
        const lHttpServer: AppHttpServer = new AppHttpServer(lPackageConfiguration.port, lAppDirectory, lPackageConfiguration.mimeTypeMapping);

        // Build initial bundle files.
        lConsole.writeLine('Starting initial bundle...');
        await this.bundleApp(pProject, pPackage);

        // Flag to halt other watcher events while the current one is still processing, to prevent multiple builds at the same time.
        let lBuilding: boolean = false;

        // Rebundle app files and refresh connected browsers when files have changed.
        // The bundle output directory is ignored so the bundler writing its own output does not trigger another build.
        const lWatcher: AppFileWatcher = new AppFileWatcher(lWatchPaths, [lAppBundleDirectory]);
        lWatcher.addListener(async () => {
            // Skip when a build is already running, to prevent multiple builds at the same time.
            if (lBuilding) {
                return;
            }
            lBuilding = true;

            // Signal that a rebuild has started, as bundling can take a while and would otherwise look unresponsive.
            lConsole.writeLine('File change detected. Bundling...', 'yellow');

            // Rebundle the app. Bundle errors are reported but must not stop the watcher.
            try {
                await this.bundleApp(pProject, pPackage);
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
        lConsole.writeLine('Starting app server...');
        await lHttpServer.start();
    }

    /**
     * Bundle the app by running the build command in bundle-only mode with the live-reload client injected.
     * The build command writes the bundled files into the app bundle directory. Only entries marked reloadable
     * receive the live-reload client. The desktop packaging step is skipped (bundle-only) to keep the watch fast.
     *
     * @param pProject - Project.
     * @param pPackage - Package to bundle the app for.
     */
    private async bundleApp(pProject: Project, pPackage: Package): Promise<void> {
        // Run the build command in bundle-only mode with the live-reload client injected.
        const lBuildParameter: CliParameter = new CliParameter('build');
        lBuildParameter.set('bundle-only', null);
        lBuildParameter.set('injectreload', null);

        await new BuildCommand().run(pProject, pPackage, lBuildParameter);
    }
}


type AppConfiguration = {
    mimeTypeMapping: Record<string, string>;
    port: number;
};
