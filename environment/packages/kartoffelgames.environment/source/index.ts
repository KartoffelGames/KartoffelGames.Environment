import { Shell, ExecutionContext, Package } from '@kartoffelgames/environment.core';

// TODO: Deno-rework
(() => {
    // Find kg cli path. 
    const lKgCliPath: string = Package.resolve('@kartoffelgames/environment.cli/library/source/cli.js');

    // Get all command parameter and find index of starting kg parameter.
    const lCommandParameter: Array<string> = ExecutionContext.parameters;
    const lKgStartCommandIndex: number = lCommandParameter.findIndex((pParameter) => {
        return pParameter.endsWith('index.js');
    });

    // Array of only kg parameters.
    const lKgCommandParts: Array<string> = lCommandParameter.slice(lKgStartCommandIndex + 1);

    // Execute command in current working directory.
    new Shell().executeInConsole(`node ${[lKgCliPath, ...lKgCommandParts].join(' ')}`);
})();
