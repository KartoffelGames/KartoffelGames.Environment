# @kartoffelgames/environment-command-build

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build package files into distributable artifacts.

## Description

The `build` command bundles configured source files and, optionally, packages the result into a native desktop application.

- **Bundling** — every configured file is bundled into a browser IIFE and written to the shared `app/bundle/` directory. The `app` command serves the whole `app/` directory, so the page has access to all bundles by path; to expose a bundle to other packages, list it in the package's `publish.include`.
- **Desktop** — when a `desktop` configuration is present, the built `app/` directory is packaged into a native desktop binary via [`deno desktop`](https://docs.deno.com/runtime/desktop/) (Deno ≥ 2.9).

If nothing is configured, the command does nothing and exits successfully.

## Configuration

Builds are configured in the package's `deno.json` under `kg.config.build`:

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "files": {
                    "./app/source/index.ts": { "name": "app", "reloadable": true },
                    "./app/source/worker.ts": { "name": "worker" }
                },
                "desktop": {
                    "name": "My App",
                    "identifier": "com.example.myapp",
                    "icons":  { "windows": "./icons/app.ico", "macos": "./icons/app.icns", "linux": "./icons/app.png" },
                    "output": { "windows": "./dist/MyApp", "macosArm": "./dist/MyApp.app", "macosIntel": "./dist/MyApp-intel.app", "linux": "./dist/my-app" }
                }
            }
        }
    }
}
```

### `files`

A map of **input file path** → bundle options. Each file is bundled to `app/bundle/<name>.js` (+ `.map`).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| *(key)* | `string` | — | Local path of the input file inside the package. |
| `name` | `string` | — | Base name of the produced output file. |
| `reloadable` | `boolean` | `false` | Whether the entry *may* receive the live-reload client. Only injected when the build runs with `--injectreload` (i.e. from the `app` dev server). Leave `false` for workers and other non-`window` bundles. |

### `desktop`

Desktop packaging configuration, or omit it (or set it to `null`) to build no desktop binary. The desktop build embeds the `app/` directory (its files ride into the binary through the generated server's module graph). Configure an `output` for each platform you ship, but note that `deno desktop` (2.9.x) does **not** cross-compile the app: a build only produces binaries for the **host** OS/arch. So on any given machine the build produces the output whose platform matches the host and **skips** the others with a message — build each platform on its own OS (e.g. a CI matrix). Unsigned binaries carry an ad-hoc signature by default; real macOS signing / notarization is a separate, host-bound step.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Application display name. |
| `identifier` | `string` | Reverse-DNS application id. |
| `icons` | `{ windows?, macos?, linux? }` | Per-OS icon paths. |
| `output` | `{ windows?, macosArm?, macosIntel?, linux? }` | Destination path for each target's produced app directory (macOS split by architecture — Apple Silicon / Intel). The build always emits `deno desktop`'s unpackaged app-folder layout; the path is just where it is placed, the extension does not change the format. |
| `backend` | `"webview" \| "cef"` | Optional rendering backend. Defaults to `webview`. |

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
deno task kg build [-a | -p=@scope/name] [--bundle-only] [--injectreload]
```

### Parameters

| Flag | Short | Description |
|------|-------|-------------|
| `--bundle-only` | `-b` | Only produce the bundles; skip the desktop packaging step. Used by the `app` dev server so a file change re-bundles quickly. |
| `--injectreload` | `-r` | Inject the live-reload client into `reloadable` bundles. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Bundle and (if configured) package the desktop app for a specific package
deno task kg build -p=@kartoffelgames/core

# Only bundle, skip the desktop packaging step
deno task kg build -p=@kartoffelgames/core --bundle-only

# Build all packages
deno task kg build -a
```
