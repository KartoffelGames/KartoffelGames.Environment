/**
 * Process parameter for starting a new process.
 */
export class ProcessParameter {
    private readonly mCommandList: Array<string>;
    private readonly mWorkingDirectory: string;
    
    /**
     * Get command list.
     */
    public get commandList(): Array<string> {
        return this.mCommandList;
    }

    /**
     * Get working directory.
     */
    public get workingDirectory(): string {
        return this.mWorkingDirectory;
    }

    /**
     * Constructor.
     * 
     * @param pWorkingDirectory - Working directory.
     * @param pCommands - Command list.
     */
    public constructor(pWorkingDirectory: string, pCommands: Array<string>) {
        this.mWorkingDirectory = pWorkingDirectory;
        this.mCommandList = pCommands;
    }
}