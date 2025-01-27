import { EnvironmentBundle, EnvironmentBundleOutput, EnvironmentSettingFiles } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';

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
                    buildRequired: false,
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
        const lConsole = new Console();

        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');

        // Read package information and build config. 
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

        const lSourceDirectory: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'scratchpad');
        this.startWebserver(lPackageConfiguration.port, lSourceDirectory);

        // Start watcher.
        await this.startWatcher(lWatchPaths, () => {
            // TODO: Currently nothing.
        });


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
        const lTsFile: string = FileSystem.pathToAbsolute(lScratchpadDirectory, 'source', 'scratchpad.ts');
        if (!FileSystem.exists(lTsFile)) {
            FileSystem.write(lTsFile,
                `console.log('Hello World!!!');`
            );
        }
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
        for await (const lWatchEvent of lWatcher) {
            // Reset debounce timer.
            clearTimeout(lDebounceTimer);

            console.log(lWatchEvent);

            // Set new debounce timer.
            lDebounceTimer = setTimeout(() => {
                pWatchCallback();
            }, 100);
        }
    }

    public startWebserver(pPort: number, pRootPath: string): void {
        // Start webserver on defined port.
        Deno.serve({ port: pPort, hostname: '127.0.0.1' }, async (pReqest): Promise<Response> => {
            const lFilePathName: string = new URL(pReqest.url).pathname;
            const lFilePath: string = FileSystem.pathToAbsolute(pRootPath, '.' + lFilePathName);

            // Send file when it is in fact a file path.
            if (FileSystem.exists(lFilePath)) {
                let lExistigFilePath: string = lFilePath;

                // Read path information to check if it is a directory.
                const lFileInformation = FileSystem.pathInformation(lFilePath);
                if (lFileInformation.extension === '') {
                    lExistigFilePath = FileSystem.pathToAbsolute(lFilePath, 'index.html');
                }

                // Check if file exists again, just in case the file path was extended.
                if (FileSystem.exists(lExistigFilePath)) {
                    const file = await Deno.open(lExistigFilePath, { read: true });
                    return new Response(file.readable);
                }
            }

            // Send cached buidl scratchpad.js for a special path.
            if (lFilePathName.toLowerCase() === '/scratchpad.js') {
                // TODO:
                return new Response('console.log("Hello World!!!")');
            }

            // Special case for build directory.
            if (lFilePathName.toLowerCase().startsWith('/build/')) {
                const lBuildFilePath: string = FileSystem.pathToAbsolute(pRootPath, '..', 'library', lFilePathName.substring(7));
                console.log(lBuildFilePath);

                if (FileSystem.exists(lBuildFilePath)) {
                    const file = await Deno.open(lBuildFilePath, { read: true });
                    return new Response(file.readable);
                }
            }

            return new Response("404 Not Found", { status: 404 });
        });
    }
}

type ScratchpadRunConfiguration = {
    watchPaths: Array<string>;

};

type ScratchpadConfiguration = {
    buildRequired: boolean;
    port: number;
};