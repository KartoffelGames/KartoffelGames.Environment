import { exec, execSync } from 'child_process';

/**
 * Shell execution.
 * Function to execute shell commands and return result.
 */
export class Shell {
    private readonly mWorkingDirectory: string;

    /**
     * Current working directory.
     */
    public get workingDirectory(): string {
        return this.mWorkingDirectory;
    }

    /**
     * Constructor.
     * Inherits current working directory when no working directory is provided.
     * 
     * @param pWorkingDirectory - Shell working directory.
     */
    public constructor(pWorkingDirectory?: string) {
        this.mWorkingDirectory = pWorkingDirectory ?? process.cwd();
    }

    /**
     * Call command and return result.
     * @param pCommand - Command.
     */
    public async execute(pCommand: string, pIgnoreError: boolean = false): Promise<string> {
        return new Promise<string>((pResolve, pReject) => {
            // Call command.
            exec(pCommand, { cwd: this.mWorkingDirectory }, (pError, pStdout) => {
                if (pError && !pIgnoreError) {
                    pReject(pError);
                } else {
                    pResolve(pStdout);
                }
            });
        });
    }

    /**
     * Execute command and output result and errors into console.
     * @param pCommand - Command.
     */
    public async executeInConsole(pCommand: string): Promise<void> {
        execSync(pCommand, { stdio: [0, 1, 2], cwd: this.mWorkingDirectory });
    }
}