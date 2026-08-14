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
                    build: { files: { './source/index.ts': { type: 'bundle', output: './page/bundle/MyBundle.js' } } }
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
                            './source/index.ts': { type: 'page', output: './page/bundle/main.js' },
                            './source/worker.ts': { type: 'bundle', output: './page/bundle/worker.js' }
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

    await pContext.step('Build - A --types filter excludes the desktop entry', async (): Promise<void> => {
        // Setup. A "page" entry and a "desktop" entry, but restrict the build to the "page" and "bundle" types.
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
                        files: {
                            './page/source/index.ts': { type: 'page', output: './page/bundle/app.js' },
                            './desktop/main.ts': { type: 'desktop', name: 'My App', identifier: 'com.example.myapp', output: { windows: './dist/MyApp', macosArm: './dist/MyApp.app', macosIntel: './dist/MyApp-intel.app', linux: './dist/my-app' } }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--types': 'page,bundle' });

            // Evaluation. The page bundle is produced but the desktop entry is not built.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/app.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/dist')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - A desktop entry without output is skipped', async (): Promise<void> => {
        // Setup. A single "desktop" entry with no configured output. "desktop" is now a selectable build type.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'desktop/main.ts', 'console.log(\'desktop\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { files: { './desktop/main.ts': { type: 'desktop', name: 'My App', identifier: 'com.example.myapp' } } }
                }
            }
        }, null, 4));
        try {
            // Process. Requesting the "desktop" type proves it is a valid build type.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--types': 'desktop' });

            // Evaluation. The build succeeds and reports the desktop entry was skipped for lack of output.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('No desktop output configured. Skip desktop.');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - A desktop entry with a missing include directory fails', async (): Promise<void> => {
        // Setup. A "desktop" entry whose include points at a directory that does not exist.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'desktop/main.ts', 'console.log(\'desktop\');\n');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: {
                        files: {
                            './desktop/main.ts': {
                                type: 'desktop',
                                name: 'My App',
                                identifier: 'com.example.myapp',
                                include: [{ directory: './does-not-exist', filter: ['**/*'] }]
                            }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--types': 'desktop' });

            // Evaluation. The command fails up-front on the missing include directory (before any build).
            expect(lResult.success).toBeFalsy();
            expect(lResult.output).toContain('Desktop include directory');
            expect(lResult.output).toContain('does not exist');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Only builds the entries of the requested types', async (): Promise<void> => {
        // Setup. One "page" entry and one "bundle" entry, but build only the "bundle" type.
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
                            './source/index.ts': { type: 'page', output: './page/bundle/main.js' },
                            './source/worker.ts': { type: 'bundle', output: './page/bundle/worker.js' }
                        }
                    }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--types': 'bundle' });

            // Evaluation. Only the "bundle" entry is built; the "page" entry is skipped.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/worker.js')).toBeTruthy();
            expect(lHelper.fileExists('packages/test.package/page/bundle/main.js')).toBeFalsy();
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Build - Fails on an unknown build type', async (): Promise<void> => {
        // Setup. A single valid entry, but request an unknown type.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'deno.json', JSON.stringify({
            name: '@test/package',
            version: '0.0.0',
            exports: './source/index.ts',
            kg: {
                source: './source',
                config: {
                    build: { files: { './source/index.ts': { type: 'page', output: './page/bundle/main.js' } } }
                }
            }
        }, null, 4));
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg build', { '-p': '@test/package', '--types': 'unknown' });

            // Evaluation. The command fails and reports the unknown type.
            expect(lResult.success).toBeFalsy();
            expect(lResult.output).toContain('Unknown build type "unknown"');
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
                    build: { files: { './source/index.ts': { type: 'page', output: './page/bundle/main.js' } } }
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
