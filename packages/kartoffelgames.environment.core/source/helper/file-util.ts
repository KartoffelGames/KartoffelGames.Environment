import * as path from 'path';
import * as filereader from 'fs';

export class FileUtil {
    /**
     * Copy directory with all files into destination.
     * @param pSource - The path to the thing to copy.
     * @param pDestination - The path to the new copy.
     * @param pOverride - If existing files should be overriden.
     */
    public static copyDirectory(pSource: string, pDestination: string, pOverride?: boolean, pOptions?: FileSearchOptions): void {
        const lSourcePath: string = path.resolve(pSource);
        const lDestinationPath: string = path.resolve(pDestination);

        // Read all files.
        const lSourceFileList: Array<string> = this.findFiles(pSource, pOptions);

        for (const lSourceFile of lSourceFileList) {
            // Create relative item path. Trim leading slash.
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

                // Copy file.
                filereader.copyFileSync(lSourceItem, lDestinationItem);
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
     * Remove directory.
     * @param pPath - Directory path.
     */
    public static deleteDirectory(pPath: string): void {
        filereader.rmSync(pPath, { recursive: true, force: true });
    }

    /**
     * Delete every file and directory inside set directory.
     * @param pPath - Directory path.
     */
    public static emptyDirectory(pPath: string): void {
        // Exit on non esisting directory.
        if(!FileUtil.exists(pPath)){
            return;
        }

        filereader.readdirSync(pPath).forEach(pFileName => {
            const lFilePath: string = path.join(pPath, pFileName);
            filereader.rmSync(lFilePath, { recursive: true, force: true });
        });
    }

    /**
     * Check path or file existance.
     * @param pPath - Path.
     */
    public static exists(pPath: string): boolean {
        return filereader.existsSync(pPath);
    }

    /**
     * Search files.
     * @param pStartDirectory - Starting directory.
     * @param pOptions - [Optional] Search options
     */
    public static findFiles(pStartDirectory: string, pOptions?: FileSearchOptions): Array<string> {
        // Read configuration.
        const lSearchDepth: number = pOptions?.depth ?? 999;
        const lIncludeFileNameList: Array<string> = pOptions?.include?.fileNames ?? new Array<string>();
        const lIncludeDirectoryList: Array<string> = pOptions?.include?.directories ?? new Array<string>();
        const lIncludeExtensionsList: Array<string> = pOptions?.include?.extensions ?? new Array<string>();
        const lExcludeFileNameList: Array<string> = pOptions?.exclude?.fileNames ?? new Array<string>();
        const lExcludeDirectoryList: Array<string> = pOptions?.exclude?.directories ?? new Array<string>();
        const lExcludeExtensionsList: Array<string> = pOptions?.exclude?.extensions ?? new Array<string>();
        const lSearchDirection: 'outsideIn' | 'insideOut' = pOptions?.direction ?? 'outsideIn';

        // Construct next search options.
        const lNextSearchOptions: FileSearchOptions = {
            depth: lSearchDepth - 1,
            include: {
                fileNames: lIncludeFileNameList,
                directories: lIncludeDirectoryList,
                extensions: lIncludeExtensionsList
            },
            exclude: {
                fileNames: lExcludeFileNameList,
                directories: lExcludeDirectoryList,
                extensions: lExcludeExtensionsList
            },
            direction: lSearchDirection
        };

        const lAbsoulteStartDirectory = path.resolve(pStartDirectory);

        // Check if start directory is a directory.
        const lDirectoryStatus = filereader.statSync(lAbsoulteStartDirectory);
        if (!lDirectoryStatus.isDirectory()) {
            throw `"${lAbsoulteStartDirectory}" is not a directory.`;
        }

        const lResultList: Array<string> = new Array<string>();

        // Iterate over all
        for (const lChildItemName of filereader.readdirSync(lAbsoulteStartDirectory)) {
            const lItemPath = path.join(lAbsoulteStartDirectory, lChildItemName);
            const lItemStatus = filereader.statSync(lItemPath);

            // Directory handling.
            if (lItemStatus.isDirectory()) {
                const lNextDirectoryName = path.parse(lItemPath).name;

                // Only search in child directory on outside in search.
                if (lSearchDirection !== 'outsideIn') {
                    continue;
                }

                // Check search depth.
                if ((lSearchDepth - 1) < 0) {
                    continue;
                }

                // Check directory inclusion.
                if (lIncludeDirectoryList.length > 0 && !lIncludeDirectoryList.includes(lNextDirectoryName)) {
                    continue;
                }

                // Check directory exclusion.
                if (lExcludeDirectoryList.length > 0 && lExcludeDirectoryList.includes(lNextDirectoryName)) {
                    continue;
                }

                lResultList.push(...this.findFiles(lItemPath, lNextSearchOptions));
            } else {
                const lFileExtension: string = lChildItemName.split('.').pop() ?? '';

                // Check file inclusion. 
                if (lIncludeFileNameList.length > 0 && !lIncludeFileNameList.includes(lChildItemName)) {
                    continue;
                }

                // Check file extension inclusion.        
                if (lIncludeExtensionsList.length > 0 && !lIncludeExtensionsList.includes(lFileExtension)) {
                    continue;
                }

                // Check file exclusion. 
                if (lExcludeFileNameList.length > 0 && lExcludeFileNameList.includes(lChildItemName)) {
                    continue;
                }

                // Check file extension exclusion.
                if (lExcludeExtensionsList.length > 0 && lExcludeExtensionsList.includes(lFileExtension)) {
                    continue;
                }

                // Add file to results.
                lResultList.push(lItemPath);
            }
        }

        // Go Backwards on inside out search.
        if (lSearchDirection === 'insideOut') {
            const lBackwardsPath: string = path.dirname(lAbsoulteStartDirectory);
            const lNextDirectoryName = path.parse(lBackwardsPath).name;

            // Check search depth.
            if ((lSearchDepth - 1) < 0) {
                return lResultList;
            }

            // Check directory inclusion.
            if (lIncludeDirectoryList.length > 0 && !lIncludeDirectoryList.includes(lNextDirectoryName)) {
                return lResultList;
            }

            // Check directory exclusion.
            if (lExcludeDirectoryList.length > 0 && lExcludeDirectoryList.includes(lNextDirectoryName)) {
                return lResultList;
            }

            // Check if next directory is a root path.
            if (path.parse(lBackwardsPath).root === lBackwardsPath) {
                return lResultList;
            }

            // Search in parent directory files.
            lResultList.push(...FileUtil.findFiles(lBackwardsPath, lNextSearchOptions));
        }

        return lResultList;
    }

    /**
     * Check if directory is empty.
     * @param pPath - Directory.
     */
    public static isEmpty(pPath: string): boolean {
        return filereader.readdirSync(pPath).length === 0;
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
     */
    public static async readAsync(pPath: string): Promise<string> {
        return new Promise<string>((pResolve, pReject) => {
            filereader.readFile(pPath, { encoding: 'utf8' }, (pError, pFileData) => {
                if (pError) {
                    pReject(pError);
                    return;
                }
                pResolve(pFileData);
            });
        });
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

export type FileSearchOptions = {
    depth?: number;
    include?: {
        fileNames?: Array<string>;
        directories?: Array<string>;
        extensions?: Array<string>;
    },
    exclude?: {
        fileNames?: Array<string>;
        directories?: Array<string>;
        extensions?: Array<string>;
    };
    direction?: 'outsideIn' | 'insideOut';
};