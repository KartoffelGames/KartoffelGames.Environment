# @kartoffelgames/environment-command-build

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build package files into distributable artifacts.

## Description

The `build` command builds every configured entry. Each entry has a `type` that decides how it is built.

- **`page` / `bundle`**: the entry is bundled into a browser IIFE and written to the `output` path it configures (+ `.map`). A `page` entry also receives the live-reload client when the build runs with `--injectreload` (from the `page` dev server). A `bundle` entry never does, so use it for workers and other non-`window` bundles.
- **`desktop`**: the entry file is compiled into a native desktop application via [`deno desktop`](https://docs.deno.com/runtime/desktop/) (Deno ≥ 2.9). The desktop build is standalone. It does **not** serve or embed the `page/` directory, it just compiles the given entry file.

Which entries are built can be narrowed with [`--types`](#parameters). If nothing is configured, or nothing matches the requested types, the command does nothing and exits successfully.

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
                        "output": {
                            "x86_64-pc-windows-msvc": { "directory": "./dist/windows/MyApp", "extension": "raw" },
                            "aarch64-apple-darwin": { "directory": "./dist/macos-arm/MyApp", "extension": "app" },
                            "x86_64-apple-darwin": { "directory": "./dist/macos-intel/MyApp", "extension": "dmg" },
                            "x86_64-unknown-linux-gnu": { "directory": "./dist/linux/MyApp", "extension": "deb" }
                        },
                        "include": [
                            { "directory": "./page", "filter": ["**/*.html", "**/*.css", "**/*.js"] }
                        ]
                    }
                }
            }
        }
    }
}
```

### `files`

A map of **input file path** to entry options. The `type` field selects the entry kind and the rest of its shape.

Entries are built **sequentially, in the order they are declared** in `files` (the object's key order in `deno.json`), each build finishing before the next starts. Order them accordingly when one build depends on another's output, for example declare a `bundle`/`page` entry before a `desktop` entry that includes its output.

#### `page` / `bundle` entries

| Field | Type | Description |
|-------|------|-------------|
| *(key)* | `string` | Local path of the input file inside the package. |
| `type` | `"page" \| "bundle"` | Entry kind. A `page` entry receives the live-reload client under `--injectreload`, a `bundle` entry never does. |
| `output` | `string` | Output path of the produced bundle, **including the filename** (e.g. `./page/bundle/app.js`). |

#### `desktop` entries

A `desktop` entry compiles its input file into a native application via `deno desktop`. A dedicated `desktop-build-deno.json` (a copy of the package `deno.json` with the app name/identifier and backend injected, holding no target information) is written next to the package `deno.json` for the build and removed afterwards. `deno desktop --target` cross-compiles, so **every** configured `output` target is built regardless of the host platform.

The `output` map is keyed by the **target triple** passed to `deno desktop --target`. Each entry has a `directory` and an `extension`. The last path segment of `directory` is the produced artifact's name: for a packaged `extension` the artifact is written as `<directory>.<extension>` (e.g. `./dist/linux/MyApp` + `deb` => `./dist/linux/MyApp.deb`), while `raw` produces a plain directory without extension. On macOS, `raw` is an alias for `app`.

To ship website or other files with the app, list them under `include`. Includes are copied into the produced artifact after each build, so they only work for a directory-shaped output (a `raw` directory or a macOS `app` bundle). Configuring `include` together with any other (packaged) extension fails the build.

| Field | Type | Description |
|-------|------|-------------|
| *(key)* | `string` | Local path of the desktop entry file inside the package. |
| `type` | `"desktop"` | Entry kind. |
| `name` | `string` | Application display name. |
| `identifier` | `string` | Reverse-DNS application id. |
| `icons` | `{ windows?, macos?, linux? }` | Per-OS icon paths. |
| `output` | `Record<triple, { directory, extension? }>` | Output per target, keyed by target triple (e.g. `x86_64-pc-windows-msvc`, `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`). `directory`'s last segment is the artifact name. `extension` is `raw` (plain directory, macOS alias for `app`) or a packaged file extension like `app`, `dmg`, `msi`, `deb`. Defaults to `raw`. |
| `backend` | `"webview" \| "cef" \| "raw"` | Optional rendering backend. Defaults to `deno desktop`'s default. |
| `include` | `Array<{ directory, filter? }>` | Directories copied into every produced `raw`/`app` output after the build. Each is copied **preserving its own name** next to the executable (`<output>/<directory name>/` for `raw`, `<output>/Contents/MacOS/<directory name>/` for an `app` bundle). The optional `filter` is a list of globstar patterns (e.g. `["**/*.js", "**/*.html"]`) and a file is copied when it matches any of them. When `filter` is omitted or empty, every file in the directory is copied. Only supported for `raw`/`app` outputs. |

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
| `--types` | `-t` | Comma-separated list of build types to build (`page`, `bundle`, `desktop`). Only entries whose `type` is listed are built. When omitted, everything configured is built. The `page` dev server passes `--types=page,bundle` so a file change re-bundles quickly without triggering a desktop build. |
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
