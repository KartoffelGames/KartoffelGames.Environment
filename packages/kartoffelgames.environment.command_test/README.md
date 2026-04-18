# @kartoffelgames/environment-command-test

A command module for the [KartoffelGames CLI](https://jsr.io/@kartoffelgames/environment-cli), used to run tests for packages in a monorepo.

## Description

The `test` command runs Deno tests for a package. It discovers all `.ts` test files in the configured test directory (default: `./test`) and executes them using `deno test`. It optionally generates coverage reports and supports attaching a debugger via the inspector protocol.

## Configuration

The test feature is configured in the package's `deno.json` under `kg.config.test`:

```jsonc
{
    "kg": {
        "config": {
            "test": {
                "directory": "./test"
            }
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `directory` | `string` | `"./test"` | Relative path to the directory containing test files. |

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
            "jsr:@kartoffelgames/environment-command-test@<version>"
        ],
        "packages": "./packages"
    }
}
```

## Usage

```
deno task kg test [-a | -p=@scope/name] [--coverage] [--detailed] [--inspect]
```

### Parameters

| Parameter | Short | Description |
|-----------|-------|-------------|
| `--coverage` | `-c` | Generate a coverage report after running tests. |
| `--detailed` | `-d` | Show detailed coverage output. Only effective together with `--coverage`. |
| `--inspect` | `-i` | Enable the Deno inspector for debugging. Waits for a debugger connection on `0.0.0.0:9229`. |

### Package Selection

| Flag | Description |
|------|-------------|
| `-a` | Run the command for all packages in the monorepo. |
| `-p=@scope/name` | Run the command for a single specific package. |

### Examples

```bash
# Test a specific package
deno task kg test -p=@kartoffelgames/core

# Test all packages
deno task kg test -a

# Test with coverage report
deno task kg test -p=@kartoffelgames/core -c

# Test with detailed coverage
deno task kg test -p=@kartoffelgames/core -c -d

# Test with debugger attached
deno task kg test -p=@kartoffelgames/core -i
```
