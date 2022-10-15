import * as path from 'path';
import * as filereader from 'fs';

export class FileUtil {
    /**
     * Copy directory with all files into destination
     * and replace text in files.
     * @param pSource - The path to the thing to copy.
     * @param pDestination - The path to the new copy.
     */
    public static copyDirectory(pSource: string, pDestination: string, pOverride: boolean, pReplacementMap: Map<RegExp, string>, pExcludeExtensionList: Array<string>): void {
        const lSourcePath: string = path.resolve(pSource);
        const lDestinationPath: string = path.resolve(pDestination);

        // Read all files.
        const lSourceFileList: Array<string> = this.deepGetFiles(pSource, 999, pExcludeExtensionList);

        for (const lSourceFile of lSourceFileList) {
            // Create relative item path. Trim leading splash.
            let lRelativeItemPath: string = lSourceFile.replace(lSourcePath, '');
            lRelativeItemPath = lRelativeItemPath.startsWith('\\') ? lRelativeItemPath.substring(1) : lRelativeItemPath;

            // Remove source path from source file, to append destination path instead of it.
            const lSourceItem: string = lSourceFile;
            const lDestinationItem: string = path.resolve(lDestinationPath, lRelativeItemPath);

            // File destination status. Check if override.
            const lDestinationExists = filereader.existsSync(lDestinationItem);
            if (!lDestinationExists || pOverride) {
                // Create directory.
                this.createDirectory(path.dirname(lDestinationItem));

                filereader.copyFileSync(lSourceItem, lDestinationItem);

                // Read file text.
                const lFileText = filereader.readFileSync(lDestinationItem, { encoding: 'utf8' });

                // Replace each replacement pattern.
                let lAlteredFileText = lFileText;
                for (const [lReplacementRegex, lReplacementValue] of pReplacementMap) {
                    lAlteredFileText = lAlteredFileText.replace(lReplacementRegex, lReplacementValue);
                }

                // Update file with altered file text.
                filereader.writeFileSync(lDestinationItem, lAlteredFileText, { encoding: 'utf8' });
            }
        }
    }

    /**
     * Create directory.
     * @param pPath - Path.
     */
    public static createDirectory(pPath: string): void {
        filereader.mkdirSync(pPath, { recursive: true });
    }

    /**
     * Get all file paths of given file name.
     * @param pStartDestination - Starting destination of search.
     * @param pSearchDepth - How deep should be searched.
     * @param pExcludeExtensionList - Extensions that should be excluded.
     */
    public static deepGetFiles(pStartDestination: string, pSearchDepth: number, pExcludeExtensionList: Array<string>): Array<string> {
        const lAbsoulteStartDestination = path.resolve(pStartDestination);

        // Check start directory existence.
        if (!filereader.existsSync(lAbsoulteStartDestination)) {
            throw `"${lAbsoulteStartDestination}" does not exists.`;
        }

        // Check if start directory is a directory.
        const lDirectoryStatus = filereader.statSync(lAbsoulteStartDestination);
        if (!lDirectoryStatus.isDirectory()) {
            throw `"${lAbsoulteStartDestination}" is not a directory.`;
        }

        const lResultPathList = new Array<string>();

        // Check every file.
        // Copy each item into new directory.
        for (const lChildItemName of filereader.readdirSync(pStartDestination)) {
            const lItemPath = path.join(lAbsoulteStartDestination, lChildItemName);
            const lItemStatus = filereader.statSync(lItemPath);

            // Check if file or directory. Only search for files in found directory if depth is available.
            // Add item path to results if file name matches seached file name.
            if (lItemStatus.isDirectory() && (pSearchDepth - 1) > -1) {
                // Search for files in  directory.
                lResultPathList.push(...FileUtil.deepGetFiles(lItemPath, pSearchDepth - 1, pExcludeExtensionList));
            } else {
                // Check if file should be excluded.
                let lIncluded: boolean = true;
                for (const lExtension of pExcludeExtensionList) {
                    if (lChildItemName.endsWith(lExtension)) {
                        lIncluded = false;
                        break;
                    }
                }

                if (lIncluded) {
                    lResultPathList.push(lItemPath);
                }
            }
        }

        return lResultPathList;
    }

    /**
     * Remove directory.
     * @param pPath - Directory path.
     */
    public static deleteDirectory(pPath: string): void {
        filereader.rmSync(pPath, { recursive: true, force: true });
    }

    /**
     * Check path or file existance.
     * @param pPath - Path.
     */
    public static exists(pPath: string): boolean {
        return filereader.existsSync(pPath);
    }

