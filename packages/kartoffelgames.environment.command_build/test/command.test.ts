import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Build - Bundle type produces a library artifact', async (): Promise<void> => {
        // Setup. Configure a single bundle build entry.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { './source/index.ts': { type: 'bundle', name: 'MyBundle' } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/library/bundle/MyBundle.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/library/bundle/MyBundle.js.map')).toBeTruthy();
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

    await pContext.step('Error: Unknown build type', async (): Promise<void> => {
        // Setup. Configure an unsupported build type.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { './source/index.ts': { type: 'desktop', name: 'MyApp' } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeFalsy();
            expect(lResult.output).toContain('Unknown build type "desktop"');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Page type writes the bundle into the page build directory', async (): Promise<void> => {
        // Setup. Configure a single page build entry.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'page/source/index.ts', 'console.log(\'page\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { './page/source/index.ts': { type: 'page', name: 'page' } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/build/page.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/build/page.js.map')).toBeTruthy();

            // Without the debug flag the live-reload client is not injected.
            expect(lHelper.readFile('packages/test.package/page/build/page.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Inject-reload flag injects the live reload client into any build type', async (): Promise<void> => {
        // Setup. Configure a single bundle build entry to show inject-reload is not page-specific.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { './source/index.ts': { type: 'bundle', name: 'MyBundle' } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--injectreload': '' });

            // Evaluation. The live-reload client is injected into the bundle-type output as well.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/library/bundle/MyBundle.js')).toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Type filter builds only matching entries', async (): Promise<void> => {
        // Setup. Configure both a bundle and a page build entry.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'page/source/index.ts', 'console.log(\'page\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        './source/index.ts': { type: 'bundle', name: 'MyBundle' },
                        './page/source/index.ts': { type: 'page', name: 'page' }
                    }
                }
            }
        }, null, 4));
        try {
            // Process. Restrict the build to the page type.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--type': 'page' });

            // Evaluation. Only the page entry is built, the bundle entry is skipped.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/build/page.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/library/bundle/MyBundle.js')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });
});
