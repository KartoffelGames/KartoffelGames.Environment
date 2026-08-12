import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Scratchpad - Bundles and starts the server', async (): Promise<void> => {
        // Setup. The scratchpad server never exits on its own, so it is killed after a timeout.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg scratchpad', { '-p': '@test/package' }, { timeout: 8000 });

            // Evaluation.
            expect(lResult.timedOut).toBeTruthy();
            expect(lResult.output).toContain('Starting scratchpad server...');
        } finally {
            await lHelper.dispose();
        }
    });
});
