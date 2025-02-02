import { CliCommandDescription, CliParameter, Console, FileSystem, ICliCommand, PackageInformation, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliCommand<TestConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<TestConfiguration> {
        return {
            command: {
                description: 'Test package',
                name: 'test',
                parameters: ['<package_name>'],
                flags: ['coverage', 'no-timeout'],
            },
            configuration: {
                name: 'tests',
                default: {
                    bundleRequired: false
                },
            }
        };
    }

    /**
     * Execute command.
     * 
     * @param pParameter - Command parameter.
     * @param pProjectHandler - Project.
     */
    public async run(pParameter: CliParameter, pProjectHandler: Project): Promise<void> {
        // Cli parameter.
        const lPackageName: string = <string>pParameter.parameter.get('package_name');

        // Read package information and bundle config. 
        // Configuration is filled up with default information.
        const lPackageInformation: PackageInformation = pProjectHandler.getPackageInformation(lPackageName);

        // Read cli configuration from cli package.
        const lPackageConfiguration = await pProjectHandler.readCliPackageConfiguration(lPackageInformation, this);





        const lConsole = new Console();

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

type TestConfiguration = {
    bundleRequired: boolean;
};