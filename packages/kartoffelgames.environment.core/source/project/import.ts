import { ProcessParameter } from "../process/process-parameter.ts";
import { Process } from "../process/process.ts";

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
        return import(pImportPath, {});
    }

    /**
     * Import a json file.
     * 
     * @param pImportPath - Import. Uses default import or path.
     * 
     * @returns imported package. 
     */
    public static async importJson(pImportPath: string): Promise<any> {
        return import(pImportPath, { with: { type: 'json' } });
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

    /**
     * Resolve a package import as a path in context of a path.
     * 
     * @param pContextPath - Context path. This is the path where the import is resolved from.
     * @param pImportPath - Import path. This is the path to the import.
     * 
     * @returns resolved path.
     */
    public static async resolveToUrlInContext(pContextPath: string, pImportPath: string): Promise<URL> {
        // Create new process.
        const lProcess: Process = new Process();

        // Create command parameter for process.
        const lParameter: ProcessParameter = new ProcessParameter(pContextPath, ["deno", "eval", `console.log(import.meta.resolve("${pImportPath}"))`]);

        // Execute and read process result.
        const lResolveUrl: string = await lProcess.execute(lParameter);

        return new URL(lResolveUrl.trim());
    }
}