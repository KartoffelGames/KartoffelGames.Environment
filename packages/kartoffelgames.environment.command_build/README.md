# @kartoffelgames/environment-command-build

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build package files into distributable artifacts.

## Description

The `build` command turns configured package source files into distributable artifacts. Each configured input file is built by a named **build type**, and the result is written into the package's `library/<type>/` directory.

Build types are extensible. Currently only the `bundle` type is implemented (browser IIFE bundle via `@kartoffelgames/environment-bundle`); further types (e.g. a `desktop` type) can be added later.

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
| `type` | `string` | Build type. Currently only `"bundle"`. |
| `name` | `string` | Base name of the produced output file. |

The example above produces `library/bundle/MyLibrary.js` and `library/bundle/MyLibrary.js.map`.

Multiple entries are allowed; each is built independently:

```jsonc
{
    "build": {
        "./source/index.ts": { "type": "bundle", "name": "MyLibrary" },
        "./source/worker.ts": { "type": "bundle", "name": "MyWorker" }
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
deno task kg build [-a | -p=@scope/name]
```

The command has no parameters of its own. When `kg.config.build` is empty, the build is skipped.

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
```
