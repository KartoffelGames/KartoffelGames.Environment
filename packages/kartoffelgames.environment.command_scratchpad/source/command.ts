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
                description: 'Serve scratchpad files over local http server.',
                pattern: 'scratchpad <package_name>'
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

        // Construct paths.
        const lPackage = pProjectHandler.getPackageConfiguration(lPackageName);
        const lBaseFileDirectory = path.resolve(__dirname, '..', '..', 'scratchpad-files'); // called from library/source
        const lPackageScratchpadDirectory = path.resolve(lPackage.directory, 'scratchpad');

        // Copy scratchpad blueprint. No overrides.
        lConsole.writeLine('Initialize scratchpad files...');
        FileUtil.copyDirectory(lBaseFileDirectory, lPackageScratchpadDirectory, false);

        // Run build command.
        const lBuildCommand: BuildCommand = new BuildCommand();
        await lBuildCommand.build({
            projectHandler: pProjectHandler,
            packgeName: lPackage.packageName,
            pack: 'Page',
            target: 'web',
            scope: 'main',
            buildType: 'scratchpad',
            serve: true,
            buildTs: false
        });
    }
}