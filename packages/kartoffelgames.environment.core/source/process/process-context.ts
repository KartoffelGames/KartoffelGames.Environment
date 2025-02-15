export class ProcessContext {
    /**
     * Command parameter of current execution.
     */
    public static get parameters(): Array<string> {
        return Deno.args;
    }

    /**
     * Current working directory.
     */
    public static get workingDirectory(): string {
        return Deno.cwd();
    }
}