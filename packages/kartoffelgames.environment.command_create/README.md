# @kartoffelgames/environment-command-create

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to scaffold new packages in a monorepo.

## Description

The `create` command scaffolds a new package from a blueprint template. Blueprints are pluggable and provided by separate blueprint packages registered in the CLI configuration. This allows custom blueprints to be added for different package types.

The command validates the package name against JSR naming conventions, downloads the selected blueprint, extracts it into a new package directory, and registers the package in the workspace.

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
            "jsr:@kartoffelgames/environment-command-create@<version>",
            "jsr:@kartoffelgames/environment-blueprint@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg create [--list] [--blueprint <name>] [--packagename <name>]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--list` | `-l` | List all available blueprints and exit. |
| `--blueprint` | `-b` | The name of the blueprint to use for scaffolding. |
| `--packagename` | `-n` | The name of the new package (must follow JSR naming: `@scope/name`). |

If `--blueprint` or `--packagename` are not provided, the command will prompt for them interactively.

### Examples

```bash
# List all available blueprints
deno task kg create -l

# Create a new package interactively
deno task kg create

# Create a new package with a specific blueprint and name
deno task kg create -b library -n @kartoffelgames/my-new-package
```
