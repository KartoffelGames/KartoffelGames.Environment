import type { ICliPackageCommand } from './i-cli-package-command.interface.ts';

/**
 * The `CliParameter` class provides methods to manage command-line parameters.
 * It allows extracting the root command, checking for the existence of parameters,
 * retrieving parameter values, setting parameter values, and deleting parameters.
 */
export class CliParameter {
    private static readonly mGlobalParameters: Map<string, CliParameterOptionalParameter> = (() => {
        const lGlobalParameters: Map<string, CliParameterOptionalParameter> = new Map<string, CliParameterOptionalParameter>();

        // Add the --all parameter.
        lGlobalParameters.set('--all', { fullname: 'all', shortName: 'a', default: null });
        lGlobalParameters.set('-a', { fullname: 'all', shortName: 'a', default: null });

        // Add the --package parameter.
        lGlobalParameters.set('--package', { fullname: 'package', shortName: 'p', default: null });
        lGlobalParameters.set('-p', { fullname: 'package', shortName: 'p', default: null });

        return lGlobalParameters;
    })();

    /**
     * Creates a `CliParameter` instance for a given command and its parameters.
     *
     * @param pCliCommand - The CLI command package containing command information.
     * @param pParameter - An array of strings representing the parameters passed to the command.
     * 
     * @returns A `CliParameter` instance populated with the provided parameters.
     * 
     * @throws {@link Error}
     * Will throw an error if no parameters are provided.
     * @throws {@link Error}
     * Will throw an error if the root parameter does not match the expected value.
     * @throws {@link Error}
     * Will throw an error if a required parameter is missing or starts with a dash.
     * @throws {@link Error}
     * Will throw an error if an unexpected parameter is encountered.
     */
    public static forCommand(pCliCommand: ICliPackageCommand, pParameter: Array<string>): CliParameter {
        // At least one parameter (the root) is required.
        if (pParameter.length === 0) {
            throw new Error('No command parameter found');
        }

        // Create copy specified parameter.
        const lUncheckedParameters: Array<string> = [...pParameter];

        // Remove the root parameter from the parameter list. No need to check it.
        if (pCliCommand.information.command.parameters.root !== lUncheckedParameters.shift()!) {
            throw new Error(`Root parameter does not match the expected value "${pCliCommand.information.command.parameters.root}".`);
        }

        // Construct cli parameter with the root parameter.
        const lCliParameter: CliParameter = new CliParameter(pCliCommand.information.command.parameters.root);

        // Read all required parameter. Required parameters musn't start with dashes.
        for (const lRequiredParameter of pCliCommand.information.command.parameters.required ?? []) {
            // Read next parameter.
            let lParameter: string | undefined = lUncheckedParameters.shift();
            if (!lParameter) {
                throw `Required parameter "${lRequiredParameter}" is missing`;
            }

            // Required parameters musn't start with dashes.
            if (lParameter.startsWith('-')) {
                throw `Unexpected parameter "${lParameter}". Required parameters musn't start with dashes`;
            }

            // Format parameter when it is set as string.
            if (lParameter.startsWith('"')) {
                lParameter = lParameter.substring(1, lParameter.length - 1);
            }

            // Set required parameter as value.
            lCliParameter.set(lRequiredParameter, lParameter);
        }

        // Convert all optional parameters to a map.
        const lOptionalParameters: Map<string, CliParameterOptionalParameter> = new Map<string, CliParameterOptionalParameter>();
        for (const [lOptionalParameterName, lOptionalParameter] of Object.entries(pCliCommand.information.command.parameters.optional ?? {})) {
            const lConfiguration: CliParameterOptionalParameter = {
                fullname: lOptionalParameterName,
                shortName: lOptionalParameter.shortName ?? null,
                default: lOptionalParameter.default ?? null
            };

            // Set long name with value.
            lOptionalParameters.set(`--${lOptionalParameterName}`, lConfiguration);

            // Set shortname with value.
            if (lOptionalParameter.shortName) {
                lOptionalParameters.set(`-${lOptionalParameter.shortName}`, lConfiguration);
            }
        }

        // Add global parameters pattern.
        for(const [lGlobalParameterName, lGlobalParameter] of CliParameter.mGlobalParameters.entries()) {
            lOptionalParameters.set(lGlobalParameterName, lGlobalParameter);
        }

        // Read all optional parameters. Optional parameters must start with dashes.
        // Convert and check all optional named parameters.
        while (lUncheckedParameters.length > 0) {
            // Read next parameter.
            const lParameter: string = lUncheckedParameters.shift()!;

            // Fail when parameter is a not a named parameter.
            if (!lParameter.startsWith('-')) {
                throw new Error(`Unexpected parameter "${lParameter}". Expected named parameter starting with "--" or "-".`);
            }

            // Get parameter name.
            const [lParameterName, lParameterValue] = lParameter.split('=');

            // Get parameter configuration by name.
            const lOptionalParameter: CliParameterOptionalParameter | undefined = lOptionalParameters.get(lParameterName);
            if (!lOptionalParameter) {
                throw new Error(`Unexpected parameter "${lParameter}". Parameter does not exist.`);
            }

            let lClearedParameterValue: string = lParameterValue;

            // Format parameter value when it is set as string.
            if (lClearedParameterValue && lClearedParameterValue.startsWith('"')) {
                lClearedParameterValue = lParameter.substring(1, lParameter.length - 1);
            }
            // Set optional named parameter.
            lCliParameter.set(lOptionalParameter.fullname, lClearedParameterValue);
        }

        // Fill in default values for optional parameters.
        for (const [lOptionalParameterName, lOptionalParameter] of Object.entries(pCliCommand.information.command.parameters.optional ?? {})) {
            if (!lOptionalParameter.default) {
                continue;
            }

            // Set default value when parameter is not set.
            if (!lCliParameter.has(lOptionalParameterName)) {
                lCliParameter.set(lOptionalParameterName, lOptionalParameter.default);
            }
        }

        return lCliParameter;
    }

