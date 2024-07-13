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
                pattern: 'build <package_name> --pack --target --type --scope',
                description: 'Build package',
            },
            configuration: {
                name: 'build-configuration',
                default: {
                    pack: false,
                    target: 'node',
                    scope: 'main'
                },
            }
        };
    }

    /**
     * Build project.
     * @param pOptions - Build options.
     */
    public async build(pProjectHandler: Project, pOptions: BuildOptions): Promise<void> {
        const lConsole = new Console();

        // Read package information and buld config. 
        // Configuration is filled up with default information.
        const lPackage = pProjectHandler.getPackageConfiguration(pOptions.packgeName);

        // Construct paths.
        const lPackagePath = lPackage.directory;
        const lPackageSourcePath = path.join(lPackagePath, 'source');
        const lPackageBuildPath = path.join(lPackagePath, 'library');

        // Create shell command executor.
        const lShell: Shell = new Shell(lPackagePath);

        // Load command from local node-modules.
        const lTypescriptCli: string = require.resolve('typescript/lib/tsc.js');
        const lWebpackCli: string = require.resolve('webpack-cli/bin/cli.js');

        // Build ts only when needed.
        if (pOptions.buildTs) {
            // Join external file target path.
            const lExternalFileTargetPath: string = path.join(lPackageBuildPath, 'source');

            // Clear output.
            lConsole.writeLine('Clear build output');
            FileUtil.deleteDirectory(path.join(lPackageBuildPath, 'source'));
            FileUtil.deleteDirectory(path.join(lPackageBuildPath, 'test'));
            // Delete build info
            FileUtil.deleteDirectory(path.join(lPackageBuildPath, 'tsconfig.tsbuildinfo'));

            // Run tsc.
            lConsole.writeLine('Build typescript');
            await lShell.console(`node "${lTypescriptCli}" --project tsconfig.json --noemit false`);

            // Copy external files.
            lConsole.writeLine('Copy external files');
            FileUtil.copyDirectory(lPackageSourcePath, lExternalFileTargetPath, true, { exclude: { extensions: ['ts'] } });
        }

        // Validate package target.
        if (pOptions.target !== 'node' && pOptions.target !== 'web') {
            throw `Invalid package target "${pOptions.target}". Valid targets are ["node", "web"]`;
        }

        // Validate package scope.
        if (pOptions.scope !== 'main' && pOptions.scope !== 'worker') {
            throw `Invalid package scope "${pOptions.scope}". Valid targets are ["main", "worker"]`;
        }

        // Load essentials.
        const lWebpackConfigPath = path.resolve(__dirname, '..', '..', 'configuration/webpack.config.js');

        // Start webpack server.
        let lServeParameter: string = '';
        if (pOptions.serve) {
            lServeParameter = 'serve';
        }

        // Build typescript when configurated.
        if (pOptions.pack) {
            lConsole.writeLine(`Build Webpack with Library name: "${pOptions.pack}"`);

            // Create build command. WITHOUT newlines.
            let lBuildCommand = `node "${lWebpackCli}" ${lServeParameter} --config "${lWebpackConfigPath}"`;
            lBuildCommand += ' ' + `--env=target=${pOptions.target}`;
            lBuildCommand += ' ' + `--env=scope=${pOptions.scope}`;
            lBuildCommand += ' ' + `--env=libraryName=${pOptions.pack}`;

            // Add additional parameter.
            for (const [lPropertyKey, lPropertyValue] of Object.entries(pOptions.extended)) {
                // Exclude parameter that are already inside of build options.
                if (!(lPropertyKey in pOptions)) {
                    lBuildCommand += ' ' + `--env=${lPropertyKey}="${lPropertyValue}"`;
                }
            }

            await lShell.console(lBuildCommand);
        }

        lConsole.writeLine('Build successful');
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param _pPackages - All cli packages grouped by type.
     * @param pProjectHandler - Project handling.
     */
    public async run(pParameter: CliParameter, _pPackages: Array<string>, pProjectHandler: Project): Promise<void> {
        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');

        // Read package information and build config. 
        // Configuration is filled up with default information.
        const lPackage = pProjectHandler.getPackageConfiguration(lPackageName);
        const lBuildConfiguration: KgBuildConfiguration = lPackage.workspace.config['build-configuration'];

        // Set configuration.
        const lPackLibraryName: string | false = (pParameter.parameter.get('pack') ?? lBuildConfiguration.pack) ?? false;
        const lPackageTarget: KgBuildConfiguration['target'] = <any>pParameter.parameter.get('target') ?? lBuildConfiguration.target ?? 'node';
        const lPackageScope: KgBuildConfiguration['scope'] = <any>pParameter.parameter.get('scope') ?? lBuildConfiguration.scope ?? 'main';

        // Add extened parameter.
        const lExtendedParameter: { [key: string]: boolean | string; } = {};
        for (const [lParameterKey, lParameterValue] of pParameter.parameter) {
            lExtendedParameter[lParameterKey] = lParameterValue ?? true;
        }

        // Add build type as extended parameter.
        lExtendedParameter['buildType'] = 'release';

        await this.build(pProjectHandler, {
            packgeName: lPackageName,
            pack: lPackLibraryName,
            target: lPackageTarget,
            serve: false,
            scope: lPackageScope,
            buildTs: true,
            extended: lExtendedParameter
        });
    }
}

type KgBuildConfiguration = {
    pack: string | false;
    libraryName?: string;
    target: 'node' | 'web';
    scope: 'main' | 'worker';
};

export type BuildOptions = {
    packgeName: string;
    pack: string | false;
    target: KgBuildConfiguration['target'];
    serve: boolean;
    scope: KgBuildConfiguration['scope'];
    buildTs: boolean;
    extended: { [key: string]: boolean | string; };
};