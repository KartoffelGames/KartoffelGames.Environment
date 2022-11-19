import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project } from '@kartoffelgames/environment.core';
import { KgCliCommand as BuildCommand } from '@kartoffelgames/environment.command-build';
import * as path from 'path';


export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            command: {
                description: 'Start page with local http server.',
                pattern: 'page <package_name> --build-only --force'
            },
            configuration: {
                name: 'page',
                default: false
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(pParameter: CliParameter, _pCliPackages: Array<string>, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');
        const lForceBuild: boolean = pParameter.parameter.has('force');

        // Read package information and page config. 
        // Configuration is filled up with default information.
        const lPackage = pProjectHandler.getPackageConfiguration(lPackageName);
        const lBuildPage: boolean = lPackage.workspace.config['page'];

        // Exit when no build is configurated.
        if(!lForceBuild && !lBuildPage) {
            lConsole.writeLine('Disabled page build. Skip page...');
            return;
        }

        // Construct paths.
        const lBaseFileDirectory = path.resolve(__dirname, '..', '..', 'page-files'); // called from library/source
        const lPackageScratchpadDirectory = path.resolve(lPackage.directory, 'page');

        // Copy page blueprint. No overrides.
        lConsole.writeLine('Initialize page files...');
        FileUtil.copyDirectory(lBaseFileDirectory, lPackageScratchpadDirectory, false);

        // Run build command.
        const lBuildCommand: BuildCommand = new BuildCommand();
        await lBuildCommand.build({
            projectHandler: pProjectHandler,
            packgeName: lPackage.packageName,
            pack: true,
            target: 'web',
            scope: 'main',
            buildType: 'page',
            serve: !pParameter.parameter.has('build-only')
        });
    }
}