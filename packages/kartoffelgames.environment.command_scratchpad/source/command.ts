import { EnvironmentBundle, EnvironmentBundleOutput, EnvironmentSettingFiles } from '@kartoffelgames/environment-bundle';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';
import { HttpServer } from "./http-server.ts";

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

        // Start http server.
        const lHttpServer: HttpServer = new HttpServer(lWatchPaths, lPackageConfiguration.port, lSourceDirectory);
        lConsole.writeLine("Starting scratchpad server...");
        lHttpServer.start();

        // Keep process alive.
        await new Promise(() => { });
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

    


}

type ScratchpadRunConfiguration = {
    watchPaths: Array<string>;

};

type ScratchpadConfiguration = {
    buildRequired: boolean;
    port: number;
};