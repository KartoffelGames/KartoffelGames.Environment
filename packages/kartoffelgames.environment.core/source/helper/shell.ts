import { spawn, exec, execSync } from 'child_process';
import { Console } from './console';

export class Shell {
    private readonly mWorkingDirectory: string;

    /**
     * Constructor.
     * @param pWorkingDirectory - Shell working directory.
     */
    public constructor(pWorkingDirectory: string) {
        this.mWorkingDirectory = pWorkingDirectory;
    }

    /**
     * Execute command and output result and errors into console.
     * @param pCommand - Command.
     */
    public async console(pCommand: string): Promise<void> {
        execSync(pCommand, { stdio: [0, 1, 2], cwd: this.mWorkingDirectory });
    }

    /**
     * Call command and return result.
     * @param pCommand - Command.
     */
    public async result(pCommand: string, pIgnoreError: boolean = false): Promise<string> {
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
}