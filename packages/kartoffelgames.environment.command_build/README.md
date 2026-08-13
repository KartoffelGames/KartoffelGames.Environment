# @kartoffelgames/environment-command-build

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build package files into distributable artifacts.

## Description

The `build` command turns configured package source files into distributable artifacts. Each configured input file is built by a named **build type**, and the result is written to a per-type output location.

Build types are extensible. Currently implemented:

| Type | Output location | Description |
|------|-----------------|-------------|
| `bundle` | `library/bundle/<name>.js` (+ `.map`) | Browser IIFE bundle via `@kartoffelgames/environment-bundle`. |
| `page` | `page/build/<name>.js` (+ `.map`) | Browser IIFE bundle of a page entry file, written into the `page/build` directory served by the `page` command. |

Both types share the same bundling pipeline and differ only in their output location. The `--injectreload` flag applies to every type: it injects a live-reload client into the produced bundle that refreshes the browser when the `page` command's server pushes an update.

If no build entries are configured, the command does nothing and exits successfully.

## Configuration

Builds are configured in the package's `deno.json` under `kg.config.build`. It is a map of **input file path** to a build entry `{ type, name }`:

```jsonc
{
    "kg": {
        "config": {
            "build": {
                "./source/index.ts": { "type": "bundle", "name": "MyLibrary" }
            }
        }
    }
}
```

| Field | Type | Description |
|-------|------|-------------|
| *(key)* | `string` | Local path of the input file inside the package. |
| `type` | `string` | Build type. One of `"bundle"` or `"page"`. |
| `name` | `string` | Base name of the produced output file. |

The example above produces `library/bundle/MyLibrary.js` and `library/bundle/MyLibrary.js.map`.

Multiple entries are allowed; each is built independently. Different types can be mixed:

```jsonc
{
    "build": {
        "./source/index.ts": { "type": "bundle", "name": "MyLibrary" },
        "./source/worker.ts": { "type": "bundle", "name": "MyWorker" },
        "./page/source/index.ts": { "type": "page", "name": "page" }
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
            "jsr:@kartoffelgames/environment-command-build@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg build [-a | -p=@scope/name] [--type=<type>] [--injectreload]
```

When `kg.config.build` is empty (or nothing matches `--type`), the build is skipped.

### Parameters

| Flag | Short | Description |
|------|-------|-------------|
| `--type=<type>` | `-t` | Only build entries whose build type matches `<type>` (e.g. `--type=page`). |
| `--injectreload` | `-r` | Inject the live-reload client into every produced bundle, regardless of build type. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build a specific package
deno task kg build -p=@kartoffelgames/core

# Build all packages
deno task kg build -a

# Build only the page-type entries of a package
deno task kg build -p=@kartoffelgames/core --type=page

# Build page entries with the live-reload client injected
deno task kg build -p=@kartoffelgames/core --type=page --injectreload
```
