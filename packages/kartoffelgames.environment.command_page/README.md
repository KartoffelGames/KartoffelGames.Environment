# @kartoffelgames/environment-command-page

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to build and serve HTML pages from packages in a monorepo.

## Description

The `page` command builds and serves HTML page files over a local HTTP server. It watches both the package source and the `page/` directory for changes, automatically rebundling and refreshing the browser on updates.

Unlike the `scratchpad` command, `page` outputs bundled files to disk, making the result shareable and committable to version control.

On first run, the command initializes a `page/` directory with starter `index.html`, `index.css`, and `source/index.ts` files if they do not already exist.

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
deno task kg page [-a | -p=@scope/name] [--force] [--build-only]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--force` | `-f` | Force building even if the page feature is disabled in the package configuration. |
| `--build-only` | `-b` | Only build the page files without starting the HTTP server. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Build and serve the page for a specific package
deno task kg page -p=@kartoffelgames/core

# Only build without serving
deno task kg page -p=@kartoffelgames/core -b

# Force build even if page is disabled in config
deno task kg page -p=@kartoffelgames/core -f
```
