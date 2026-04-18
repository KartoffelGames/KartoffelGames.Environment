# @kartoffelgames/environment-command-sync

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to synchronize package metadata in a monorepo.

## Description

The `sync` command synchronizes package versions with the root project version and updates all package CLI configurations to their latest structure. This ensures all packages stay aligned after a version bump or when command configuration schemas change.

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
            "jsr:@kartoffelgames/environment-command-sync@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg sync [-a | -p=@scope/name]
```

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Sync a specific package
deno task kg sync -p=@kartoffelgames/core

# Sync all packages
deno task kg sync -a
```
