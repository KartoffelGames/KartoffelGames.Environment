import { CommandTestHelper, type CommandTestHelperResult } from '@kartoffelgames/environment-test-tools';
import { expect } from '@std/expect';

Deno.test('KgCliCommand.run()', async (pContext) => {
    await pContext.step('Bump - Patch', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bump', { '--type': 'patch' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.projectConfiguration().version).toBe('1.2.4');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Bump - Minor resets patch', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bump', { '--type': 'minor' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.projectConfiguration().version).toBe('1.3.0');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Bump - Major resets minor and patch', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bump', { '--type': 'major' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.projectConfiguration().version).toBe('2.0.0');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Bump - Explicit version', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bump', { '--type': '4.5.6' });

            // Evaluation.
            expect(lResult.success).toBeTruthy();
            expect(lHelper.projectConfiguration().version).toBe('4.5.6');
        } finally {
            await lHelper.dispose();
        }
    });

    await pContext.step('Error: Missing type parameter', async (): Promise<void> => {
        // Setup.
        const lHelper: CommandTestHelper = await CommandTestHelper.create('1.2.3');
        try {
            // Process.
            const lResult: CommandTestHelperResult = await lHelper.run('kg bump');

            // Evaluation.
            expect(lResult.success).toBeFalsy();
            expect(lResult.output).toContain('Error: Type parameter is required');
            expect(lHelper.projectConfiguration().version).toBe('1.2.3');
        } finally {
            await lHelper.dispose();
        }
    });
});
