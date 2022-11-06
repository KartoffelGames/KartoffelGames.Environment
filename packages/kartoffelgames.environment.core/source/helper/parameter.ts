export class Parameter {
    private readonly mFullPath: Array<string>;
    private readonly mParameters: Map<string, CommandParameter>;
    private readonly mPath: Array<string>;

    /**
     * Get full path.
     */
    public get fullPath(): Array<string> {
        return this.mFullPath;
    }

    /**
     * Get parameters.
     */
    public get parameter(): Map<string, CommandParameter> {
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
     * @param pStartingCommand - Starting command path part. Part of a command that initializes the real command start.
     */
    public constructor(pStartingCommand: string) {
        this.mParameters = new Map<string, CommandParameter>();
        this.mPath = new Array<string>();
        this.mFullPath = new Array<string>();

        const lParameterName: RegExp = /^--(.+)$/;

        // Next parameter buffer.
        let lNextParameterIsValue: boolean = false;
        let lNextParameterName: string = '';

        // Read parameter.
        let lCommandStarted: boolean = false;
        let lCommandParameterStarted: boolean = false;
        process.argv.forEach((pValue: string) => {
            // Process command only when starting command is reached.
            if (!lCommandStarted) {
                // Check if path started.
                if (pValue.toLowerCase().includes(pStartingCommand.toLowerCase())) {
                    lCommandStarted = true;
                } else {
                    return;
                }
            } else {
                if (lParameterName.test(pValue)) {
                    // Set area as parameter started.
                    lCommandParameterStarted = true;

                    // Process as parameter name.
                    const lParameterNameMatch = <RegExpExecArray>lParameterName.exec(pValue);
                    lNextParameterName = lParameterNameMatch[1]; // First group. Name without "--"
                    lNextParameterIsValue = true;

                    // Set empty parameter.
                    this.mParameters.set(lNextParameterName, {
                        name: lNextParameterName,
                        value: null
                    });
                } else if (lNextParameterIsValue) {
                    // Slice optional ""
                    let lParameterValue: string = pValue;
                    if (pValue.startsWith('"') && pValue.endsWith('"')) {
                        lParameterValue = lParameterValue.slice(1, lParameterValue.length - 1);
                    }

                    // Process parameter value.
                    (<CommandParameter>this.mParameters.get(lNextParameterName)).value = lParameterValue;

                    // Reset parameter flags.
                    lNextParameterIsValue = false;
                    lNextParameterName = '';
                } else if (!lCommandParameterStarted) {
                    // Process as path.
                    this.mPath.push(pValue);
                } else {
                    throw 'Wrong command syntax';
                }

                // Add value to full path.
                this.mFullPath.push(pValue);
            }
        });
    }
}

type CommandParameter = {
    name: string;
    value: string | null;
};