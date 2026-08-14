# @kartoffelgames/environment-command-build

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build package files into distributable artifacts.

## Description

The `build` command builds every configured entry. Each entry has a `type` that decides how it is built.

- **`page` / `bundle`** — the entry is bundled into a browser IIFE and written to the `output` path it configures (+ `.map`). A `page` entry additionally receives the live-reload client when the build runs with `--injectreload` (i.e. from the `page` dev server); a `bundle` entry never does (use it for workers and other non-`window` bundles).
- **`desktop`** — the entry file is compiled into a native desktop application via [`deno desktop`](https://docs.deno.com/runtime/desktop/) (Deno ≥ 2.9). The desktop build is standalone: it does **not** serve or embed the `page/` directory — it just compiles the given entry file.

Which entries are built can be narrowed with [`--types`](#parameters). If nothing is configured (or nothing matches the requested types), the command does nothing and exits successfully.

## Configuration

Builds are configured in the package's `deno.json` under `kg.config.build`. Every entry lives in `files`, keyed by its input file path and discriminated by `type`:

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "files": {
                    "./page/source/index.ts": { "type": "page", "output": "./page/bundle/app.js" },
                    "./page/source/worker.ts": { "type": "bundle", "output": "./page/bundle/worker.js" },
                    "./desktop/source/index.ts": {
                        "type": "desktop",
                        "name": "My App",
                        "identifier": "com.example.myapp",
                        "icons":  { "windows": "./icons/app.ico", "macos": "./icons/app.icns", "linux": "./icons/app.png" },
                        "output": { "windows": "./dist/MyApp.msi", "macosArm": "./dist/MyApp.app", "macosIntel": "./dist/MyApp-intel.app", "linux": "./dist/MyApp.AppImage" }
                    }
                }
            }
        }
    }
}
```

### `files`

A map of **input file path** → entry options. The `type` field selects the entry kind and the rest of its shape.

#### `page` / `bundle` entries

| Field | Type | Description |
|-------|------|-------------|
| *(key)* | `string` | Local path of the input file inside the package. |
| `type` | `"page" \| "bundle"` | Entry kind. A `page` entry receives the live-reload client when the build runs with `--injectreload`; a `bundle` entry never does. |
| `output` | `string` | Output path of the produced bundle, **including the filename** (e.g. `./page/bundle/app.js`). |

#### `desktop` entries

A `desktop` entry compiles its input file into a native application via `deno desktop`. A dedicated `desktop-build-deno.json` (a copy of the package `deno.json` with the app name/identifier injected) is generated next to the package `deno.json` for the build and removed afterwards. `deno desktop` (2.9.x) produces binaries for the **host** OS/arch only, so the build only produces the configured `output` whose platform matches the host and **skips** the others with a message — build each platform on its own OS (e.g. a CI matrix).

| Field | Type | Description |
|-------|------|-------------|
| *(key)* | `string` | Local path of the desktop entry file inside the package. |
| `type` | `"desktop"` | Entry kind. |
| `name` | `string` | Application display name. |
| `identifier` | `string` | Reverse-DNS application id. |
| `icons` | `{ windows?, macos?, linux? }` | Per-OS icon paths. |
| `output` | `{ windows?, macosArm?, macosIntel?, linux? }` | Destination path for each target's produced application (macOS split by architecture — Apple Silicon / Intel). The extension selects the `deno desktop` package format (e.g. `.msi`, `.app`, `.AppImage`, `.dmg`, `.deb`, `.rpm`). |
| `backend` | `"webview" \| "cef" \| "raw"` | Optional rendering backend. Defaults to `deno desktop`'s default. |

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
            "jsr:@kartoffelgames/environment-command-build@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg build [-a | -p=@scope/name] [--types=page,bundle] [--injectreload]
```

### Parameters

| Flag | Short | Description |
|------|-------|-------------|
| `--types` | `-t` | Comma-separated list of build types to build (`page`, `bundle`, `desktop`). Only the entries whose `type` is listed are built. When omitted, everything configured is built. Used by the `page` dev server (`--types=page,bundle`) so a file change re-bundles quickly without triggering a desktop build. |
| `--injectreload` | `-r` | Inject the live-reload client into `page` type entries. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build every configured entry (page, bundle and desktop) for a specific package
deno task kg build -p=@kartoffelgames/core

# Only build the page and bundle entries, skip the desktop build
deno task kg build -p=@kartoffelgames/core --types=page,bundle

# Only build the desktop entry
deno task kg build -p=@kartoffelgames/core --types=desktop

# Build all packages
deno task kg build -a
```
