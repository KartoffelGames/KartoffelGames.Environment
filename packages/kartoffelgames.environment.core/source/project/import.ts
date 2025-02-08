/**
 * Package import and resolve helper.
 */
export class Import {
    /**
     * Import a package.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns imported package. 
     */
    public static async import(pImportPath: string): Promise<any> {
        return import(pImportPath);
    }

    /**
     * Resolve a package import as a path.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns resolved path. 
     */
    public static resolveToUrl(pImportPath: string): URL {
        return new URL(import.meta.resolve(pImportPath));
    }
}