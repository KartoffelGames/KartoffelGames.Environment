import { CliCommandDescription, CliParameter, ICliPackageCommand, Package, Project, FileSystem } from '@kartoffelgames/environment-core';
import { build } from "@deno/dnt";

export class KgCliCommand implements ICliPackageCommand<TransformConfiguration> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<TransformConfiguration> {
        return {
            command: {
                description: 'Transform packages into another runtime.',
                parameters: {
                    root: 'transform'
                }
            },
            configuration: {
                name: 'transform',
                default: {
                    enableNode: false,
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
    public async run(pProject: Project, pPackage: Package | null, _pParameter: CliParameter): Promise<void> {
        // Needs a package to run page.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli configuration.
        const lConfiguration: TransformConfiguration = pPackage.cliConfigurationOf(this);

        // Transform to node when specified.
        if (lConfiguration.enableNode) {
            const lNodeDirectory = FileSystem.pathToAbsolute(pPackage.directory, lConfiguration.nodeDirectory);
            await this.transformToNode(pProject, pPackage, lNodeDirectory);
        }
    }

    private async transformToNode(_pProject: Project, pPackage: Package, pNodeDirectory: string): Promise<void> {
        // TODO: Create a package.json file in project root directory and add this package as workspace.

        // Clean old node transform.
        FileSystem.emptyDirectory(pNodeDirectory);

        // Find all files used in the export deno.json property.
        const lExportedFiles: Array<string> = new Array<string>();
        if (typeof pPackage.configuration["exports"] === 'string') {
            lExportedFiles.push(FileSystem.pathToAbsolute(pPackage.directory, pPackage.configuration["exports"]));
        } else {
            for (const lExportPath of Object.values(pPackage.configuration["exports"] ?? {})) {
                // export path must be a string.
                if (typeof lExportPath !== 'string') {
                    continue;
                }

                lExportedFiles.push(FileSystem.pathToAbsolute(pPackage.directory, lExportPath));
            }
        }

        // Store any file that is not exported so it is included in the installed package.
        const lPublishedFiles: Array<string> = new Array<string>();

        // Filter all none ts files from exported file list.
        for (let i = lExportedFiles.length - 1; i > -1; i--) {
            const lExportedFilePath: string = lExportedFiles[i];
            const lExportedFileInformation = FileSystem.pathInformation(lExportedFilePath);

            console.log(lExportedFileInformation.extension)

            if(lExportedFileInformation.extension !== '.ts') {
                // Remove it from the exported files.
                lExportedFiles.splice(i, 1);

                // Add it to the published files.
                lPublishedFiles.push(lExportedFilePath);
            }
        }

        // Convert all exported files to relative paths.
        const lRelativeExportedFiles: Array<string> = lExportedFiles.map((pFilePath: string) => {
            return FileSystem.pathToRelative(Deno.cwd(), pFilePath);
        });

        // Convert all published files into relative paths with the package directory as root.
        const lRelativePublishedFiles: Array<string> = lPublishedFiles.map((pFilePath: string) => {
            return FileSystem.pathToRelative(pPackage.directory, pFilePath);
        });

        await build({
            importMap: FileSystem.pathToAbsolute(pPackage.directory, 'deno.json'),
            entryPoints: lRelativeExportedFiles,
            outDir: pNodeDirectory,
            shims: {
                // Shim anything available.
                deno: true,
                timers: true,
                prompts: true,
                blob: true,
                crypto: true,
                domException: true,
                undici: true,
                webSocket: true
            },
            package: {
                // package.json properties
                name: pPackage.configuration.name,
                version: pPackage.configuration.version,
                description: pPackage.id,
                license: "MIT",
                repository: {
                    type: "git",
                    url: "git+https://github.com/username/repo.git",
                },
                bugs: {
                    url: "https://github.com/username/repo/issues",
                }
            },
            // Skip checks that would fail.
            typeCheck: false,
            test: false,
            postBuild() {
                // steps to run after building and before running the tests
                // Deno.copyFileSync("LICENSE", "npm/LICENSE");
                // Deno.copyFileSync("README.md", "npm/README.md");
            },
        });

    }
}

type TransformConfiguration = {
    enableNode: boolean;
    nodeDirectory: string;
};