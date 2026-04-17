# @kartoffelgames/environment-command-transform

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to transform packages into other runtimes in a monorepo.

## Description

The `transform` command transforms Deno packages into other runtime formats. Currently it supports transforming to Node.js using `@deno/dnt`. The transformation reads exported files from the package's `deno.json`, converts TypeScript sources, and outputs ESM, CommonJS, and source files into the configured output directory (default: `./node`).

The `--clean` flag removes previously generated output directories and cleans up related workspace entries.

## Configuration

The transform feature is configured in the package's `deno.json` under `kg.config.transform`:

```jsonc
{
    "kg": {
        "config": {
            "transform": {
                "enableNode": false,
                "nodeDirectory": "./node"
            }
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableNode` | `boolean` | `false` | Whether Node.js transformation is enabled for this package. |
| `nodeDirectory` | `string` | `"./node"` | Relative path to the output directory for the transformed Node.js files. |

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
            "jsr:@kartoffelgames/environment-command-transform@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg transform [-a | -p=@scope/name] [--node] [--clean]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--node` | `-n` | Transform the package to Node.js runtime. Must be enabled in the package configuration. |
| `--clean` | `-c` | Clean the output directories and remove workspace entries for the transformed package. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Transform a specific package to Node.js
deno task kg transform -p=@kartoffelgames/core -n

# Transform all packages to Node.js
deno task kg transform -a -n

# Clean transform output for a specific package
deno task kg transform -p=@kartoffelgames/core -c

# Clean transform output for all packages
deno task kg transform -a -c
```
