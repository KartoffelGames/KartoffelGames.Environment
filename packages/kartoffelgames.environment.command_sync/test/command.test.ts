import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Sync - Package version matches project version', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('2.0.0');
        await lHelper.addPackage('@test/package', '0.0.0');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg sync', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.packageConfiguration('@test/package').version).toBe('2.0.0');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Sync - Fills command configuration defaults', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('2.0.0');
        await lHelper.addPackage('@test/package', '0.0.0');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg sync', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.packageConfiguration('@test/package').kg.config['test']).toEqual({ directory: './test' });
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Error: No package specified', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('2.0.0');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg sync');

            // Evaluation.
            expect(lResult.success).toBeFalsy();
            expect(lResult.output).toContain('Package to sync not specified.');
        } finally {
            await lHelper.dispose();
        }
    });
});
