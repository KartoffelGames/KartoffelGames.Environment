export class CliParameter {
    private readonly mParameters: Map<string, string | null>;

    /**
     * Get parameters.
     */
    public get parameter(): Map<string, string | null> {
        return this.mParameters;
    }

    /**
     * Constructor.
     */
    public constructor() {
        this.mParameters = new Map<string, string | null>();
    }
}