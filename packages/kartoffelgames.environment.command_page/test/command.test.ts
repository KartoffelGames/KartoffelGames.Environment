import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Page - Bundles the page and starts the server', async (): Promise<void> => {
        // Setup. Configure the page port and a "page" entry, plus a "bundle" entry (e.g. a worker).
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'page/source/index.ts', 'console.log(\'page\');\n');
        lHelper.writePackageFile('@test/package', 'page/source/worker.ts', 'console.log(\'worker\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    page: { port: 8091, mimeTypeMapping: {} },
                    build: {
                        files: {
                            './page/source/index.ts': { type: 'page', output: './page/bundle/app.js' },
                            './page/source/worker.ts': { type: 'bundle', output: './page/bundle/worker.js' }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process. The page server never exits on its own, so it is killed after a timeout. The initial bundle
            // always completes before the server line is printed.
            const lResult: CommandTestHelperResult = await lHelper.run('kg page', { '-p': '@test/package' }, { timeout: 8000 });

            // Evaluation. The server started.
            expect(lResult.timedOut).toBeTruthy();
            expect(lResult.output).toContain('Starting page server...');

            // Both entries were bundled into the page bundle directory.
            expect(lHelper.fileExists('packages/test.package/page/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/worker.js')).toBeTruthy();

            // The live-reload client is injected only into the "page" entry.
            expect(lHelper.readFile('packages/test.package/page/bundle/app.js')).toContain('WebSocket');
            expect(lHelper.readFile('packages/test.package/page/bundle/worker.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });
});
