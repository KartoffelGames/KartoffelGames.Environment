// INTENTIONAL FAILURE.
// This test exists only to verify that the `kg test` runner (and the CI pipeline) correctly
// reports a red result when a test fails. It is expected to fail. Delete this file to make the
// suite green again.
Deno.test('Intentional failure - verifies failure reporting', () => {
    throw new Error('Intentional failure to verify that test failures are reported.');
});
