import { assertEquals } from 'jsr:@std/assert';
import { KgCliCommand } from "../source/command.ts";

Deno.test("pointless test 1", () => {
    new KgCliCommand();

    const a = 1 + 1;
    const b = 2;
    assertEquals(a, b);
});

Deno.test("pointless test 2", () => {
    const a = 2 + 2;
    const b = 4;
    assertEquals(a, b);
});

Deno.test("pointless test 3", () => {
    const a = 3 + 3;
    const b = 7; // Intentional failure
    assertEquals(a, b);
});

Deno.test("pointless test 4", () => {
    const a = 4 + 4;
    const b = 8;
    assertEquals(a, b);
});

Deno.test("pointless test 5", () => {
    const a = 5 + 5;
    const b = 11; // Intentional failure
    assertEquals(a, b);
});

Deno.test("pointless test 6", () => {
    const a = 6 + 6;
    const b = 12;
    assertEquals(a, b);
});

Deno.test("pointless test 7", () => {
    const a = 7 + 7;
    const b = 14;
    assertEquals(a, b);
});

Deno.test("pointless test 8", () => {
    const a = 8 + 8;
    const b = 16;
    assertEquals(a, b);
});

Deno.test("pointless test 9", () => {
    const a = 9 + 9;
    const b = 19; // Intentional failure
    assertEquals(a, b);
});

Deno.test("pointless test 10", () => {
    const a = 10 + 10;
    const b = 20;
    assertEquals(a, b);
});