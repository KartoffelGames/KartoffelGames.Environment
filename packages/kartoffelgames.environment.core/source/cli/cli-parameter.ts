export class CliParameter {
    private readonly mParameters: Map<string, string | null>;
    private readonly mFlags: Set<string>;

    /**
     * Get flags.
     */
    public get flags(): Set<string> {
        return this.mFlags;
    }

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
        this.mFlags = new Set<string>();
    }
}