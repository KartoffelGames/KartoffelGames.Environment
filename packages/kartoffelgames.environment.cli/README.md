# @kartoffelgames/environment-cli

The main CLI entry point for the [KartoffelGames environment](https://jsr.io/@kartoffelgames/environment-cli), a toolchain for managing Deno-based monorepos.

## Description

The KartoffelGames CLI (`kg`) provides a pluggable command system for working with monorepo packages. Commands are loaded dynamically from separately published packages registered in the root `deno.json`, making the CLI fully extensible.

## Setup

Add a `kg` task and configuration section to the root `deno.json` of your monorepo:

```jsonc
{
    "tasks": {
        "kg": "deno run --unstable-bundle -A jsr:@kartoffelgames/environment-cli@<version>"
    },
    "kg": {
        "root": true,
        "cli": [
            "jsr:@kartoffelgames/environment-command-help@<version>",
            "jsr:@kartoffelgames/environment-command-sync@<version>",
            "jsr:@kartoffelgames/environment-command-create@<version>",
            "jsr:@kartoffelgames/environment-command-bundle@<version>",
            "jsr:@kartoffelgames/environment-command-test@<version>",
            "jsr:@kartoffelgames/environment-command-bump@<version>",
            "jsr:@kartoffelgames/environment-command-page@<version>",
            "jsr:@kartoffelgames/environment-command-scratchpad@<version>",
            "jsr:@kartoffelgames/environment-command-transform@<version>",
            "jsr:@kartoffelgames/environment-blueprint@<version>"
        ],
        "packages": "./packages"
    }
}
```

### Root Configuration

| Field | Type | Description |
|-------|------|-------------|
| `root` | `boolean` | Must be `true`. Marks this `deno.json` as the monorepo root. |
| `cli` | `string[]` | List of CLI command and blueprint packages to load. Each entry is a JSR import path with version. |
| `packages` | `string` | Relative path to the directory containing all monorepo packages. |

## Usage

```
deno task kg <command> [flags] [parameters]
```

### Global Flags

These flags are available for all commands and control which packages a command targets:

| Flag | Description |
|------|-------------|
| `-a`, `--all` | Run the command for all packages in the monorepo. |
| `-p=@scope/name`, `--package=@scope/name` | Run the command for a single specific package. |
| `--debug` | Enable debug output. Prints project information on startup and full stack traces on errors. |

### Package Selection

Commands operate in one of two scopes depending on the flags provided:

- **Project-level** (no `-a` or `-p` flag): The command runs without a package context. Commands like `bump`, `create`, and `help` operate this way.
- **Package-level** (`-a` or `-p` flag): The command runs for one or all packages. Commands like `bundle`, `test`, `sync`, and `transform` require a package target.

### Examples

```bash
# Run a project-level command
deno task kg help
deno task kg bump -t minor

# Run a command for a single package
deno task kg test -p=@kartoffelgames/core

# Run a command for all packages
deno task kg bundle -a

# Run with debug output
deno task kg test -p=@kartoffelgames/core --debug
```

## Available Commands

| Command | Scope | Description | Package |
|---------|-------|-------------|---------|
| `help` | Project | Show all available commands. | `@kartoffelgames/environment-command-help` |
| `bump` | Project | Bump the root project version. | `@kartoffelgames/environment-command-bump` |
| `create` | Project | Scaffold a new package from a blueprint. | `@kartoffelgames/environment-command-create` |
| `sync` | Package | Sync package versions and configurations. | `@kartoffelgames/environment-command-sync` |
| `bundle` | Package | Bundle package source into JavaScript. | `@kartoffelgames/environment-command-bundle` |
| `test` | Package | Run package tests. | `@kartoffelgames/environment-command-test` |
| `page` | Package | Build and serve an HTML page. | `@kartoffelgames/environment-command-page` |
| `scratchpad` | Package | Serve a local scratchpad page. | `@kartoffelgames/environment-command-scratchpad` |
| `transform` | Package | Transform a package to another runtime. | `@kartoffelgames/environment-command-transform` |

See each command's own README for detailed usage and configuration.

## Package Configuration

Individual packages can provide command-specific configuration in their own `deno.json` under the `kg.config` section:

```jsonc
{
    "kg": {
        "name": "Scope.Package.Name",
        "source": "./source",
        "config": {
            "bundle": { ... },
            "test": { ... },
            "page": { ... },
            "scratchpad": { ... },
            "transform": { ... },
            "package-blueprint": "..."
        }
    }
}
```

Each command defines its own configuration structure and defaults. Refer to the respective command README for details.
