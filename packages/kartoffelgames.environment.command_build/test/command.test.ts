import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Build - Bundles configured files into the page bundle directory', async (): Promise<void> => {
        // Setup. Configure a single bundle file.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { files: { './source/index.ts': { name: 'MyBundle', type: 'bundle', output: './page/bundle/MyBundle.js' } } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/MyBundle.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/MyBundle.js.map')).toBeTruthy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Skips when nothing is configured', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('Nothing configured to build. Skip build.');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Inject-reload injects the client only into page entries', async (): Promise<void> => {
        // Setup. One "page" entry and one "bundle" entry (e.g. a worker).
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'source/worker.ts', 'console.log(\'worker\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        files: {
                            './source/index.ts': { name: 'main', type: 'page', output: './page/bundle/main.js' },
                            './source/worker.ts': { name: 'worker', type: 'bundle', output: './page/bundle/worker.js' }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--injectreload': '' });

            // Evaluation. Only the "page" entry receives the live-reload client.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/page/bundle/main.js')).toContain('WebSocket');
            expect(lHelper.readFile('packages/test.package/page/bundle/worker.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Skips the desktop step in bundle-only mode', async (): Promise<void> => {
        // Setup. Configure a desktop output for the current platform, but run bundle-only.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'page/source/index.ts', 'console.log(\'app\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        files: { './page/source/index.ts': { name: 'app', type: 'page', output: './page/bundle/app.js' } },
                        desktop: { name: 'My App', identifier: 'com.example.myapp', output: { windows: './dist/MyApp', macosArm: './dist/MyApp.app', macosIntel: './dist/MyApp-intel.app', linux: './dist/my-app' } }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--bundle-only': '' });

            // Evaluation. The bundle is produced but no desktop output directory is created.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/dist')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Reload client is not injected without the flag', async (): Promise<void> => {
        // Setup. A "page" entry, but the build runs without the inject-reload flag.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { files: { './source/index.ts': { name: 'main', type: 'page', output: './page/bundle/main.js' } } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/page/bundle/main.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });
});
