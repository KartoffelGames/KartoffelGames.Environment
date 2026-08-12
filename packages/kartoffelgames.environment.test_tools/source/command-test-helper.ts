/**
 * Test helper that runs the KartoffelGames environment CLI against an isolated, throwaway
 * project fixture.
 *
 * Each helper instance owns a temporary project directory (outside of any repository, so the
 * CLI's upward `kg.root` search can never escape into a real project) that is pre-populated with
 * a valid root `deno.json`. Commands are executed exactly like a user would run them
 * (`kg <command> [parameters]`), currently by spawning the real CLI as a subprocess. The
 * subprocess mechanism is an implementation detail hidden behind {@link CommandTestHelper.run} and
 * can be swapped for in-process dispatch later without changing any test.
 *
 * @example
 * ```typescript
 * const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
 * try {
 *     const lResult: CommandTestHelperResult = await lHelper.run('kg bump', { '--type': 'patch' });
 *     expect(lResult.success).toBeTruthy();
 *     expect(lHelper.projectConfiguration().version).toBe('1.2.4');
 * } finally {
 *     await lHelper.dispose();
 * }
 * ```
 */
export class CommandTestHelper {
    private static readonly CLI_ENTRY_FILE: string = `${import.meta.dirname}/../../kartoffelgames.environment.cli/source/cli.ts`;
    private static readonly REPOSITORY_CONFIG_FILE: string = `${import.meta.dirname}/../../../deno.json`;

    /**
     * Create a new helper with a fresh project fixture.
     *
     * Creates a temporary directory containing a valid root `deno.json` whose `kg.cli` list is
     * copied from this repository, so every real environment command resolves inside the fixture.
     *
     * @param pProjectVersion - Initial version written into the fixture's root `deno.json`.
     *
     * @returns A ready-to-use helper instance. Always {@link CommandTestHelper.dispose} it when done.
     */
    public static async create(pProjectVersion: string = '0.0.0'): Promise<CommandTestHelper> {
        // Create an isolated fixture directory outside of any repository.
        const lRootDirectory: string = await Deno.makeTempDir();

        // Reuse the repository's command list so every environment command is available in the fixture.
        const lRepositoryConfiguration: Record<string, any> = JSON.parse(await Deno.readTextFile(CommandTestHelper.REPOSITORY_CONFIG_FILE));
        const lCliList: Array<string> = lRepositoryConfiguration['kg']?.['cli'] ?? new Array<string>();

        // Write the fixture root project configuration.
        const lProjectConfiguration: Record<string, any> = {
            version: pProjectVersion,
            workspace: [],
            kg: {
                root: true,
                packages: './packages',
                cli: lCliList
            }
        };
        await Deno.writeTextFile(`${lRootDirectory}/deno.json`, JSON.stringify(lProjectConfiguration, null, 4));

        // Create the packages directory so package-scoped commands have a place to look.
        await Deno.mkdir(`${lRootDirectory}/packages`, { recursive: true });

        return new CommandTestHelper(lRootDirectory);
    }

    private mDisposed: boolean;
    private readonly mRootDirectory: string;

    /**
     * Absolute path of the fixture's root project directory.
     */
    public get directory(): string {
        return this.mRootDirectory;
    }

    /**
     * Constructor.
     *
     * @param pRootDirectory - Absolute path of the fixture's root project directory.
     */
    private constructor(pRootDirectory: string) {
        this.mRootDirectory = pRootDirectory;
        this.mDisposed = false;
    }

