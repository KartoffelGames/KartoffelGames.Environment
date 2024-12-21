export class Package {
    /**
     * Resolve a package import as a path.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns resolved path. 
     */
    public static resolve(pImportPath: string): string {
        return require.resolve(pImportPath);
    }
}