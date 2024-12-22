import { CliPackageBlueprintParameter, FileSystem, ICliPackageBlueprintResolver, Project } from '@kartoffelgames/environment.core';
import * as path from 'path';


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
        const lPackageFolderName = path.parse(pParameter.packageDirectory).name;

        // Get root project directory name.
        const lRootProjectName = path.parse(pProjectHandler.projectRootDirectory).base;

        // Check all files.
        for (const lFilePath of lPackageFileList) {
            let lFileContent: string = FileSystem.read(lFilePath);

            // Replace placeholder inside file content.
            lFileContent = lFileContent
                .replaceAll('{{PACKAGE_ID_NAME}}', pParameter.packageIdName)
                .replaceAll('{{PACKAGE_NAME}}', pParameter.packageName)
                .replaceAll('{{PROJECT_FOLDER}}', lPackageFolderName)
                .replaceAll('{{ROOT_PROJECT_FOLDER}}', lRootProjectName);

            // Write changed content.
            FileSystem.write(lFilePath, lFileContent);
        }
    }
}