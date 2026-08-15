import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Test - Runs package tests', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'test/sample.test.ts', 'Deno.test(\'Sample\', () => { });\n');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg test', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('passed');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Test - Runs package tests with coverage', async (): Promise<void> => {
        // Setup. The test executes the package source so a coverage report can be generated.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        lHelper.writePackageFile('@test/package', 'source/index.ts', 'export function testAdd(pFirst: number, pSecond: number): number {\n    return pFirst + pSecond;\n}\n');
        lHelper.writePackageFile('@test/package', 'test/sample.test.ts', 'import { testAdd } from \'../source/index.ts\';\nDeno.test(\'Sample\', () => { testAdd(1, 2); });\n');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg test', { '-p': '@test/package', '--coverage': '' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('passed');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Test - Reports when no test files exist', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create();
        await lHelper.addPackage('@test/package');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg test', { '-p': '@test/package' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lResult.output).toContain('No test files found.');
        } finally {
            await lHelper.dispose();
        }
    });
});
