export class PackageParameter {
    private readonly mPackageName: string;
    private readonly mParameters: Map<string, string | null>;
    private readonly mProjectName: string;

    /**
     * Get package name.
     */
    public get packageName(): string {
        return this.mPackageName;
    }

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
    public constructor(pPackageName: string, pProjectName: string) {
        this.mPackageName = pPackageName;
        this.mProjectName = pProjectName;
        this.mParameters = new Map<string, string | null>();
    }
}