import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('App - Bundles the app and starts the server', async (): Promise<void> => {
        // Setup. Configure the app port and a reloadable bundle entry, plus a non-reloadable one.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'app/source/index.ts', 'console.log(\'app\');\n');
        lHelper.writePackageFile('@test/package', 'app/source/worker.ts', 'console.log(\'worker\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    app: { port: 8091, mimeTypeMapping: {} },
                    build: {
                        files: {
                            './app/source/index.ts': { name: 'app', reloadable: true },
                            './app/source/worker.ts': { name: 'worker' }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process. The app server never exits on its own, so it is killed after a timeout. The initial bundle
            // always completes before the server line is printed.
            const lResult: CommandTestHelperResult = await lHelper.run('kg app', { '-p': '@test/package' }, { timeout: 8000 });

            // Evaluation. The server started.
            expect(lResult.timedOut).toBeTruthy();
            expect(lResult.output).toContain('Starting app server...');

            // Both entries were bundled into the app bundle directory.
            expect(lHelper.fileExists('packages/test.package/app/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/app/bundle/worker.js')).toBeTruthy();

            // The live-reload client is injected only into the reloadable entry.
            expect(lHelper.readFile('packages/test.package/app/bundle/app.js')).toContain('WebSocket');
            expect(lHelper.readFile('packages/test.package/app/bundle/worker.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });
});
