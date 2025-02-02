import { Project } from '../project/project.ts';
import { CliPackageInformation, CliPackages } from './cli-packages.ts';
import { CliParameter } from './cli-parameter.ts';
import { ICliCommand } from './i-cli-command.interface.ts';

/**
 * Command line interface command that can be executed.
 * Converts and validates environment split commands into a easy to use command pattern.
 */
export class CliCommand {
    private readonly mCliPackages: CliPackages;
    private readonly mName: string;
    private readonly mParameters: Array<string>;

    /**
     * Cli packages.
     */
    public get cliPackages(): CliPackages {
        return this.mCliPackages;
    }

    /**
     * Parameters of command.
     */
    public get parameters(): Array<string> {
        return this.mParameters;
    }

    /**
     * Constructor.
     * 
     * @param pCommandName - Command name.
     * @param pParameter - Command parameter.
     * @param pCliPackages - Cli packages.
     */
    public constructor(pCommandName: string, pParameter: Array<string>, pCliPackages: CliPackages) {
        this.mName = pCommandName;
        this.mParameters = pParameter;
        this.mCliPackages = pCliPackages;
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     */
    public async execute(pProject: Project): Promise<void> {
        // Find command configuration by name.
        const lCliPackageConfigurations: Map<string, CliPackageInformation> = await this.mCliPackages.getCommandPackages(this.mName);

        // Find command.
        const lCliPackageConfiguration: CliPackageInformation | undefined = lCliPackageConfigurations.get(this.mName);
        if (!lCliPackageConfiguration) {
            throw 'Command not found';
        }

        // Check if cli package has an available command entry.
        if (!lCliPackageConfiguration.configuration.commandEntryClass) {
            throw `CLI package "${lCliPackageConfiguration.configuration.name}" has no entry class`;
        }

        // Create command constructor.
        const lCommand: ICliCommand = await this.mCliPackages.createPackageCommandInstance(lCliPackageConfiguration);

        // Validate command pattern for cli package configuration.
        const lCommandParameter: CliParameter = this.convertCommandParameter(lCommand, this.mParameters);

        // Build project handler.
        await lCommand.run(lCommandParameter, pProject);
    }

    /**
     * Find command by parameter.
     * @param pParameter - Command parameter.
     */
    private convertCommandParameter(pCliCommand: ICliCommand, pParameter: Array<string>): CliParameter {
        // All required parameter.
        const lRequiredParameterPatternList: Array<string> = new Array<string>();

        // Add command name to required parameter list.
        lRequiredParameterPatternList.push(pCliCommand.information.command.name);

        // Read all required parameter names starting with < or any letter from command pattern.
        for (const lCommandPatternPart of pCliCommand.information.command.parameters) {
            if (lCommandPatternPart.startsWith('<') || lCommandPatternPart.match(/^[a-zA-Z0-9]/)) {
                lRequiredParameterPatternList.push(lCommandPatternPart.toLowerCase());
            }
        }

        // Read all optional parameter names starting with -- from command pattern.
        const lOptionalParameterPatternList: Array<string> = new Array<string>();
        for (const lCommandPatternPart of pCliCommand.information.command.parameters) {
            if (lCommandPatternPart.startsWith('[')) {
                lOptionalParameterPatternList.push(lCommandPatternPart.substring(1, lCommandPatternPart.length - 1).toLowerCase());
            }
        }

        // Read all optional parameter names starting with -- from command pattern.
        const lFlagParameterPatternList: Set<string> = new Set<string>();
        for (const lCommandPatternPart of pCliCommand.information.command.flags) {
            lFlagParameterPatternList.add(lCommandPatternPart);
        }

        // Create cli parameter and copy specified parameter.
        const lCliParameter: CliParameter = new CliParameter();
        const lUncheckedParameters: Array<string> = [...pParameter];

        // Convert and check all required parameters.
        for (const lRequiredParameter of lRequiredParameterPatternList) {
            // Read next parameter.
            let lParameter: string | undefined = lUncheckedParameters.shift();
            if (!lParameter) {
                throw `Required parameter "${lRequiredParameter}" is missing`;
            }

            // Format parameter when it is set as string.
            if (lParameter.startsWith('"')) {
                lParameter = lParameter.substring(1, lParameter.length - 1);
            }

            // Set required named parameter.
            if (lRequiredParameter.startsWith('<')) {
                const lParameterName: string = lRequiredParameter.substring(1, lRequiredParameter.length - 1);
                lCliParameter.parameter.set(lParameterName, lParameter);
                continue;
            }

            // Check required static parameter.
            if (lRequiredParameter === lParameter.toLowerCase()) {
                continue;
            }

            throw `Required parameter "${lRequiredParameter}" is missing`;
        }

        // Convert and check all optional unnamed parameters.
        for (const lOptionalUnnamedParameterName of lOptionalParameterPatternList) {
            // Read next parameter. Needn't to be existent.
            let lParameter: string | undefined = lUncheckedParameters.at(0);
            if (!lParameter) {
                break;
            }

            // Skip when parameter is a named parameter.
            if (lParameter.startsWith('--')) {
                break;
            }

            // Parameter is used, so we can remove it.
            lUncheckedParameters.shift();

            // Format parameter when it is set as string.
            if (lParameter.startsWith('"')) {
                lParameter = lParameter.substring(1, lParameter.length - 1);
            }

            // Set optional unnamed parameter.
            lCliParameter.parameter.set(lOptionalUnnamedParameterName, lParameter);
        }

        // Convert and check all optional named parameters.
        while (lUncheckedParameters.length > 0) {
            // Read next parameter.
            const lParameter: string = lUncheckedParameters.shift()!;

            // Fail when parameter is a not a named parameter.
            if (!lParameter.startsWith('--')) {
                throw new Error(`Unexpected parameter "${lParameter}". Expected named parameter starting with "--"`);
            }

            // Get parameter name.
            const lParameterName: string = lParameter.substring(2).toLowerCase();

            // Validate of named parameter exists.
            if (!lFlagParameterPatternList.has(lParameterName)) {
                throw new Error(`Unexpected parameter "${lParameter}". Named parameter does not exist`);
            }

            // Set optional named parameter.
            lCliParameter.flags.add(lParameterName);
        }

        return lCliParameter;
    }
}