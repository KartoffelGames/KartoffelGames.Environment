import { FileUtil } from '@kartoffelgames/environment.core';
import { IKgCliPackageBlueprint } from '@kartoffelgames/environment.kg-cli-command-create';
import { KgCliBlueprintDescription } from '@kartoffelgames/environment.kg-cli-command-create/library/source/interfaces/i-kg-cli-package-blueprint';
import { PackageParameter } from '@kartoffelgames/environment.kg-cli-command-create/library/source/package/package-parameter';
import * as path from 'path';

export class KgCliPackageBlueprint implements IKgCliPackageBlueprint {
    /**
     * Package information.
     */
    public get information(): KgCliBlueprintDescription {
        return {
            name: 'package',
            blueprintDirectory: path.resolve(__dirname, '..', 'blueprint'),
            description: 'Default npm package'
        };
    }

    /**
     * Replace placeholder in files.
     * @param pPackageDirectory - Package directory.
     * @param pParameter - Package parameter.
     */
    public async afterCopy(pPackageDirectory: string, pParameter: PackageParameter): Promise<void> {
        // Read all files.
        const lPackageFileList: Array<string> = FileUtil.findFiles(pPackageDirectory);

        // Get only folder name of directory.
        const lPackageFolderName = path.parse(pPackageDirectory).name;

        // Check all files.
        for (const lFilePath of lPackageFileList) {
            let lFileContent: string = FileUtil.read(lFilePath);

            // Replace placeholder inside file content.
            lFileContent = lFileContent
                .replaceAll('{{PROJECT_NAME}}', pParameter.projectName)
                .replaceAll('{{PACKAGE_NAME}}', pParameter.packageName)
                .replaceAll('{{PROJECT_FOLDER}}', lPackageFolderName);

            // Write changed content.
            FileUtil.write(lFilePath, lFileContent);
        }
    }
}