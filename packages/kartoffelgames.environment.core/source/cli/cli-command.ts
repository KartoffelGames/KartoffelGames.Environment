import { Package } from '../project/package.ts';
import { Project } from '../project/project.ts';
import { CliParameter } from './cli-parameter.ts';
import { ICliPackageCommand } from './i-cli-package-command.interface.ts';

/**
 * Command line interface command that can be executed.
 * Converts and validates environment split commands into a easy to use command pattern.
 */
export class CliCommand {
    private readonly mProject: Project;
    private readonly mCliPackageCommand: ICliPackageCommand;

    /**
     * Cli packages.
     */
    public get project(): Project {
        return this.mProject;
    }

    /**
     * Gets the CLI package command.
     */
    public get cliPackageCommand(): ICliPackageCommand {
        return this.mCliPackageCommand; 
    }

    /**
     * Constructor.
     * 
     * @param pCommandName - Command name.
     * @param pParameter - Command parameter.
     * @param pCliPackages - Cli packages.
     */
    public constructor(pProject: Project, pCliPackageCommand: ICliPackageCommand) {
        this.mCliPackageCommand = pCliPackageCommand;
        this.mProject = pProject;
    }

    /**
     * Execute command.
     * @param pParameterInput - Command parameter.
     * @param pPackage -  Package the command should be applied to.
     * 
     */
    public async execute(pPackage: Package | null, pParameterInput: Array<string>): Promise<void> {
        // Validate command pattern for cli package configuration.
        const lCommandParameter: CliParameter = CliParameter.forCommand(this.mCliPackageCommand, pParameterInput);

        // Build project handler.
        await this.mCliPackageCommand.run(this.mProject, pPackage, lCommandParameter);
    }
}
