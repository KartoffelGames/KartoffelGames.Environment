#! /usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';

(() => {
    // Find kg cli path.
    const lKgCliPath: string = require.resolve('@kartoffelgames/environment.cli/library/source/cli.js');

    // Get all command parameter and find index of starting kg parameter.
    const lCommandParameter: Array<string> = process.argv;
    const lKgStartCommandIndex: number = lCommandParameter.findIndex((pParameter) => {
        return pParameter.endsWith('index.js');
    });

    // Array of only kg parameters.
    const lKgCommandParts: Array<string> = lCommandParameter.slice(lKgStartCommandIndex + 1);

    // Add this package as command root.
    const lPackageContainerPath: string = path.resolve(__dirname, '..', '..');
    lKgCommandParts.push('--command-root-package', `"${lPackageContainerPath}"`);

    // Execute command.
    spawn('node', [lKgCliPath, ...lKgCommandParts], { stdio: 'inherit' });
})();