    /**
     * Search directory for file extension.
     * @param pDestination - Search destination.
     * @param pFileExtension - Search file extension.
     */
    public static findFileExtension(pDestination: string, pFileExtension: string): Array<string> {
        const lAbsoulteStartDestination = path.resolve(pDestination);

        // Check if start directory is a directory.
        const lDirectoryStatus = filereader.statSync(lAbsoulteStartDestination);
        if (!lDirectoryStatus.isDirectory()) {
            throw `"${lAbsoulteStartDestination}" is not a directory.`;
        }

        const lResultList: Array<string> = new Array<string>();
        for (const lChildItemName of filereader.readdirSync(lAbsoulteStartDestination)) {
            const lItemPath = path.join(lAbsoulteStartDestination, lChildItemName);
            const lItemStatus = filereader.statSync(lItemPath);

            if (!lItemStatus.isDirectory() && lChildItemName.endsWith(pFileExtension)) {
                lResultList.push(lItemPath);
            }
        }

        return lResultList;
    }

    /**
     * Get all file paths of given file name.
     * @param pStartDestination - Starting destination of search.
     * @param pFileName - File name that should be searched.
     * @param pSearchDepth - How deep should be searched.
     */
    public static findFiles(pStartDestination: string, pFileName: string, pSearchDepth: number): Array<string> {
        const lAbsoulteStartDestination = path.resolve(pStartDestination);

        // Check start directory existence.
        if (!filereader.existsSync(lAbsoulteStartDestination)) {
            throw `"${lAbsoulteStartDestination}" does not exists.`;
        }

        // Check if start directory is a directory.
        const lDirectoryStatus = filereader.statSync(lAbsoulteStartDestination);
        if (!lDirectoryStatus.isDirectory()) {
            throw `"${lAbsoulteStartDestination}" is not a directory.`;
        }

        const lResultPathList = new Array<string>();

        // Check every file.
        // Copy each item into new directory.
        for (const lChildItemName of filereader.readdirSync(lAbsoulteStartDestination)) {
            const lItemPath = path.join(lAbsoulteStartDestination, lChildItemName);
            const lItemStatus = filereader.statSync(lItemPath);

            // Check if file or directory. Only search for files in found directory if depth is available.
            // Add item path to results if file name matches seached file name.
            if (lItemStatus.isDirectory() && (pSearchDepth - 1) > -1) {
                // Search for files in  directory.
                lResultPathList.push(...FileUtil.findFiles(lItemPath, pFileName, pSearchDepth - 1));
            } else if (lChildItemName.toLowerCase() === pFileName.toLowerCase()) {
                lResultPathList.push(lItemPath);
            }
        }

        return lResultPathList;
    }

    /**
     * Find all files of name backwards from starting directory, ending on root.
     * @param pStartDestination - Start search destination.
     * @param pFileName - File name.
     */
    public static findFilesReverse(pStartDestination: string, pFileName: string): Array<string> {
        const lAbsoulteStartDestination = path.resolve(pStartDestination);

        // Check start directory existence.
        if (!filereader.existsSync(lAbsoulteStartDestination)) {
            throw `"${lAbsoulteStartDestination}" does not exists.`;
        }

        // Check if start directory is a directory.
        const lDirectoryStatus = filereader.statSync(lAbsoulteStartDestination);
        if (!lDirectoryStatus.isDirectory()) {
            throw `"${lAbsoulteStartDestination}" is not a directory.`;
        }

        const lResultPathList = new Array<string>();

        // Check every file.
        // Copy each item into new directory.
        for (const lChildItemName of filereader.readdirSync(pStartDestination)) {
            const lItemPath = path.join(lAbsoulteStartDestination, lChildItemName);
            const lItemStatus = filereader.statSync(lItemPath);

            // Check if file or directory. Only search for files in found directory if depth is available.
            // Add item path to results if file name matches seached file name.
            if (!lItemStatus.isDirectory() && lChildItemName.toLowerCase() === pFileName.toLowerCase()) {
                lResultPathList.push(lItemPath);
            }
        }

        // Go Backwards.
        const lBackwardsPath: string = path.dirname(lAbsoulteStartDestination);
        if (path.parse(lBackwardsPath).root !== lBackwardsPath) {
            lResultPathList.push(...FileUtil.findFilesReverse(lBackwardsPath, pFileName));
        }

        return lResultPathList;
    }

    /**
     * Read file content.
     * @param pPath - Path to file.
     */
    public static read(pPath: string): string {
        return filereader.readFileSync(pPath, { encoding: 'utf8' });
    }

    /**
     * Read file content.
     * @param pPath - Path to file.
     * @param pContent - File content.
     */
    public static write(pPath: string, pContent: string): void {
        filereader.writeFileSync(pPath, pContent, { encoding: 'utf8' });
    }
}