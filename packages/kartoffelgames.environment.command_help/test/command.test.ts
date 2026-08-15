import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Help - Lists available commands', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg help');

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Available commands:');
            expect(lResult.output).toContain('bump');
        } finally {
            await lHelper.dispose();
        }
    });
});
