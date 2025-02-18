import { type CliCommandDescription, Console, FileSystem, type ICliPackageCommand, ProcessContext } from '@kartoffelgames/environment-core';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip-js/zip-js';

/**
 * Command to initialize new monorepo project.
 */
export class Command implements ICliPackageCommand<string> {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription<string> {
        return {
            command: {
                description: 'Initialize new monorepo project.',
                parameters: {
                    root: 'init'
                }
            },
            configuration: {
                name: 'project-blueprint',
                default: ''
            }
        };
    }

    /**
     * Execute command.
     */
    public async run(): Promise<void> {
        const lConsole = new Console();

        // Output heading.
        lConsole.writeLine('Create Project');

        // Create blueprint.
        await this.createBlueprint();

        // Display init information.
        lConsole.writeLine('Project successfully created.');
    }

    /**
     * Create blueprint files.
     * 
     * @param pProjectName - Package name.
     * @param pBlueprint - Blueprint name.
     * @param pCommandParameter - Command parameter.
     * @returns 
     */
    private async createBlueprint(): Promise<string> {
        const lConsole = new Console();

        // Get source and target path of blueprint files.
        const lTargetPath: string = FileSystem.pathToAbsolute(ProcessContext.workingDirectory);

        // Check existing target directory.
        if (FileSystem.exists(lTargetPath) && FileSystem.findFiles(lTargetPath).length > 0) {
            throw `Target directory "${lTargetPath}" is not empty.`;
        }

        // Ask the user about the project scope.
        const lProjectScope: string = await lConsole.promt('Project Scope (@example): ', /^@[a-z]+/);

        // Build blueprint file url by getting the path of kg-cli.config.json and replacing it with the the blueprint path.
        const lProjectBlueprintZipUrlString: string = import.meta.url.replace('source/command.ts', 'blueprint/project-blueprint.zip');
        const lProjectBlueprintZipUrl: URL = new URL(lProjectBlueprintZipUrlString);

        // Fetch project blueprint zip.
        const lProjectBlueprintZipRequest: Response = await fetch(lProjectBlueprintZipUrl);
        const lProjectBlueprintZipBlob: Blob = await lProjectBlueprintZipRequest.blob();

        // Create zip reader from zip blob.
        const lZipBlobReader: BlobReader = new BlobReader(lProjectBlueprintZipBlob);
        const lZipReader: ZipReader<unknown> = new ZipReader(lZipBlobReader);

        // Rollback on error.
        try {
            // Copy files.
            lConsole.writeLine('Copy files...');

            // Decompress blueprint into target directory.
            for await (const lZipEntry of lZipReader.getEntriesGenerator()) {
                // Skip directories.
                if (lZipEntry.directory) {
                    continue;
                }

                const lTargetFilePath: string = FileSystem.pathToAbsolute(lTargetPath, lZipEntry.filename);

                // Read Directory part of target file path.
                const lTargetFileDirectoryPath: string = FileSystem.directoryOfFile(lTargetFilePath);

                // Create directory if it does not exist.
                if (!FileSystem.exists(lTargetFileDirectoryPath)) {
                    FileSystem.createDirectory(lTargetFileDirectoryPath);
                }

                // Output copy information.
                lConsole.writeLine('Copy ' + lZipEntry.filename);

                // Read zipped file.
                const lZipFileData: Uint8Array = await lZipEntry.getData!<Uint8Array>(new Uint8ArrayWriter());
                FileSystem.writeBinary(lTargetFilePath, lZipFileData);

                // Replace blueprint placeholder.
                this.replacePlaceholder(lTargetPath, lProjectScope);
            }
        } catch (lError) {
            lConsole.writeLine('ERROR: Try rollback.');

            // Rollback by deleting package directory.
            FileSystem.emptyDirectory(lTargetPath);

            // Rethrow error.
            throw lError;
        }

        return lTargetPath;
    }

    private async replacePlaceholder(pRootPath: string, pScope: string): Promise<void> {
        // Read current cli version.
        const lCliPackageJsonModule = await import('../deno.json', { with: { type: 'json' } });
        const lCliPackageJson = lCliPackageJsonModule.default;
        const lCurrentCliVersion: string = lCliPackageJson.version;

        // Read all files.
        const lPackageFileList: Array<string> = FileSystem.findFiles(pRootPath);

        // Check all files.
        for (const lFilePath of lPackageFileList) {
            let lFileContent: string = FileSystem.read(lFilePath);

            // Replace placeholder inside file content.
            lFileContent = lFileContent
            .replaceAll('{{CLI_VERSION}}', lCurrentCliVersion)
            .replaceAll('{{PROJECT_SCOPE}}', pScope);

            // Write changed content.
            FileSystem.write(lFilePath, lFileContent);
        }
    }
}