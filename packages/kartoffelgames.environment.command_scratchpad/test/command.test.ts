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

    await pContext.step('Scratchpad - Uses the configured directory', async (): Promise<void> => {
        // Setup. Configure a non-default scratchpad directory.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    scratchpad: { directory: './customscratch', port: 8093, mimeTypeMapping: {}, build: false }
                }
            }
        }, null, 4));
        try {
            // Process. The server never exits on its own, so it is killed after a timeout.
            const lResult: CommandTestHelperResult = await lHelper.run('kg scratchpad', { '-p': '@test/package' }, { timeout: 8000 });

            // Evaluation. The starter files were scaffolded into the configured directory instead of the default "scratchpad".
            expect(lResult.timedOut).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/customscratch/index.html')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/customscratch/source/index.ts')).toBeTruthy();
        } finally {
            await lHelper.dispose();
        }
    });
});
