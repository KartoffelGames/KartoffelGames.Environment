/**
 * Package import and resolve helper.
 */
export class Package {
    /**
     * Import a package.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns imported package. 
     */
    public static async import(pImportPath: string): Promise<any> {
        return require(pImportPath);
    }

    /**
     * Resolve a package import as a path.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns resolved path. 
     */
    public static resolveToPath(pImportPath: string): string {
        return require.resolve(pImportPath);
    }
}