    /**
     * Parses an array of command-line parameters and constructs a `CliParameter` object that only contains global parameters.
     * 
     * @param pParameter - An array of strings representing the command-line parameters.
     * 
     * @returns A `CliParameter` object constructed from the provided parameters.
     * 
     * @throws {Error} If no command parameter value was specified.
     */
    public static globals(pParameter: Array<string>): CliParameter {
        // At least one parameter (the root) is required.
        if (pParameter.length === 0) {
            throw new Error('No command parameter found');
        }

        // Create copy specified parameter.
        const lUncheckedParameters: Array<string> = [...pParameter];

        // Read root command.
        const lRootCommand: string = lUncheckedParameters.shift()!;

        // Construct cli parameter with the root parameter.
        const lCliParameter: CliParameter = new CliParameter(lRootCommand);

        // Read all optional parameters. Optional parameters must start with dashes.
        // Convert and check all optional named parameters.
        while (lUncheckedParameters.length > 0) {
            // Read next parameter.
            const lParameter: string = lUncheckedParameters.shift()!;

            // Continue when parameter is a not a named parameter.
            if (!lParameter.startsWith('-')) {
                continue;
            }

            // Get parameter name.
            const [lParameterName, lParameterValue] = lParameter.split('=');

            // Get parameter configuration by name.
            const lOptionalParameter: CliParameterOptionalParameter | undefined = CliParameter.mGlobalParameters.get(lParameterName);
            if (!lOptionalParameter) {
                continue;
            }

            let lClearedParameterValue: string = lParameterValue;

            // Format parameter value when it is set as string.
            if (lClearedParameterValue && lClearedParameterValue.startsWith('"')) {
                lClearedParameterValue = lParameter.substring(1, lParameter.length - 1);
            }
            // Set optional named parameter.
            lCliParameter.set(lOptionalParameter.fullname, lClearedParameterValue);
        }

        return lCliParameter;
    }

    private readonly mParameters: Map<string, string | null>;
    private readonly mRootParameter: string;

    /**
     * Root parameter name.
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
     * Delete parameter.
     * 
     * @param pParameterName - Parameter name.
     */
    public delete(pParameterName: string): void {
        this.mParameters.delete(pParameterName);
    }

    
    /**
     * Retrieves the value of a specified parameter.
     *
     * @param pParameterName - The name of the parameter to retrieve.
     * 
     * @returns The value of the specified parameter.
     * 
     * @throws {@link Error} 
     * Will throw an error if the parameter does not exist.
     * @throws {@link Error} 
     * Will throw an error if the parameter exists but does not have a value.
     */
    public get(pParameterName: string): string {
        // Check if parameter exists.
        if (!this.has(pParameterName)) {
            throw new Error(`Parameter "${pParameterName}" does not exist`);
        }

        // Get parameter value and check if it has a value.
        const lValue: string | null = this.mParameters.get(pParameterName)!;
        if (!lValue) {
            throw new Error(`Parameter "${pParameterName}" needs a value`);
        }

        return lValue;
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
     * Set parameter value.
     * Setting null value sets parameter to exist but have no value.
     * 
     * @param pParameterName - Parameter name.
     * @param pValue - Parameter value.
     */
    public set(pParameterName: string, pValue: string | null): void {
        this.mParameters.set(pParameterName, pValue);
    }
}

type CliParameterOptionalParameter = {
    fullname: string;
    shortName: string | null;
    default: string | null;
};