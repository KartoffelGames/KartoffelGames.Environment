import { Package } from "../project/package.ts";
import { Project } from '../project/project.ts';
import { CliPackageInformation, CliPackages } from './cli-packages.ts';
import { CliParameter } from './cli-parameter.ts';
import { ICliCommand } from './i-cli-command.interface.ts';

/**
 * Command line interface command that can be executed.
 * Converts and validates environment split commands into a easy to use command pattern.
 */
export class CliCommand {
    private readonly mProject: Project;
    private readonly mName: string;
    private readonly mParameters: Array<string>;

    /**
     * Cli packages.
     */
    public get project(): Project {
        return this.mProject;
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
    public constructor(pProject: Project, pCommandName: string, pParameter: Array<string>,) {
        this.mName = pCommandName;
        this.mParameters = pParameter;
        this.mProject = pProject;
    }

    /**
     * Execute command.
     * @param pParameter - Command parameter.
     * @param pPackage -  Package the command should be applied to. // TODO: Run should support the package parameter.
     * 
     */
    public async execute(pPackage: Package | null): Promise<void> {
        // Find command configuration by name.
        const lCliPackageConfigurations: Map<string, CliPackageInformation> = await this.mProject.cliPackages.getCommandPackages(this.mName);

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
        const lCommand: ICliCommand = await this.mProject.cliPackages.createPackageCommandInstance(lCliPackageConfiguration);

        // Validate command pattern for cli package configuration.
        const lCommandParameter: CliParameter = this.convertCommandParameter(lCommand, this.mParameters);

        // Build project handler.
        await lCommand.run(this.mProject, pPackage, lCommandParameter);
    }

    /**
     * Find command by parameter.
     * @param pParameter - Command parameter.
     */
    private convertCommandParameter(pCliCommand: ICliCommand, pParameter: Array<string>): CliParameter {
        // At least one parameter (the root) is required.
        if (pParameter.length === 0) {
            throw new Error('No command parameter found');
        }

        // Create copy specified parameter.
        const lUncheckedParameters: Array<string> = [...pParameter];

        // Read the root parameter from parameter list.
        const lRootParameter: string = lUncheckedParameters.shift()!;
        if (lRootParameter !== pCliCommand.information.command.parameters.root) {
            throw new Error(`Unexpected parameter "${lRootParameter}". Expected root parameter "${pCliCommand.information.command.parameters.root}"`);
        }

        // Construct cli parameter with the root parameter.
        const lCliParameter: CliParameter = new CliParameter(lRootParameter);

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
        const lOptionalParameters: Map<string, CliCommandOptionalParameter> = new Map<string, CliCommandOptionalParameter>();
        for (const [lOptionalParameterName, lOptionalParameter] of Object.entries(pCliCommand.information.command.parameters.optional ?? {})) {
            const lConfiguration: CliCommandOptionalParameter = {
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
            let [lParameterName, lParameterValue] = lParameter.split('=');

            // Get parameter configuration by name.
            const lOptionalParameter: CliCommandOptionalParameter | undefined = lOptionalParameters.get(lParameterName);
            if (!lOptionalParameter) {
                throw new Error(`Unexpected parameter "${lParameter}". Parameter does not exist.`);
            }

            // Format parameter value when it is set as string.
            if (lParameterValue.startsWith('"')) {
                lParameterValue = lParameter.substring(1, lParameter.length - 1);
            }
            // Set optional named parameter.
            lCliParameter.set(lOptionalParameter.fullname, lParameterValue);
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
}

type CliCommandOptionalParameter = {
    fullname: string;
    shortName: string | null;
    default: string | null;
};