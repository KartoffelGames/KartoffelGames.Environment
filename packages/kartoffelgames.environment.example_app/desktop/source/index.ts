// Desktop entry for the example app. `deno desktop` compiles this file into a native application and shows a webview
// bound to the HTTP server started below (Deno.serve auto-binds to the address the webview navigates to). The build
// copies the page directory next to the executable via this entry's "include" configuration, and the server serves it.
import { serveDir } from 'jsr:@std/http@^1/file-server';
import { dirname, join } from 'jsr:@std/path@^1';

// Web root: the page directory the build copied next to the executable.
const lPageRoot: string = join(dirname(Deno.execPath()), 'page');

// Serve the static page files. No port or hostname is passed so the webview binds automatically.
Deno.serve(async (pRequest: Request): Promise<Response> => {
    const lResponse: Response = await serveDir(pRequest, { fsRoot: lPageRoot, quiet: true });

    // Cross-origin isolation so SharedArrayBuffer is available, matching the page dev server.
    lResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    lResponse.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

    return lResponse;
});
