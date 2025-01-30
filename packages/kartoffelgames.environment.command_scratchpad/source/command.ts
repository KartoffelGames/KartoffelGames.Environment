import { CliCommandDescription, CliParameter, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';
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
                    buildRequired: false,
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

        // Source directory of www files.
        const lSourceDirectory: string = FileSystem.pathToAbsolute(lPackageInformation.directory, 'scratchpad');

        // Start http server.
        const lHttpServer: ScratchpadHttpServer = new ScratchpadHttpServer(lPackageInformation, {
            watchPaths: lWatchPaths,
            port: lPackageConfiguration.port,
            rootPath: lSourceDirectory,
            buildRequired: lPackageConfiguration.buildRequired,
            project: pProjectHandler,
            moduleDeclaration: lPackageConfiguration.moduleDeclaration
        });

        // Start http server asnyc.
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
        const lTsFile: string = FileSystem.pathToAbsolute(lScratchpadDirectory, 'source', 'index.ts');
        if (!FileSystem.exists(lTsFile)) {
            FileSystem.write(lTsFile,
                `console.log('Hello World!!!');`
            );
        }
    }
}


type ScratchpadConfiguration = {
    buildRequired: boolean;
    port: number;
    moduleDeclaration: string;
};