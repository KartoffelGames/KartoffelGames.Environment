import { CliCommandDescription, CliParameter, ICliPackageCommand, Package, Project, FileSystem } from '@kartoffelgames/environment-core';
import { build, emptyDir } from "@deno/dnt";

export class KgCliCommand implements ICliPackageCommand<TransformConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<TransformConfiguration> {
        return {
            command: {
                description: 'Transform packages into another runtime.',
                parameters: {
                    root: 'transform',
                    optional: {
                        nodejs: {
                            shortName: 'n'
                        }
                    }
                }
            },
            configuration: {
                name: 'transform',
                default: {
                    nodeDirectory: './node'
                }
            }
        };
    }

    /**
     * Execute command.
     * 
     * @param _pParameter - Command parameter.
     * @param pCommandPackages - All cli packages grouped by type.
     */
    public async run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Needs a package to run page.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli configuration.
        const lConfiguration: TransformConfiguration = pPackage.cliConfigurationOf(this);

        // Transform to node when specified.
        if (pParameter.has('nodejs')) {
            const lNodeDirectory = FileSystem.pathToAbsolute(pPackage.directory, lConfiguration.nodeDirectory);
            await this.transformToNode(pProject, pPackage, lNodeDirectory);
        }
    }

    private async transformToNode(_pProject: Project, pPackage: Package, pNodeDirectory: string): Promise<void> {
        // Clean old node transform.
        FileSystem.emptyDirectory(pNodeDirectory);

        // Find all files in source.
        const lSourceFiles = FileSystem.findFiles(pPackage.sourcreDirectory, { include: { extensions: ['ts'] } });

        await build({
            entryPoints: lSourceFiles,
            outDir: pNodeDirectory,
            shims: {
                // see JS docs for overview and more options
                deno: true,
            },
            package: {
                // package.json properties
                name: "your-package",
                version: Deno.args[0],
                description: "Your package.",
                license: "MIT",
                repository: {
                    type: "git",
                    url: "git+https://github.com/username/repo.git",
                },
                bugs: {
                    url: "https://github.com/username/repo/issues",
                },
            },
            postBuild() {
                // steps to run after building and before running the tests
                Deno.copyFileSync("LICENSE", "npm/LICENSE");
                Deno.copyFileSync("README.md", "npm/README.md");
            },
        });

    }
}

type TransformConfiguration = {
    nodeDirectory: string;
};