    /**
     * Scaffold a package inside the fixture's packages directory.
     *
     * @param pName - JSR package name, e.g. `@scope/my-package`.
     * @param pVersion - Initial package version.
     */
    public async addPackage(pName: string, pVersion: string = '0.0.0'): Promise<void> {
        const lPackageDirectory: string = `${this.mRootDirectory}/packages/${this.packageDirectoryName(pName)}`;

        // Create the package source directory with a trivial entry file.
        await Deno.mkdir(`${lPackageDirectory}/source`, { recursive: true });
        await Deno.writeTextFile(`${lPackageDirectory}/source/index.ts`, 'export {};\n');

        // Write the package configuration. The kg id is derived from the name by the CLI at runtime.
        const lPackageConfiguration: Record<string, any> = {
            name: pName,
            version: pVersion,
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {}
            }
        };
        await Deno.writeTextFile(`${lPackageDirectory}/deno.json`, JSON.stringify(lPackageConfiguration, null, 4));
    }

    /**
     * Remove the fixture directory. Safe to call more than once.
     */
    public async dispose(): Promise<void> {
        // Skip when already disposed.
        if (this.mDisposed) {
            return;
        }
        this.mDisposed = true;

        // Remove the fixture directory and everything in it.
        await Deno.remove(this.mRootDirectory, { recursive: true });
    }

    /**
     * Check whether a file exists inside the fixture.
     *
     * @param pRelativePath - Path relative to the fixture root.
     *
     * @returns `true` when the file or directory exists.
     */
    public fileExists(pRelativePath: string): boolean {
        try {
            Deno.statSync(`${this.mRootDirectory}/${pRelativePath}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Read and parse the `deno.json` of a package previously added to the fixture.
     *
     * @param pName - JSR package name used when the package was added.
     *
     * @returns Parsed package configuration.
     */
    public packageConfiguration(pName: string): CommandTestHelperPackageConfiguration {
        return JSON.parse(this.readFile(`packages/${this.packageDirectoryName(pName)}/deno.json`));
    }

    /**
     * Read and parse the fixture's root `deno.json`.
     *
     * @returns Parsed root project configuration.
     */
    public projectConfiguration(): CommandTestHelperProjectConfiguration {
        return JSON.parse(this.readFile('deno.json'));
    }

    /**
     * Read a text file from inside the fixture.
     *
     * @param pRelativePath - Path relative to the fixture root.
     *
     * @returns File content.
     */
    public readFile(pRelativePath: string): string {
        return Deno.readTextFileSync(`${this.mRootDirectory}/${pRelativePath}`);
    }

    /**
     * Run an environment CLI command against the fixture.
     *
     * The command is written the same way it is typed on the shell, e.g. `kg bump`. A leading
     * `kg` token is optional. Named parameters are provided as a map; an empty string value emits
     * a bare flag (e.g. `{ '--coverage': '' }` becomes `--coverage`), any other value is joined
     * with `=` (e.g. `{ '-p': '@scope/name' }` becomes `-p=@scope/name`).
     *
     * The call never throws for a failing command; inspect {@link CommandTestHelperResult.success}
     * and {@link CommandTestHelperResult.output} instead. CLI error messages are written to stdout.
     *
     * @param pCommand - Command line, e.g. `kg bump` or `bump`.
     * @param pParameters - Named parameters keyed by flag name.
     *
     * @returns Captured process result.
     */
    public async run(pCommand: string, pParameters: Record<string, string> = {}): Promise<CommandTestHelperResult> {
        // Split the command line into tokens and drop the optional leading "kg".
        const lTokenList: Array<string> = pCommand.trim().split(/\s+/).filter((pToken: string) => pToken !== '');
        if (lTokenList[0] === 'kg') {
            lTokenList.shift();
        }

        // Convert the parameter map into CLI arguments.
        const lParameterArgumentList: Array<string> = new Array<string>();
        for (const [lName, lValue] of Object.entries(pParameters)) {
            lParameterArgumentList.push(lValue === '' ? lName : `${lName}=${lValue}`);
        }

        // Build the deno subprocess arguments. Unstable flags are always set, regardless of the command.
        const lProcessArgumentList: Array<string> = [
            'run', '-A', '--unstable-bundle', '--unstable-raw-imports',
            '--config', CommandTestHelper.REPOSITORY_CONFIG_FILE,
            CommandTestHelper.CLI_ENTRY_FILE,
            ...lTokenList,
            ...lParameterArgumentList
        ];

        // Spawn the real CLI inside the fixture and capture its output.
        const lProcess: Deno.Command = new Deno.Command('deno', {
            args: lProcessArgumentList,
            cwd: this.mRootDirectory,
            stdin: 'null',
            stdout: 'piped',
            stderr: 'piped'
        });
        const lProcessOutput: Deno.CommandOutput = await lProcess.output();

        // Decode the captured output streams.
        const lTextDecoder: TextDecoder = new TextDecoder();
        return {
            success: lProcessOutput.success,
            exitCode: lProcessOutput.code,
            output: lTextDecoder.decode(lProcessOutput.stdout),
            errorOutput: lTextDecoder.decode(lProcessOutput.stderr)
        };
    }

    /**
     * Write a text file inside the fixture, creating parent directories as needed.
     *
     * @param pRelativePath - Path relative to the fixture root.
     * @param pContent - File content.
     */
    public writeFile(pRelativePath: string, pContent: string): void {
        const lAbsolutePath: string = `${this.mRootDirectory}/${pRelativePath}`;

        // Create the parent directory of the target file.
        const lLastSeperatorIndex: number = Math.max(lAbsolutePath.lastIndexOf('/'), lAbsolutePath.lastIndexOf('\\'));
        Deno.mkdirSync(lAbsolutePath.substring(0, lLastSeperatorIndex), { recursive: true });

        // Write the file content.
        Deno.writeTextFileSync(lAbsolutePath, pContent);
    }

    /**
     * Convert a JSR package name into a filesystem-safe directory name for the fixture.
     *
     * @param pName - JSR package name.
     *
     * @returns Sanitized directory name.
     */
    private packageDirectoryName(pName: string): string {
        return pName.replace(/[^a-z0-9]+/gi, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
    }
}

/**
 * Parsed root project `deno.json` of a fixture.
 */
export type CommandTestHelperProjectConfiguration = {
    kg: {
        cli: Array<string>;
        packages: string;
        root: boolean;
    };
    version: string;
    workspace: Array<string>;
};

/**
 * Parsed package `deno.json` of a fixture package.
 */
export type CommandTestHelperPackageConfiguration = {
    kg: {
        config: Record<string, any>;
        name: string;
        source: string;
    };
    name: string;
    version: string;
};

/**
 * Result of a single {@link CommandTestHelper.run} invocation.
 */
export type CommandTestHelperResult = {
    /**
     * Captured standard error stream.
     */
    errorOutput: string;

    /**
     * Process exit code.
     */
    exitCode: number;

    /**
     * Captured standard output stream. CLI status and error messages are written here.
     */
    output: string;

    /**
     * `true` when the command exited with code 0.
     */
    success: boolean;
};
