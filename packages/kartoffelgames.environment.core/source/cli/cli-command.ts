import type { Package } from '../project/package.ts';
import type { Project } from '../project/project.ts';
import { CliParameter } from './cli-parameter.ts';
import type { ICliPackageCommand } from './i-cli-package-command.interface.ts';

/**
 * Executable command line interface command.
 * Validates and wraps environment split commands into an easy-to-use pattern.
 */
export class CliCommand {
    private readonly mCliPackageCommand: ICliPackageCommand;
    private readonly mProject: Project;
    
    /**
     * Gets the CLI package command.
     */
    public get cliPackageCommand(): ICliPackageCommand {
        return this.mCliPackageCommand; 
    }

    /**
     * Project the command runs against.
     */
    public get project(): Project {
        return this.mProject;
    }

    /**
     * Constructor.
     *
     * @param pProject - Project the command runs against.
     * @param pCliPackageCommand - CLI package command.
     */
    public constructor(pProject: Project, pCliPackageCommand: ICliPackageCommand) {
        this.mCliPackageCommand = pCliPackageCommand;
        this.mProject = pProject;
    }

    /**
     * Execute command.
     *
     * @param pPackage - Package the command is applied to.
     * @param pParameterInput - Command parameter.
     */
    public async execute(pPackage: Package | null, pParameterInput: Array<string>): Promise<void> {
        // Validate command pattern for cli package configuration.
        const lCommandParameter: CliParameter = CliParameter.forCommand(this.mCliPackageCommand, pParameterInput);

        // Build project handler.
        await this.mCliPackageCommand.run(this.mProject, pPackage, lCommandParameter);
    }
}
