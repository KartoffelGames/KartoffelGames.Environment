import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';

describe("Test tests", () => {
    it("Add", () => {
        const result = 2 + 3;
        expect(result).toBe(5);
    });

    it("Dif", () => {
        const result = 0 - 5;
        expect(result).toBe(-5);
    });
});