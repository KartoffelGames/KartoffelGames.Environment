import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Create - Lists available blueprints', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg create', { '--list': '' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Available blueprints:');
            expect(lResult.output).toContain('kg-main');
        } finally {
            await lHelper.dispose();
        }
    });
});
