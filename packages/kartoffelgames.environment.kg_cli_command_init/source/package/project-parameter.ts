export class ProjectParameter {
    private readonly mParameters: Map<string, string | null>;
    private readonly mProjectName: string;

    /**
     * Get parameters.
     */
    public get parameter(): Map<string, string | null> {
        return this.mParameters;
    }

    /**
     * Get project name.
     */
    public get projectName(): string {
        return this.mProjectName;
    }

    /**
     * Constructor.
     * @param pPackageName - package name.
     */
    public constructor(pProjectName: string) {
        this.mProjectName = pProjectName;
        this.mParameters = new Map<string, string | null>();
    }
}