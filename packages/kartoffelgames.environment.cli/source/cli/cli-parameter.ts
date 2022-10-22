export class CliParameter {
    private readonly mParameters: Map<string, string | null>;
    private readonly mPath: Array<string>;

    /**
     * Get parameters.
     */
    public get parameter(): Map<string, string | null> {
        return this.mParameters;
    }

    /**
     * Get path.
     */
    public get path(): Array<string> {
        return this.mPath;
    }

    /**
     * Constructor.
     */
    public constructor() {
        this.mParameters = new Map<string, string | null>();
        this.mPath = new Array<string>();
    }
}