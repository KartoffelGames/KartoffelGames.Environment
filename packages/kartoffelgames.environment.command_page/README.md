# @kartoffelgames/environment-command-page

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build and serve HTML pages from packages in a monorepo.

## Description

The `page` command builds and serves the package's `page/` directory over a local HTTP server. It watches both the package source and the `page/` directory for changes, automatically rebundling and refreshing the browser on updates.

Unlike the `scratchpad` command, `page` outputs bundled files to disk, making the result shareable and committable to version control.

The server serves the `page/` directory **as-is**, exactly like a static host would — no path rewrites are applied. This keeps the directory portable: it can be published to another service (e.g. GitHub Pages) and behave the same. The live-reload client is safe in this regard because it only connects back to the serving origin as an optional extra; when that origin is absent (as on a static host) the page still works.

The server sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` so that [`SharedArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) is available during local development. For the deployed page to stay cross-origin isolated, the hosting service must be configured to send these headers as well.

The `page/` directory and its contents are owned by the package. The command does not scaffold any files; it only ensures the directory exists.

The page bundle is produced by the [`build`](../kartoffelgames.environment.command_build/README.md) command: `page` runs `build` restricted to the `page` build type with the live-reload client injected (equivalent to `kg build --type=page --injectreload`). Configure the page bundle as a `page`-type entry in `kg.config.build`, pointing at the page entry file:

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "./page/source/index.ts": { "type": "page", "name": "page" }
            }
        }
    }
}
```

That entry produces `page/build/page.js` (+ `.map`), which your `page/index.html` can load via `<script src="/build/page.js">`.

Because the server applies no rewrites, **everything the browser loads must live inside `page/`**. Any additional browser resource (a shared library, a web worker, etc.) should therefore be its own `page`-type build entry so it is written into `page/build/` and stays part of the portable directory. The `bundle` type is for artifacts consumed by other packages at build time, not for resources fetched by the browser.

## Configuration

The page server is configured in the package's `deno.json` under `kg.config.page`:

```jsonc
{
    "kg": {
        "config": {
            "page": {
                "mimeTypeMapping": {},
                "port": 8088
            }
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mimeTypeMapping` | `Record<string, string>` | `{}` | Maps file extensions to MIME types for the HTTP server (see below). |
| `port` | `number` | `8088` | The port the local HTTP server listens on. |

### MIME Type Mapping

The `mimeTypeMapping` field maps file extensions (including the dot) to MIME type strings. Common MIME types are already defined by default, but can be overridden through this configuration:

```jsonc
{
    "mimeTypeMapping": {
        ".html": "text/html",
        ".css": "text/css",
        ".wasm": "application/wasm"
    }
}
```

## Installation

Register this command in the root `deno.json` of your monorepo:

```jsonc
{
    "tasks": {
        "kg": "deno run --unstable-bundle -A jsr:@kartoffelgames/environment-cli@<version>"
    },
    "kg": {
        "root": true,
        "cli": [
            "jsr:@kartoffelgames/environment-command-page@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg page [-a | -p=@scope/name]
```

The command always builds the page and then serves it. To build the page without serving, use the [`build`](../kartoffelgames.environment.command_build/README.md) command directly (`kg build --type=page`).

### Package Selection

| Flag | Description |
|------|-------------|
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build and serve the page for a specific package
deno task kg page -p=@kartoffelgames/core

# Build the page without serving (via the build command)
deno task kg build -p=@kartoffelgames/core --type=page
```
