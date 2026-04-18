# @kartoffelgames/environment-command-bump

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to manage versioning in a monorepo.

## Description

The `bump` command updates the root project version. It supports semantic versioning keywords (`major`, `minor`, `patch`) as well as explicit version strings.

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
            "jsr:@kartoffelgames/environment-command-bump@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg bump [--type <value>]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--type` | `-t` | The version bump type. Accepts `major`, `minor`, `patch`, or an explicit version in `X.Y.Z` format. |

### Examples

```bash
# Bump the patch version (e.g. 1.2.3 -> 1.2.4)
deno task kg bump -t patch

# Bump the minor version (e.g. 1.2.3 -> 1.3.0)
deno task kg bump -t minor

# Bump the major version (e.g. 1.2.3 -> 2.0.0)
deno task kg bump -t major

# Set an explicit version
deno task kg bump -t 3.0.0
```
