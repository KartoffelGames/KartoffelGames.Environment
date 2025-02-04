import { ProcessParameter } from "./process-parameter.ts";

/**
 * Process execution.
 * Function to execute commands in a new process and return result.
 */
export class Process {
    /**
     * Constructor.
     */
    public constructor() { }

    /**
     * Call command and return result.
     * 
     * @param pCommand - Command.
     * @param pIgnoreError - Ignore error.
     */
    public async execute(pCommand: ProcessParameter, pIgnoreError: boolean = false): Promise<string> {
        // Construct command.
        const lCommand: Deno.Command = new Deno.Command(pCommand.commandList[0], {
            cwd: pCommand.workingDirectory,
            stderr: 'piped',
            stdout: 'piped',
            stdin: 'piped',
            args: pCommand.commandList.slice(1)
        });

        // Start process.
        const lChildProcess: Deno.ChildProcess = lCommand.spawn();

        // Wait for process to finish.
        const lProcessOutput: Deno.CommandOutput = await lChildProcess.output();
        const lProcessStatus: Deno.CommandStatus = await lChildProcess.status;

        // Decode for text output.
        const lTextDecoder = new TextDecoder();

        // Throw when childprocess has an error.
        if (!lProcessStatus.success && !pIgnoreError) {
            throw new Error(lTextDecoder.decode(lProcessOutput.stderr));
        }

        // Return output.
        return lTextDecoder.decode(lProcessOutput.stdout);
    }

    /**
     * Execute command and output result and errors into console.
     * 
     * @param pCommand - Command.
     */
    public async executeInConsole(pCommand: ProcessParameter): Promise<void> {
        // Construct command.
        const lCommand: Deno.Command = new Deno.Command(pCommand.commandList[0], {
            cwd: pCommand.workingDirectory,
            stderr: 'inherit',
            stdout: 'inherit',
            stdin: 'inherit',
            args: pCommand.commandList.slice(1)
        });

        // Start process.
        const lChildProcess: Deno.ChildProcess = lCommand.spawn();

        // Wait for process to finish.
        const lProcessStatus: Deno.CommandStatus = await lChildProcess.status;

        // Throw when childprocess has an error.
        if (!lProcessStatus.success) {
            throw new Error();
        }
    }
}