import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, Project, Shell } from '@kartoffelgames/environment.core';
import { KgCliCommand as BuildCommand } from '@kartoffelgames/environment.command-build';

export class KgCliCommand implements IKgCliCommand<KgBuildConfiguration> {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription<KgBuildConfiguration> {
        return {
            command: {
                pattern: 'test <package_name> --coverage --no-timeout',
                description: 'Test package',
            },
            configuration: {
                name: 'tests',
                default: ['unit'],
            }
        };
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param _pPackages - All cli packages grouped by type.
     * @param pProjectHandler - Project handling.
     */
    public async run(pParameter: CliParameter, _pPackages: Array<string>, pProjectHandler: Project): Promise<void> {
        const lConsole = new Console();

        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');

        // Construct paths.
        const lPackage = pProjectHandler.getPackageConfiguration(lPackageName);
        const lPackagePath = lPackage.directory;

        // Construct webpack command.
        let lBuildType: string = 'test';
        if (pParameter.parameter.has('coverage')) {
            lBuildType = 'test-coverage';
        }

        // Build test webpack information.
        lConsole.writeLine('Build Test');

        // Build build cli parameter.
        const lBuildParameter: CliParameter = new CliParameter();
        lBuildParameter.parameter.set('package_name', lPackage.packageName);
        lBuildParameter.parameter.set('pack', null);
        lBuildParameter.parameter.set('target', 'node');
        lBuildParameter.parameter.set('type', lBuildType);

        // Run build command.
        const lBuildCommand: BuildCommand = new BuildCommand();
        await lBuildCommand.run(lBuildParameter, _pPackages, pProjectHandler);

        // Run test information.
        lConsole.writeLine('Run Test');

        // Load mocha and nyc from local node-modules.
        const lMochaCli: string = require.resolve('mocha/bin/mocha');
        const lNycCli: string = require.resolve('nyc/bin/nyc.js');

        // Load mocha and nyc configuration
        // Load essentials.
        const lMochaConfigPath = require.resolve('@kartoffelgames/environment.workspace-essentials/environment/configuration/mocha.config.js');
        const lNycConfigPath = require.resolve('@kartoffelgames/environment.workspace-essentials/environment/configuration/nyc.config.json');

        // Create package shell command executor.
        const lPackageShell: Shell = new Shell(lPackagePath);

        // Construct mocha command.
        let lMochaCommand: string = '';
        if (pParameter.parameter.has('coverage')) {
            lMochaCommand = `node ${lNycCli} --nycrc-path "${lNycConfigPath}" mocha --config "${lMochaConfigPath}"`;
        } else {
            lMochaCommand = `node ${lMochaCli} --config "${lMochaConfigPath}" `;
        }

        // Append no timout setting to mocha command.
        if (pParameter.parameter.has('no-timeout')) {
            lMochaCommand += ' --no-timeouts';
        }

        // Run test
        await lPackageShell.console(lMochaCommand);
    }
}

type KgBuildConfiguration = Array<'unit'>;