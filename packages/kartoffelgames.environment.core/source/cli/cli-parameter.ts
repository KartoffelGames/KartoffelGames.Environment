export class CliParameter {
    private readonly mParameters: Map<string, string | null>;
    private readonly mRootParameter: string;

    /**
     * Core parameter name.
     */
    public get rootParameter(): string {
        return this.mRootParameter;
    }

    /**
     * Constructor.
     * 
     * @param pRootParameter - Root parameter.
     */
    public constructor(pRootParameter: string) {
        this.mRootParameter = pRootParameter;
        this.mParameters = new Map<string, string | null>();
    }

    /**
     * Check if parameter exists.
     * Parameter can exist but have no value.
     * 
     * @param pParameterName - Parameter name.
     * 
     * @returns - True if parameter exists.
     */
    public has(pParameterName: string): boolean {
        return this.mParameters.has(pParameterName);
    }

    /**
     * Get parameter value.
     * Throws error if parameter does not exist or has no value.
     * 
     * @param pParameterName - Parameter name.
     * 
     * @returns - Parameter value.
     */
    public get(pParameterName: string): string {
        // Check if parameter exists.
        if (!this.has(pParameterName)) {
            throw `Parameter "${pParameterName}" does not exist`;
        }

        // Get parameter value and check if it has a value.
        const lValue: string | null = this.mParameters.get(pParameterName)!;
        if (!lValue) {
            throw `Parameter "${pParameterName}" needs a value`;
        }

        return lValue;
    }

    /**
     * Set parameter value.
     * Setting null value sets parameter to exist but have no value.
     * 
     * @param pParameterName - Parameter name.
     * @param pValue - Parameter value.
     */
    public set(pParameterName: string, pValue: string | null): void {
        this.mParameters.set(pParameterName, pValue);
    }

    /**
     * Delete parameter.
     * 
     * @param pParameterName - Parameter name.
     */
    public delete(pParameterName: string): void {
        this.mParameters.delete(pParameterName);
    }
}