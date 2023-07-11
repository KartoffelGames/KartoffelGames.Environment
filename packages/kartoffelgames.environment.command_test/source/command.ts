import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, Project, Shell } from '@kartoffelgames/environment.core';
import { KgCliCommand as BuildCommand } from '@kartoffelgames/environment.command-build';
import * as path from 'path';

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

        // Build test webpack information.
        lConsole.writeLine('Build Test');

        // Add extened parameter.
        const lExtendedParameter: { [key: string]: boolean | string; } = {};
        for (const [lParameterKey, lParameterValue] of pParameter.parameter) {
            lExtendedParameter[lParameterKey] = lParameterValue ?? true;
        }

        // Add build type as extended parameter.
        lExtendedParameter['buildType'] = 'test';

        // Run build command.
        const lBuildCommand: BuildCommand = new BuildCommand();
        await lBuildCommand.build(pProjectHandler, {
            packgeName: lPackage.packageName,
            pack: 'TestLib',
            target: 'node',
            scope: 'main',
            serve: false,
            buildTs: false,
            extended: lExtendedParameter
        });

        // Run test information.
        lConsole.writeLine('Run Test');

        // Load mocha and nyc from local node-modules.
        const lMochaCli: string = require.resolve('mocha/bin/mocha');
        const lNycCli: string = require.resolve('nyc/bin/nyc.js');

        // Load mocha and nyc configuration
        // Load essentials.
        const lMochaConfigPath = path.resolve(__dirname, '..', '..', 'configuration/mocha.config.js');
        const lNycConfigPath = path.resolve(__dirname, '..', '..', 'configuration/nyc.config.json');

        // Create package shell command executor.
        const lPackageShell: Shell = new Shell(lPackagePath);

        // Construct mocha command.
        let lMochaCommand: string = '';
        if (pParameter.parameter.has('coverage')) {
            lMochaCommand = `node "${lNycCli}" --nycrc-path "${lNycConfigPath}" mocha --config "${lMochaConfigPath}"`;
        } else {
            lMochaCommand = `node "${lMochaCli}" --config "${lMochaConfigPath}" `;
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