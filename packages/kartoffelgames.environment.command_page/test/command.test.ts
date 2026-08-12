import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Page - Build only forces a build without serving', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg page', { '-p': '@test/package', '--force': '', '--build-only': '' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Build finished');
            expect(lHelper.fileExists('packages/test.package/page/build/page.js')).toBeTruthy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Page - Skips when disabled and not forced', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg page', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Disabled page build. Skip page...');
        } finally {
            await lHelper.dispose();
        }
    });
});
