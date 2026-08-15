# @kartoffelgames/environment-command-page

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build and serve a package's client page from a monorepo.

## Description

The `page` command builds and serves the package's `page/` directory over a local HTTP server. It watches both the package source and the `page/` directory for changes, rebundling and refreshing the browser on updates.

Unlike the `scratchpad` command, `page` writes bundled files to disk, making the result shareable and committable to version control.

The server serves the `page/` directory **as-is**, exactly like a static host would, with no path rewrites. This keeps the directory portable: it can be published to another service (e.g. GitHub Pages) or packaged into a desktop binary and behave the same. The live-reload client only connects back to the serving origin as an optional extra, so when that origin is absent (as on a static host) the page still works.

The server sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` so that [`SharedArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) is available during local development. For the deployed page to stay cross-origin isolated, the hosting service must send these headers as well.

The `page/` directory and its contents are owned by the package. The command does not scaffold any files, it only ensures the directory exists.

The bundles are produced by the [`build`](../kartoffelgames.environment.command_build/README.md) command. `page` runs `build` for the `page` and `bundle` types with the live-reload client injected (equivalent to `kg build --types=page,bundle --injectreload`). Configure the bundles as `build.files` entries. Give the browser entry `"type": "page"` so it receives the live-reload client during development (a `"bundle"` entry, e.g. a worker, does not):

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "files": {
                    "./page/source/index.ts": { "type": "page", "output": "./page/bundle/app.js" }
                }
            }
        }
    }
}
```

That entry produces `page/bundle/app.js` (+ `.map`), which your `page/index.html` can load via `<script src="/bundle/app.js">`. Because the server applies no rewrites, everything the browser loads must live inside `page/`. Add a `build.files` entry for each additional browser resource (shared library, worker, ...) so it is written into `page/bundle/`.

## Configuration

The page server is configured in the package's `deno.json` under `kg.config.page`:

```jsonc
{
    "kg": {
        "config": {
            "page": {
                "directory": "./page",
                "mimeTypeMapping": {},
                "port": 8088
            }
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `directory` | `string` | `"./page"` | Directory (relative to the package root) that is served and watched. |
| `mimeTypeMapping` | `Record<string, string>` | `{}` | Maps file extensions to MIME types for the HTTP server (see below). |
| `port` | `number` | `8088` | The port the local HTTP server listens on. |

### MIME Type Mapping

The `mimeTypeMapping` field maps file extensions (including the dot) to MIME type strings. Common MIME types are defined by default and can be overridden here:

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

The command always builds the page and then serves it. To build without serving, use the [`build`](../kartoffelgames.environment.command_build/README.md) command (`kg build --types=page,bundle`).

### Package Selection

| Flag | Description |
|------|-------------|
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build and serve the page for a specific package
deno task kg page -p=@kartoffelgames/core

# Build the page bundles without serving (via the build command)
deno task kg build -p=@kartoffelgames/core --types=page,bundle
```
