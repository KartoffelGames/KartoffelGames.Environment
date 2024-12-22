import { exec, execSync } from 'child_process';
import { ProcessParameter } from './process-parameter';

/**
 * Process execution.
 * Function to execute commands in a new process and return result.
 */
export class Process {
    /**
     * Constructor.
     */
    public constructor() {}

    /**
     * Call command and return result.
     * 
     * @param pCommand - Command.
     */
    public async execute(pCommand: ProcessParameter, pIgnoreError: boolean = false): Promise<string> {
        return new Promise<string>((pResolve, pReject) => {
            // Call command.
            exec(pCommand.commandList.join(' '), { cwd: pCommand.workingDirectory }, (pError, pStdout) => {
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
     * 
     * @param pCommand - Command.
     */
    public async executeInConsole(pCommand: ProcessParameter): Promise<void> {
        execSync(pCommand.commandList.join(' '), { stdio: [0, 1, 2], cwd: pCommand.workingDirectory });
    }
}