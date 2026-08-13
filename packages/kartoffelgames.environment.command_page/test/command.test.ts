import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Page - Builds the page bundle and starts the server', async (): Promise<void> => {
        // Setup. Configure a page build entry and an extra bundle entry to verify only the page type is built.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    page: { port: 8091, mimeTypeMapping: {} },
                    build: {
                        './source/index.ts': { type: 'bundle', name: 'PageLib' },
                        './page/source/index.ts': { type: 'page', name: 'page' }
                    }
                }
            }
        }, null, 4));
        try {
            // Process. The page server never exits on its own, so it is killed after a timeout. The initial build
            // always completes before the server line is printed.
            const lResult: CommandTestHelperResult = await lHelper.run('kg page', { '-p': '@test/package' }, { timeout: 8000 });

            // Evaluation. The server started.
            expect(lResult.timedOut).toBeTruthy();
            expect(lResult.output).toContain('Starting page server...');

            // The page bundle was built with the live-reload client injected.
            expect(lHelper.fileExists('packages/test.package/page/build/page.js')).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/page/build/page.js')).toContain('WebSocket');

            // Only the page-type entry was built, the bundle entry was left untouched.
            expect(lHelper.fileExists('packages/test.package/library/bundle/PageLib.js')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });
});
