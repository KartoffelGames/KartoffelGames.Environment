import { build } from '@deno/dnt';
import { CliCommandDescription, CliParameter, Console, FileSystem, ICliPackageCommand, Package, ProcessContext, Project } from '@kartoffelgames/environment-core';

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
            FileSystem.deleteDirectory(lNodeDirectory);
        }

        // Remove package from root package json.
        const lRootProjectPackageJsonFilePath: string = FileSystem.pathToAbsolute(pProject.directory, 'package.json');
        if (FileSystem.exists(lRootProjectPackageJsonFilePath)) {
            // Read package.json file.
            const lRootProjectPackageJson = JSON.parse(FileSystem.read(lRootProjectPackageJsonFilePath));

            // Remove package path from workspaces.
            const lPackagePath = FileSystem.pathToRelative(pProject.directory, FileSystem.pathToAbsolute(pPackage.directory, pRelativeNodeDirectory));
            lRootProjectPackageJson.workspaces = lRootProjectPackageJson.workspaces.filter((pWorkspace: string) => pWorkspace !== lPackagePath);

            // Remove package json when no package is left.
            if (lRootProjectPackageJson.workspaces.length === 0) {
                FileSystem.delete(lRootProjectPackageJsonFilePath);

                // Remove a possible node_modules directory.
                const lNodeModulesDirectory = FileSystem.pathToAbsolute(pProject.directory, 'node_modules');
                if (FileSystem.exists(lNodeModulesDirectory)) {
                    FileSystem.deleteDirectory(lNodeModulesDirectory);
                }

                // Remove a possible package-lock.json file.
                const lPackageLockJsonFilePath = FileSystem.pathToAbsolute(pProject.directory, 'package-lock.json');
                if (FileSystem.exists(lPackageLockJsonFilePath)) {
                    FileSystem.delete(lPackageLockJsonFilePath);
                }
            } else {
                // Write package.json file.
                FileSystem.write(lRootProjectPackageJsonFilePath, JSON.stringify(lRootProjectPackageJson, null, 4));
            }
        }
    }

    /**
     * Transforms a Deno project to a Node.js compatible project.
     * 
     * @param pProject - The project to transform.
     * @param pPackage - The package within the project to transform.
     * @param pNodeDirectory - The directory where the transformed Node.js project will be output.
     * @returns A promise that resolves when the transformation is complete.
     * 
     * @remarks
     * This function performs the following steps:
     * 1. Ensures a `package.json` file exists in the project root directory.
     * 2. Cleans the old Node.js transformation directory.
     * 3. Identifies all files used in the export `deno.json` property.
     * 4. Filters out non-TypeScript files from the exported file list.
     * 5. Creates a temporary TypeScript file to maintain the original directory structure.
     * 6. Converts all exported files to relative paths.
     * 7. Identifies and includes additional files specified in the `publish.include` configuration.
     * 8. Excludes files specified in the `publish.exclude` configuration.
     * 9. Removes TypeScript files from the published files list.
     * 10. Removes duplicate entries from the published files list.
     * 11. Converts all published files to relative paths.
     * 12. Writes the temporary core-import-placeholder TypeScript file.
     * 13. Uses the `build` function to transform the project to Node.js.
     * 14. Adds the package path to the root project's `package.json` workspaces.
     * 15. Cleans up the temporary core-import-placeholder TypeScript file.
     */
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
        if (typeof pPackage.configuration['exports'] === 'string') {
            lExportedFiles.push(FileSystem.pathToAbsolute(pPackage.directory, pPackage.configuration['exports']));
        } else {
            for (const lExportPath of Object.values(pPackage.configuration['exports'] ?? {})) {
                // export path must be a string.
                if (typeof lExportPath !== 'string') {
                    continue;
                }

                lExportedFiles.push(FileSystem.pathToAbsolute(pPackage.directory, lExportPath));
            }
        }

        // Store any file that is not exported so it is included in the installed package.
        let lPublishedFiles: Array<string> = new Array<string>();

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
            return FileSystem.pathToRelative(ProcessContext.workingDirectory, pFilePath);
        });

        // Add all published files to lPublishedFiles list.
        for (const lIncludedPublishedFile of pPackage.configuration['publish']?.['include'] ?? []) {
            // When it is a single file, add it to the published files.
            const lSingleFileOrDirectoryPath: string = FileSystem.pathToAbsolute(pPackage.directory, lIncludedPublishedFile);
            if (FileSystem.exists(lSingleFileOrDirectoryPath) && FileSystem.pathInformation(lSingleFileOrDirectoryPath).isFile) {
                lPublishedFiles.push(lSingleFileOrDirectoryPath);
                continue;
            }

            // When it is a directory, add all files in the directory to the published files.
            if (FileSystem.exists(lSingleFileOrDirectoryPath) && FileSystem.pathInformation(lSingleFileOrDirectoryPath).isDirectory) {
                lPublishedFiles.push(...FileSystem.findFiles(lSingleFileOrDirectoryPath));
                continue;
            }

            // When it is neighter a file or directory, it might be a glob pattern.
            lPublishedFiles.push(...FileSystem.glob(pPackage.directory, lSingleFileOrDirectoryPath));
        }

        // Find all paths that are set in the exclude export property.
        const lExcludedExportFiles: Array<string> = new Array<string>();
        for (const lIncludedPublishedFile of pPackage.configuration['publish']?.['exclude'] ?? []) {
            // When it is a single file, add it to the published files.
            const lSingleFileOrDirectoryPath: string = FileSystem.pathToAbsolute(pPackage.directory, lIncludedPublishedFile);
            if (FileSystem.exists(lSingleFileOrDirectoryPath) && FileSystem.pathInformation(lSingleFileOrDirectoryPath).isFile) {
                lExcludedExportFiles.push(lSingleFileOrDirectoryPath);
                continue;
            }

            // When it is a directory, add all files in the directory to the published files.
            if (FileSystem.exists(lSingleFileOrDirectoryPath) && FileSystem.pathInformation(lSingleFileOrDirectoryPath).isDirectory) {
                lExcludedExportFiles.push(...FileSystem.findFiles(lSingleFileOrDirectoryPath));
                continue;
            }

            // When it is neighter a file or directory, it might be a glob pattern.
            lExcludedExportFiles.push(...FileSystem.glob(pPackage.directory, lSingleFileOrDirectoryPath));
        }

        // Remove all excluded files from the published files.
        for (const lExcludedExportFile of lExcludedExportFiles) {
            const lExcludedExportFileIndex = lPublishedFiles.indexOf(lExcludedExportFile);
            if (lExcludedExportFileIndex !== -1) {
                lPublishedFiles.splice(lExcludedExportFileIndex, 1);
            }
        }

        // Remove all ts files from the published files.
        for (let lIndex = lPublishedFiles.length - 1; lIndex > -1; lIndex--) {
            const lPublishedFilePath: string = lPublishedFiles[lIndex];
            const lPublishedFileInformation = FileSystem.pathInformation(lPublishedFilePath);

            if (lPublishedFileInformation.extension === '.ts') {
                lPublishedFiles.splice(lIndex, 1);
            }
        }

        // Remove dublicates from published files.
        lPublishedFiles = Array.from(new Set(lPublishedFiles));

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
                    license: pPackage.configuration['license'] ?? null
                },
                // Skip checks that would fail.
                typeCheck: false,
                test: false,
                postBuild() {
                    for (const lRelativePublishedFile of lRelativePublishedFiles) {
                        // Create absolute paths for the source and target copy paths.
                        const lSourceAbsoluteTargetPath: string = FileSystem.pathToAbsolute(pPackage.directory, lRelativePublishedFile);
                        const lTargetAbsoluteEsmPath: string = FileSystem.pathToAbsolute(pNodeDirectory, 'esm', lRelativePublishedFile);
                        const lTargetAbsoluteScriptPath: string = FileSystem.pathToAbsolute(pNodeDirectory, 'script', lRelativePublishedFile);
                        const lTargetAbsoluteSourcePath: string = FileSystem.pathToAbsolute(pNodeDirectory, 'src', lRelativePublishedFile);

                        // Create directories.
                        FileSystem.createDirectory(FileSystem.pathInformation(lTargetAbsoluteEsmPath).directory);
                        FileSystem.createDirectory(FileSystem.pathInformation(lTargetAbsoluteScriptPath).directory);
                        FileSystem.createDirectory(FileSystem.pathInformation(lTargetAbsoluteSourcePath).directory);

                        // Copy.
                        FileSystem.copyFile(lSourceAbsoluteTargetPath, lTargetAbsoluteEsmPath);
                        FileSystem.copyFile(lSourceAbsoluteTargetPath, lTargetAbsoluteScriptPath);
                        FileSystem.copyFile(lSourceAbsoluteTargetPath, lTargetAbsoluteSourcePath);
                    }
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
}

type TransformConfiguration = {
    enableNode: boolean;
    nodeDirectory: string;
};