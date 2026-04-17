# @kartoffelgames/environment-command-help

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to display available commands in a monorepo.

## Description

The `help` command lists all registered CLI commands along with their parameters and descriptions. It provides a quick overview of everything the CLI can do.

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
            "jsr:@kartoffelgames/environment-command-help@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg help
```

### Examples

```bash
# Show all available commands
deno task kg help
```
