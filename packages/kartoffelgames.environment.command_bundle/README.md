# @kartoffelgames/environment-command-bundle

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to bundle packages in a monorepo.

## Description

The `bundle` command bundles package source files into JavaScript output. It reads file mappings from the package's CLI configuration and outputs bundled `.js` files along with corresponding `.js.map` source maps into the `library/` directory.

If no file mappings are configured, bundling is skipped unless the `--force` flag is set, in which case the default mapping (`<packagename>` -> `./source/index.ts`) is used.

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
            "jsr:@kartoffelgames/environment-command-bundle@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg bundle [-a | -p=@scope/name] [--force]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--force` | `-f` | Force bundling even if no file mappings are configured. Uses the default mapping in that case. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Bundle a specific package
deno task kg bundle -p=@kartoffelgames/core

# Bundle all packages
deno task kg bundle -a

# Force bundle a package even without configured file mappings
deno task kg bundle -p=@kartoffelgames/core -f
```
