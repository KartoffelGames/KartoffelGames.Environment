import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Bundle - Force bundles default entry file', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bundle', { '-p': '@test/package', '--force': '' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Bundle successful');
            expect(lHelper.fileExists('packages/test.package/library')).toBeTruthy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Bundle - Skips when disabled and not forced', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bundle', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Bundling disabled, Skip bundling.');
        } finally {
            await lHelper.dispose();
        }
    });
});
