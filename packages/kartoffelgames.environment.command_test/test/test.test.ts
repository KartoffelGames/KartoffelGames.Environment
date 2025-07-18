import { expect } from '@std/expect';
import { add, sub } from "../source/testing-functions.ts";

Deno.test('Test', async (pContext) => {
    await pContext.step('Add', () => {
        const lResult = add(2, 3);
        expect(lResult).toBe(5);
    });

    await pContext.step('Sub', () => {
        const lResult = sub(5, 3);
        expect(lResult).toBe(2);
    });
});