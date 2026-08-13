import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Build - Bundles configured files into the app bundle directory', async (): Promise<void> => {
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
                    build: { files: { './source/index.ts': { name: 'MyBundle' } } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/app/bundle/MyBundle.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/app/bundle/MyBundle.js.map')).toBeTruthy();
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

    await pContext.step('Build - Inject-reload injects the client only into reloadable entries', async (): Promise<void> => {
        // Setup. One reloadable entry and one non-reloadable entry (e.g. a worker).
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
                            './source/index.ts': { name: 'main', reloadable: true },
                            './source/worker.ts': { name: 'worker' }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--injectreload': '' });

            // Evaluation. Only the reloadable entry receives the live-reload client.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/app/bundle/main.js')).toContain('WebSocket');
            expect(lHelper.readFile('packages/test.package/app/bundle/worker.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Skips the desktop step in bundle-only mode', async (): Promise<void> => {
        // Setup. Configure a desktop output for the current platform, but run bundle-only.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'app/source/index.ts', 'console.log(\'app\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        files: { './app/source/index.ts': { name: 'app' } },
                        desktop: { name: 'My App', identifier: 'com.example.myapp', output: { windows: './dist/MyApp', macos: './dist/MyApp.app', linux: './dist/my-app' } }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--bundle-only': '' });

            // Evaluation. The bundle is produced but no desktop output directory is created.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/app/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/dist')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Reload client is not injected without the flag', async (): Promise<void> => {
        // Setup. A reloadable entry, but the build runs without the inject-reload flag.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { files: { './source/index.ts': { name: 'main', reloadable: true } } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.readFile('packages/test.package/app/bundle/main.js')).not.toContain('WebSocket');
        } finally {
            await lHelper.dispose();
        }
    });
});

// Actually compiles a desktop binary via `deno desktop`. This is slow (a real compile, and downloads the platform
// backend on first use), so it is disabled unless KG_TEST_DESKTOP=1 is set. Requires Deno >= 2.9.
Deno.test({
    name: 'KgCliCommand.run() - desktop build',
    ignore: Deno.env.get('KG_TEST_DESKTOP') !== '1',
    fn: async (): Promise<void> => {
        // The expected output path for the current platform.
        const lExpectedOutput: string = (() => {
            switch (Deno.build.os) {
                case 'windows': return 'packages/test.package/dist/MyApp';
                case 'darwin': return 'packages/test.package/dist/MyApp.app';
                default: return 'packages/test.package/dist/my-app';
            }
        })();

        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'app/index.html', '<html><body><script src="/bundle/app.js"></script></body></html>\n');
        lHelper.writePackageFile('@test/package', 'app/source/index.ts', 'console.log(\'app\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        files: { './app/source/index.ts': { name: 'app', reloadable: true } },
                        desktop: { name: 'My App', identifier: 'com.example.myapp', output: { windows: './dist/MyApp', macos: './dist/MyApp.app', linux: './dist/my-app' } }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package' });

            // Evaluation. The bundle is produced and the desktop app for the current platform exists.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/app/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists(lExpectedOutput)).toBeTruthy();
        } finally {
            await lHelper.dispose();
        }
    }
});
