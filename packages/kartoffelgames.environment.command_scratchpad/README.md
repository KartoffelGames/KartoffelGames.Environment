# @kartoffelgames/environment-command-scratchpad

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to serve a local scratchpad page for packages in a monorepo.

## Description

The `scratchpad` command serves scratchpad files over a local HTTP server. It watches both the package source and the `scratchpad/` directory for changes, automatically rebundling and refreshing the browser on updates.

Unlike the `page` command, `scratchpad` keeps all bundled files in memory and does not write them to disk. It is intended for quick local testing and experimentation, not for producing shareable output.

On first run, the command initializes a `scratchpad/` directory with starter `index.html`, `index.css`, and `source/index.ts` files if they do not already exist.

## Configuration

The scratchpad feature is configured in the package's `deno.json` under `kg.config.scratchpad`:

```jsonc
{
    "kg": {
        "config": {
            "scratchpad": {
                "mimeTypeMapping": {},
                "mainBundleRequired": false,
                "port": 8088
            }
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mimeTypeMapping` | `Record<string, string>` | `{}` | Maps file extensions to MIME types for the HTTP server. |
| `mainBundleRequired` | `boolean` | `false` | Whether the main package bundle is required for the scratchpad bundle. |
| `port` | `number` | `8088` | The port the local HTTP server listens on. |

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
            "jsr:@kartoffelgames/environment-command-scratchpad@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg scratchpad [-a | -p=@scope/name]
```

### Package Selection

| Flag | Description |
|------|-------------|
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Start the scratchpad for a specific package
deno task kg scratchpad -p=@kartoffelgames/core

# Start the scratchpad for all packages
deno task kg scratchpad -a
```
