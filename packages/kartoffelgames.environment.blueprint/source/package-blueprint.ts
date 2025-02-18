import type { CliPackageBlueprintParameter, ICliPackageBlueprintResolver } from '@kartoffelgames/environment-command-create';
import { FileSystem, type Project } from '@kartoffelgames/environment-core';

export class CliPackageBlueprint implements ICliPackageBlueprintResolver {
    /**
     * Replace placeholder in files.
     * @param pPackageDirectory - Package directory.
     * @param pParameter - Package parameter.
     */
    public async afterCopy(pParameter: CliPackageBlueprintParameter, pProjectHandler: Project): Promise<void> {
        // Read all files.
        const lPackageFileList: Array<string> = FileSystem.findFiles(pParameter.packageDirectory);

        // Get only folder name of directory.
        const lPackageFolderName: string = pParameter.packageDirectory.split(/\/|\\/g).pop()!;

        // Get root project directory name.
        const lRootProjectName: string = pProjectHandler.directory.split(/\/|\\/g).pop()!;

        // Check all files.
        for (const lFilePath of lPackageFileList) {
            let lFileContent: string = FileSystem.read(lFilePath);

            // Replace placeholder inside file content.
            lFileContent = lFileContent
                .replaceAll('{{PACKAGE_ID_NAME}}', pParameter.packageIdName)
                .replaceAll('{{PACKAGE_NAME}}', pParameter.packageName)
                .replaceAll('{{PACKAGE_FOLDER}}', lPackageFolderName)
                .replaceAll('{{PROJECT_FOLDER}}', lRootProjectName);

            // Write changed content.
            FileSystem.write(lFilePath, lFileContent);
        }
    }

    /**
     * List of all available blueprints.
     */
    public availableBlueprints(): Map<string, URL> {
        const lBlueprints: Map<string, URL> = new Map<string, URL>();
        lBlueprints.set('kg-main', new URL('../blueprint/package-blueprint.zip', import.meta.url));

        return lBlueprints;
    }
}