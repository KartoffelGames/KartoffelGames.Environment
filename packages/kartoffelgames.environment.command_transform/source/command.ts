import { build } from "@deno/dnt";
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, Package, Project } from '@kartoffelgames/environment-core';

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
                        node: {
                            shortName: 'n',
                        },
                        clean: {
                            shortName: 'c',
                        }
                    }
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
    public async run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Needs a package to run page.
        if (pPackage === null) {
            throw new Error('Package to run page not specified.');
        }

        // Read cli configuration.
        const lConfiguration: TransformConfiguration = pPackage.cliConfigurationOf(this);

        // Create console.
        const lConsole: Console = new Console();

        // Transform to node when specified.
        if (pParameter.has('node')) {
            lConsole.writeLine('Transforming package to node runtime.');

            if (lConfiguration.enableNode) {
                const lNodeDirectory = FileSystem.pathToAbsolute(pPackage.directory, lConfiguration.nodeDirectory);
                await this.transformToNode(pProject, pPackage, lNodeDirectory);
            } else {
                lConsole.writeLine('Node transformation is disabled in configuration.');
            }
        }

        // Clean output directories when specified.
        if (pParameter.has('clean')) {
            lConsole.writeLine('Cleaning output directorys.');

            // Clean node directory when enabled.
            if (lConfiguration.enableNode) {
                this.cleanNodeDirectory(pProject, pPackage, lConfiguration.nodeDirectory);
            }
        }
    }

    private async transformToNode(pProject: Project, pPackage: Package, pNodeDirectory: string): Promise<void> {
        // Create a package.json file in project root directory if it does not exist.
        const lRootProjectPackageJsonFilePath: string = FileSystem.pathToAbsolute(pProject.directory, 'package.json');
        if (!FileSystem.exists(lRootProjectPackageJsonFilePath)) {
            // Create package.json file.
            FileSystem.write(lRootProjectPackageJsonFilePath, JSON.stringify({
                private: true,
                workspaces: []
            }, null, 4));
        }

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
        for (let lIndex = lExportedFiles.length - 1; lIndex > -1; lIndex--) {
            const lExportedFilePath: string = lExportedFiles[lIndex];
            const lExportedFileInformation = FileSystem.pathInformation(lExportedFilePath);

            if (lExportedFileInformation.extension !== '.ts') {
                // Remove it from the exported files.
                lExportedFiles.splice(lIndex, 1);

                // Add it to the published files.
                lPublishedFiles.push(lExportedFilePath);
            }
        }

        // Create a temporary ts file that sits at root and forces dnt to keep the original directory structure.
        const lTemporaryCoreImportPlaceholderFilePath: string = FileSystem.pathToAbsolute(pPackage.directory, 'core-import-placeholder.ts');
        lExportedFiles.push(lTemporaryCoreImportPlaceholderFilePath);

        // Convert all exported files to relative paths.
        const lRelativeExportedFiles: Array<string> = lExportedFiles.map((pFilePath: string) => {
            return FileSystem.pathToRelative(Deno.cwd(), pFilePath);
        });

        // TODO: Add all published files to lPublishedFiles list.

        // Convert all published files into relative paths with the package directory as root.
        const lRelativePublishedFiles: Array<string> = lPublishedFiles.map((pFilePath: string) => {
            return FileSystem.pathToRelative(pPackage.directory, pFilePath);
        });

        // Write temporary core-import-placeholder.ts file.
        FileSystem.write(lTemporaryCoreImportPlaceholderFilePath, `// This file is used to keep the original directory structure.\n`);

        try {
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
                    license: pPackage.configuration["license"] ?? null
                },
                // Skip checks that would fail.
                typeCheck: false,
                test: false,
                postBuild() {
                    // TODO: Copy all published files to the node esm and script directory.

                    // steps to run after building and before running the tests
                    // Deno.copyFileSync("LICENSE", "npm/LICENSE");
                    // Deno.copyFileSync("README.md", "npm/README.md");
                },
            });

            // Add package path to root project's package.json workspaces.
            const lRootRelativePackagePath = FileSystem.pathToRelative(pProject.directory, pNodeDirectory);
            const lRootProjectPackageJson = JSON.parse(FileSystem.read(lRootProjectPackageJsonFilePath));

            // Init workspace array if it does not exist.
            if (!lRootProjectPackageJson.workspaces) {
                lRootProjectPackageJson.workspaces = new Array<string>();
            }

            // Check if package path is not already in workspaces.
            if (!lRootProjectPackageJson.workspaces.includes(lRootRelativePackagePath)) {
                lRootProjectPackageJson.workspaces.push(lRootRelativePackagePath);
            }

            // Write package.json file.
            FileSystem.write(lRootProjectPackageJsonFilePath, JSON.stringify(lRootProjectPackageJson, null, 4));
        } finally {
            // Remove temporary core-import-placeholder.ts file.
            FileSystem.delete(lTemporaryCoreImportPlaceholderFilePath);
        }
    }

    /**
     * Deletes the specified node directory.
     * Removes the package from the root project's package.json workspaces.
     * Deletes the root project's package.json if no workspaces are left, otherwise updates it.
     *
     * @param pProject - The project containing the node directory.
     * @param pPackage - The package to be removed from the root project's package.json.
     * @param pRelativeNodeDirectory - The path to the node directory to be cleaned.
     */
    private cleanNodeDirectory(pProject: Project, pPackage: Package, pRelativeNodeDirectory: string): void {
        const lNodeDirectory = FileSystem.pathToAbsolute(pPackage.directory, pRelativeNodeDirectory);

        // Remove node directory.
        if (FileSystem.exists(lNodeDirectory)) {
            FileSystem.emptyDirectory(lNodeDirectory);
        }

        // Remove package from root package json.
        const lRootProjectPackageJsonFilePath: string = FileSystem.pathToAbsolute(pProject.directory, 'package.json');
        if (FileSystem.exists(lRootProjectPackageJsonFilePath)) {
            // Read package.json file.
            const lRootProjectPackageJson = JSON.parse(FileSystem.read(lRootProjectPackageJsonFilePath));

            // Remove package path from workspaces.
            const lPackagePath = FileSystem.pathToRelative(pProject.directory, pPackage.directory);
            lRootProjectPackageJson.workspaces = lRootProjectPackageJson.workspaces.filter((pWorkspace: string) => pWorkspace !== lPackagePath);

            // Remove package json when no package is left.
            if (lRootProjectPackageJson.workspaces.length === 0) {
                FileSystem.delete(lRootProjectPackageJsonFilePath);
            } else {
                // Write package.json file.
                FileSystem.write(lRootProjectPackageJsonFilePath, JSON.stringify(lRootProjectPackageJson, null, 4));
            }
        }
    }
}

type TransformConfiguration = {
    enableNode: boolean;
    nodeDirectory: string;
};