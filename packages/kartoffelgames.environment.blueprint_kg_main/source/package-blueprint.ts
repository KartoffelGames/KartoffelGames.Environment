import { FileUtil, Project } from '@kartoffelgames/environment.core';
import { IKgCliPackageBlueprint, PackageParameter, KgCliPackageBlueprintDescription } from '@kartoffelgames/environment.command-create';
import * as path from 'path';

export class KgCliPackageBlueprint implements IKgCliPackageBlueprint {
    /**
     * Package information.
     */
    public get information(): KgCliPackageBlueprintDescription {
        return {
            name: 'kg-main',
            blueprintDirectory: path.resolve(__dirname, '..', '..', 'package_blueprint'), // called from library/source
            description: 'Default KartoffelGames package'
        };
    }

    /**
     * Replace placeholder in files.
     * @param pPackageDirectory - Package directory.
     * @param pParameter - Package parameter.
     */
    public async afterCopy(pPackageDirectory: string, pParameter: PackageParameter, pProjectHandler: Project): Promise<void> {
        // Read all files.
        const lPackageFileList: Array<string> = FileUtil.findFiles(pPackageDirectory);

        // Get only folder name of directory.
        const lPackageFolderName = path.parse(pPackageDirectory).name;

        // Get root project directory name.
        const lRootProjectName = path.parse(pProjectHandler.projectRootDirectory).base;

        // Check all files.
        for (const lFilePath of lPackageFileList) {
            let lFileContent: string = FileUtil.read(lFilePath);

            // Replace placeholder inside file content.
            lFileContent = lFileContent
                .replaceAll('{{PROJECT_NAME}}', pParameter.projectName)
                .replaceAll('{{PACKAGE_NAME}}', pParameter.packageName)
                .replaceAll('{{PROJECT_FOLDER}}', lPackageFolderName)
                .replaceAll('{{ROOT_PROJECT_FOLDER}}', lRootProjectName);

            // Write changed content.
            FileUtil.write(lFilePath, lFileContent);
        }
    }
}