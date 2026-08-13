# @kartoffelgames/environment-command-page

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build and serve HTML pages from packages in a monorepo.

## Description

The `page` command builds and serves HTML page files over a local HTTP server. It watches both the package source and the `page/` directory for changes, automatically rebundling and refreshing the browser on updates.

Unlike the `scratchpad` command, `page` outputs bundled files to disk, making the result shareable and committable to version control.

On first run, the command initializes a `page/` directory with starter `index.html`, `index.css`, and `source/index.ts` files if they do not already exist.

The page bundle itself is produced by the [`build`](../kartoffelgames.environment.command_build/README.md) command: `page` runs `build` restricted to the `page` build type with the live-reload client injected (equivalent to `kg build --type=page --injectreload`). This means the page bundle must be configured as a `page`-type entry in `kg.config.build`, pointing at the page entry file:

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

That entry produces `page/build/page.js` (+ `.map`), which the starter `index.html` loads via `<script src="/build/page.js">`.

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
