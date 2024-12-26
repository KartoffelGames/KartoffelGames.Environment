export class ProcessContext {
    /**
     * Command parameter of current execution.
     */
    public static get parameters(): Array<string> {
        return process.argv;
    }

    /**
     * Current working directory.
     */
    public static get workingDirectory(): string {
        return process.cwd();
    }
}