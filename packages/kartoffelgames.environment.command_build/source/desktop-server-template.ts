// Template for the generated desktop server entrypoint. DesktopBuilder copies this file into the temporary build
// directory and replaces the two marker lines below with the app's embedded module imports and manifest entries:
//   - the IMPORTS marker -> one raw-module import per app file (with { type: "text" | "bytes" }).
//   - the MANIFEST marker -> one manifest entry per app file (path -> { body, mime type }).
// It embeds the whole app directory through the module graph (deno desktop does not embed via --include) and serves
// it from memory. It must stay self-contained (Deno globals only) so it type-checks both as-is and after replacement.

// __DESKTOP_SERVER_IMPORTS__

type DesktopFileEntry = { body: string | Uint8Array; type: string };

const MANIFEST: Map<string, DesktopFileEntry> = new Map<string, DesktopFileEntry>([
    // __DESKTOP_SERVER_MANIFEST__
]);

// Cross-origin isolation headers so SharedArrayBuffer is available, matching the app dev server.
const DEFAULT_HEADERS: Record<string, string> = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless'
};

const respond = (pEntry: DesktopFileEntry): Response => {
    // A Uint8Array is a valid body at runtime; cast past the BodyInit generic-parameter mismatch.
    return new Response(pEntry.body as BodyInit, { status: 200, headers: { ...DEFAULT_HEADERS, 'Content-Type': pEntry.type } });
};

Deno.serve((pRequest: Request): Response => {
    const lPathName: string = decodeURIComponent(new URL(pRequest.url).pathname);

    // Try the path directly, then fall back to a directory index.html.
    const lCandidates: Array<string> = [];
    if (lPathName === '/') {
        lCandidates.push('/index.html');
    } else {
        lCandidates.push(lPathName);
        lCandidates.push(lPathName.replace(/\/?$/, '/') + 'index.html');
    }

    for (const lCandidate of lCandidates) {
        const lEntry: DesktopFileEntry | undefined = MANIFEST.get(lCandidate);
        if (lEntry) {
            return respond(lEntry);
        }
    }

    return new Response('404 Not Found', { status: 404, headers: { ...DEFAULT_HEADERS } });
});
