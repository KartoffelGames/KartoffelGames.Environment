import { Console } from '../helper/console.js';
import { FileUtil } from '../helper/file-util.js';
import { Shell } from '../helper/shell.js';
import { Workspace, WorkspaceConfiguration } from '../helper/workspace.js';


export class BuildCommand {
    private readonly mWorkspaceHelper: Workspace;

    /**
     * Constructor.
     * @param pCliRootPath - Cli project root.
     * @param pWorkspaceRootPath - Workspace root path.
     */
    public constructor(pWorkspace: Workspace) {
        this.mWorkspaceHelper = pWorkspace;
    }

    /**
     * Build package depending on package kg.configuration.
     * @param pPackageName - Package name.
     */
    public async build(pPackageName: string): Promise<void> {
        const lConsole = new Console();

        // Construct paths.
        const lPackagePaths = this.mWorkspaceHelper.pathsOf(pPackageName);

        // Read package configuration.
        const lConfiguration: WorkspaceConfiguration = this.mWorkspaceHelper.getProjectConfiguration(pPackageName);

        // Clear output.
        await this.clear(pPackageName);

        // Create shell command executor.
        const lShell: Shell = new Shell(lPackagePaths.project.root);

        // Load command from local node-modules.
        const lTypescriptCli: string = require.resolve('typescript/lib/tsc.js');
        const lWebpackCli: string = require.resolve('webpack-cli/bin/cli.js');

        // Run tsc.
        lConsole.writeLine('Build typescript');
        await lShell.call(`node ${lTypescriptCli} --project tsconfig.json --noemit false`);

        // Copy external files.
        lConsole.writeLine('Copy external files');
        FileUtil.copyDirectory(lPackagePaths.project.source, lPackagePaths.project.library.source, true, new Map<RegExp, string>(), ['.ts']);

        // Build typescript when configurated.
        if (lConfiguration.config.pack) {
            lConsole.writeLine('Build Webpack');
            const lWebpackCommand: string = `node ${lWebpackCli} --config "${this.mWorkspaceHelper.paths.cli.files.webpackConfig}" --env=buildType=release`;
            await lShell.call(lWebpackCommand);
        }

        lConsole.writeLine('Build sucessful');
    }

    /**
     * Clear package library.
     * @param pPackageName - Package name.
     */
    public async clear(pPackageName: string): Promise<void> {
        const lConsole = new Console();

        // Output heading.
        lConsole.writeLine('Clear build output');

        // Construct paths.
        const lPackagePaths = this.mWorkspaceHelper.pathsOf(pPackageName);

        // Force delete directory.
        FileUtil.deleteDirectory(lPackagePaths.project.library.root);
    }

    /**
     * Start webpack devserver from scratchpad files.
     * @param pPackageName - Package name.
     */
    public async scratchpad(pPackageName: string): Promise<void> {
        const lConsole = new Console();

        // Construct paths.
        const lPackagePaths = this.mWorkspaceHelper.pathsOf(pPackageName);

        // Copy scratchpad blueprint. No overrides.
        lConsole.writeLine('Initialize scratchpad files...');
        FileUtil.copyDirectory(this.mWorkspaceHelper.paths.cli.enviroment.commandBlueprints.scratchpad, lPackagePaths.project.scratchpad, false, new Map<RegExp, string>(), []);

        // Create shell command executor.
        const lShell: Shell = new Shell(lPackagePaths.project.root);

        // Load command from local node-modules.
        const lWebpackCli: string = require.resolve('webpack-cli/bin/cli.js');

        // Build test webpack
        lConsole.writeLine('Starting Webserver...');
        await lShell.call(`node ${lWebpackCli} serve --config "${this.mWorkspaceHelper.paths.cli.files.webpackConfig}" --env=buildType=scratchpad`);
    }

    /**
     * Run mocha test.
     * Valid test options are "coverage" and "no-timeout".
     * @param pPackageName - Package name.
     * @param pOptions - Test options. 
     */
    public async test(pPackageName: string, pOptions: TestOptions): Promise<void> {
        const lConsole = new Console();

        // Construct paths.
        const lPackagePaths = this.mWorkspaceHelper.pathsOf(pPackageName);

        // Create shell command executor.
        const lShell: Shell = new Shell(lPackagePaths.project.root);

        // Load command from local node-modules.
        const lWebpackCli: string = require.resolve('webpack-cli/bin/cli.js');

        // Construct webpack command.
        let lWebpackCommand: string = `node ${lWebpackCli} --config "${this.mWorkspaceHelper.paths.cli.files.webpackConfig}"`;
        if (pOptions.coverage) {
            lWebpackCommand += ' --env=buildType=test-coverage';
        } else {
            lWebpackCommand += ' --env=buildType=test';
        }

        // Build test webpack
        lConsole.writeLine('Build Webpack');
        await lShell.call(lWebpackCommand);

        // Load mocha and nyc from local node-modules.
        const lMochaCli: string = require.resolve('mocha/bin/mocha');
        const lNycCli: string = require.resolve('nyc/bin/nyc.js');

        // Construct mocha command.
        let lMochaCommand: string = '';
        if (pOptions.coverage) {
            lMochaCommand = `node ${lNycCli} --nycrc-path "${this.mWorkspaceHelper.paths.cli.files.nycConfig}" mocha --config "${this.mWorkspaceHelper.paths.cli.files.mochaConfig}"`;
        } else {
            lMochaCommand = `node ${lMochaCli} --config "${this.mWorkspaceHelper.paths.cli.files.mochaConfig}" `;
        }

        // Append no timout setting to mocha command.
        if (pOptions.noTimeout) {
            lWebpackCommand += ' --no-timeouts';
        }

        // Run test
        lConsole.writeLine('Run Test');
        await lShell.call(lMochaCommand);
    }
}

type TestOptions = {
    coverage: boolean;
    noTimeout: boolean;
};