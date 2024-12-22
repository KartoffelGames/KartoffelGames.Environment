export interface ICliProjectBlueprintResolver {
    /**
     * Executed after project files are copied.
     */
    afterCopy(pParameter: CliProjectBlueprintParameter): Promise<void>;
}

export type CliProjectBlueprintParameter = {
    projectName: string;
    projectDirectory: string;
};