import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Console, FileUtil, Project, Shell } from '@kartoffelgames/environment.core';
import * as path from 'path';

export class KgCliCommand implements IKgCliCommand<KgBuildConfiguration> {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription<KgBuildConfiguration> {
        return {
            command: {
                pattern: 'build <package_name> --pack --target',
                description: 'Build package',
            },
            configuration: {
                name: 'build-configuration',
                default: {
                    pack: false,
                    target: 'node'
                },
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

        // Read package information and buld config. 
        // Configuration is filled up with default information.
        const lPackage = pProjectHandler.getPackageConfiguration(lPackageName);
        const lBuildConfiguration: KgBuildConfiguration = lPackage.workspace.config['build-configuration'];

        // Construct paths.
        const lPackagePath = lPackage.directory;
        const lPackageSourcePath = path.join(lPackagePath, 'source');
        const lPackageBuildPath = path.join(lPackagePath, 'library');

        // Clear output.
        lConsole.writeLine('Clear build output');
        FileUtil.emptyDirectory(lPackageBuildPath);

        // Create shell command executor.
        const lShell: Shell = new Shell(lPackagePath);

        // Load command from local node-modules.
        const lTypescriptCli: string = require.resolve('typescript/lib/tsc.js');
        const lWebpackCli: string = require.resolve('webpack-cli/bin/cli.js');

        // Run tsc.
        lConsole.writeLine('Build typescript');
        await lShell.console(`node ${lTypescriptCli} --project tsconfig.json --noemit false`);

        // Copy external files.
        lConsole.writeLine('Copy external files');
        FileUtil.copyDirectory(lPackageSourcePath, lPackageBuildPath, true, { exclude: { extensions: ['ts'] } });

        // Set configuration.
        const lPackPackage: boolean = pParameter.parameter.has('pack') || lBuildConfiguration.pack;
        const lPackageTarget: string = pParameter.parameter.get('target') ?? lBuildConfiguration.target;

        // Validate package target.
        if (lPackageTarget !== 'node' && lPackageTarget !== 'web') {
            throw `Invalid package target "${lPackPackage}". Valid targets are ["node", "web"]`;
        }

        // Load essentials.
        const lWebpackConfigPath = require.resolve('@kartoffelgames/environment.workspace-essentials/environment/configuration/webpack.config.js');

        // Build typescript when configurated.
        if (lPackPackage) {
            lConsole.writeLine('Build Webpack');

            await lShell.console(`node ${lWebpackCli} --config "${lWebpackConfigPath}" --env=buildType=release --env=target=${lPackageTarget}`);
        }

        lConsole.writeLine('Build sucessful');
    }
}

type KgBuildConfiguration = {
    pack: boolean;
    target: 'node' | 'web';
};