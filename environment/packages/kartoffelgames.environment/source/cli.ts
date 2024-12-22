import { Process, Package, ProcessParameter, ProcessContext } from '@kartoffelgames/environment.core';

// TODO: Deno-rework
(() => {
    // Find kg cli path. 
    const lKgCliPath: string = Package.resolveToPath('@kartoffelgames/environment.cli/library/source/cli.js');

    // Get all command parameter and find index of starting kg parameter.
    const lCommandParameter: Array<string> = ProcessContext.parameters;
    const lKgStartCommandIndex: number = lCommandParameter.findIndex((pParameter) => {
        return pParameter.endsWith('index.js');
    });

    // Array of only kg parameters.
    const lKgCommandParts: Array<string> = lCommandParameter.slice(lKgStartCommandIndex + 1);

    // Create process parameter.
    const lProcessParameter: ProcessParameter = new ProcessParameter(ProcessContext.workingDirectory, ['node', lKgCliPath, ...lKgCommandParts]);

    // Execute command in current working directory.
    new Process().executeInConsole(lProcessParameter);
})();
