# @kartoffelgames/environment-command-app

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build and serve a package's client app from a monorepo.

## Description

The `app` command builds and serves the package's `app/` directory over a local HTTP server. It watches both the package source and the `app/` directory for changes, automatically rebundling and refreshing the browser on updates.

Unlike the `scratchpad` command, `app` outputs bundled files to disk, making the result shareable and committable to version control.

The server serves the `app/` directory **as-is**, exactly like a static host would — no path rewrites are applied. This keeps the directory portable: it can be published to another service (e.g. GitHub Pages) or packaged into a desktop binary and behave the same. The live-reload client is safe in this regard because it only connects back to the serving origin as an optional extra; when that origin is absent (as on a static host) the page still works.

The server sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` so that [`SharedArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) is available during local development. For the deployed app to stay cross-origin isolated, the hosting service must be configured to send these headers as well.

The `app/` directory and its contents are owned by the package. The command does not scaffold any files; it only ensures the directory exists.

The bundles are produced by the [`build`](../kartoffelgames.environment.command_build/README.md) command: `app` runs `build` in bundle-only mode with the live-reload client injected (equivalent to `kg build --bundle-only --injectreload`). Configure the bundles as `build.files` entries; any entry loaded by the browser that should live-reload during development sets `reloadable: true`:

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "files": {
                    "./app/source/index.ts": { "name": "app", "reloadable": true }
                }
            }
        }
    }
}
```

That entry produces `app/bundle/app.js` (+ `.map`), which your `app/index.html` can load via `<script src="/bundle/app.js">`. Because the server applies no rewrites, everything the browser loads must live inside `app/` — add a `build.files` entry for each additional browser resource (shared library, worker, …) so it is written into `app/bundle/`.

## Configuration

The app server is configured in the package's `deno.json` under `kg.config.app`:

```jsonc
{
    "kg": {
        "config": {
            "app": {
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
            "jsr:@kartoffelgames/environment-command-app@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg app [-a | -p=@scope/name]
```

The command always builds the app and then serves it. To build without serving, use the [`build`](../kartoffelgames.environment.command_build/README.md) command (`kg build --bundle-only`).

### Package Selection

| Flag | Description |
|------|-------------|
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build and serve the app for a specific package
deno task kg app -p=@kartoffelgames/core

# Build the app bundles without serving (via the build command)
deno task kg build -p=@kartoffelgames/core --bundle-only
```
