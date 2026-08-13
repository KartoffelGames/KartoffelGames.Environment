// Entrypoint of the packaged desktop application. The desktop window points at this local http server, which
// serves the "app" directory embedded next to this file in the binary's virtual filesystem (via `--include ./app`).
// This file is copied verbatim into a temporary build directory and compiled by `deno desktop`; it must stay
// self-contained (Deno globals only, no imports).

const APP_ROOT: string = import.meta.dirname + '/app';

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.map': 'application/json'
};

// Cross-origin isolation headers so SharedArrayBuffer is available, matching the `app` dev server.
const DEFAULT_HEADERS: Record<string, string> = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless'
};

const extensionOf = (pPath: string): string => {
    const lIndex: number = pPath.lastIndexOf('.');
    return lIndex < 0 ? '' : pPath.substring(lIndex).toLowerCase();
};

const fileResponse = (pFilePath: string): Response | null => {
    let lFile: Deno.FsFile;
    try {
        lFile = Deno.openSync(pFilePath, { read: true });
    } catch {
        return null;
    }

    return new Response(lFile.readable, {
        status: 200,
        headers: { ...DEFAULT_HEADERS, 'Content-Type': MIME_TYPES[extensionOf(pFilePath)] ?? 'text/plain' }
    });
};

Deno.serve((pRequest: Request): Response => {
    const lPathName: string = new URL(pRequest.url).pathname;
    const lRelativePath: string = decodeURIComponent(lPathName === '/' ? '/index.html' : lPathName);
    const lFilePath: string = APP_ROOT + lRelativePath;

    // Serve the file directly, otherwise fall back to a directory index.html, otherwise 404.
    return fileResponse(lFilePath)
        ?? fileResponse(`${lFilePath.replace(/[\/\\]?$/, '/')}index.html`)
        ?? new Response('404 Not Found', { status: 404, headers: { ...DEFAULT_HEADERS } });
});
