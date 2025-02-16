import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';

describe("Test tests", () => {
    it("Add", () => {
        const lResult = 2 + 3;
        expect(lResult).toBe(5);
    });

    it("Dif", () => {
        const lResult = 0 - 5;
        expect(lResult).toBe(-5);
    });
});