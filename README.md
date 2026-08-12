# KartoffelGames Environment

A build-environment toolchain for **Deno-based monorepos**. It provides a single, pluggable command-line interface (`kg`) that manages a workspace of packages: scaffolding new packages, bundling, testing, versioning, transforming to other runtimes, and serving live-reloading dev pages.

The whole system is modular: the CLI itself contains almost no command logic. Every command (and every project blueprint) lives in its own package that is loaded dynamically at runtime based on the root project's configuration. This means you can pick exactly the commands you need — and add your own.

## Quick start

Initialize a new monorepo project in an empty directory:

```bash
deno run -A jsr:@kartoffelgames/environment
```

This scaffolds a root project from the built-in project blueprint, asks for a project scope (e.g. `@example`), and wires up a `kg` task. Afterwards, list everything the CLI can do:

```bash
deno task kg help
```

## How it works

### The moving parts

The environment is split into three kinds of packages:

| Kind | Responsibility | Examples |
|------|----------------|----------|
| **Core** | Framework primitives shared by everything else. No commands. | `@kartoffelgames/environment-core` |
| **CLI host** | Parses the invocation, resolves the target project/packages, loads and runs the requested command. | `@kartoffelgames/environment-cli` |
| **Command / Blueprint plugins** | One responsibility each, loaded on demand. | `@kartoffelgames/environment-command-test`, `@kartoffelgames/environment-blueprint` |

### Execution flow

When you run `deno task kg <command> [flags]`:

1. The **CLI host** (`environment-cli`) trims the process arguments down to everything after the CLI entry file and parses the **global flags** (`-a`/`--all`, `-p`/`--package`, `--debug`).
2. It constructs a `Project` by walking **up** the directory tree until it finds the `deno.json` marked with `kg.root: true`. That file is the single source of truth for the monorepo.
3. It reads the `kg.cli` array from the root `deno.json` — a list of import paths to command and blueprint packages — and resolves the one whose `kg-cli.config.json` `name` matches the command word you typed.
4. It imports that package, instantiates its command class, validates your parameters against the command's declared parameter schema, and runs it — once per target package.

### Project vs. package scope

A command runs in one of two scopes, decided by the global flags:

- **Project scope** (no `-a`/`-p`): the command runs once with no package context. Used by `help`, `bump`, `create`.
- **Package scope** (`-p=@scope/name` for one, `-a` for all): the command runs once per selected package, receiving that `Package` handle. Used by `sync`, `build`, `test`, `page`, `scratchpad`, `transform`.

### Global flags

| Flag | Description |
|------|-------------|
| `-a`, `--all` | Run the command for every package in the monorepo. |
| `-p=@scope/name`, `--package=@scope/name` | Run the command for a single package (by full name or its normalized id). |
| `--debug` | Print project/package diagnostics on start and full stack traces on error. |

## Root project configuration

The root `deno.json` marks the monorepo and configures the CLI under a `kg` block:

```jsonc
{
    "version": "1.0.0",
    "workspace": [ "./packages/my-package" ],
    "tasks": {
        "kg": "deno run --unstable-bundle -A jsr:@kartoffelgames/environment-cli@<version>"
    },
    "kg": {
        "root": true,
        "packages": "./packages",
        "cli": [
            "jsr:@kartoffelgames/environment-command-help@<version>",
            "jsr:@kartoffelgames/environment-command-create@<version>",
            "jsr:@kartoffelgames/environment-blueprint@<version>"
        ]
    }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `kg.root` | `boolean` | Must be `true`. Marks this `deno.json` as the monorepo root. The CLI searches parent directories for it. |
| `kg.packages` | `string` | Relative path to the directory holding all packages. Package discovery scans one level deep for `deno.json` files here. |
| `kg.cli` | `string[]` | Import paths of the command and blueprint packages to load. Add an entry here to enable a command. |

## Package configuration

Each package has its own `deno.json`. In addition to the standard Deno fields, the environment reads a `kg` block:

```jsonc
{
    "name": "@example/my-package",
    "version": "1.0.0",
    "kg": {
        "name": "Example.My_Package",
        "source": "./source",
        "config": {
            "test": { "directory": "./test" },
            "page": { "enabled": false }
        }
    }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `kg.name` | `string` | The package **id** — a normalized name derived from `name` (e.g. `@example/my-package` → `Example.My_Package`). Used to target the package with `-p`. It is always recomputed from `name`. |
| `kg.source` | `string` | Relative path to the package source directory. Defaults to `./source`. |
| `kg.config` | `object` | Per-command configuration. Each command owns one key here (e.g. `test`, `page`, `transform`). Missing values are filled from the command's defaults. |

Each command defines its own configuration shape and defaults; see the per-command README. The `sync` command re-applies every command's default configuration into each package's `kg.config`, keeping the whole workspace aligned after a version bump or a schema change.

## The core package

`@kartoffelgames/environment-core` is the framework layer. Command packages depend on it rather than on Deno APIs directly. Its exported building blocks:

| Export | Purpose |
|--------|---------|
| `Project` | Represents the monorepo root. Finds the root `deno.json`, reads/saves configuration, enumerates and looks up packages, exposes `CliPackages`. |
| `Package` | Represents a single package. Reads/saves its `deno.json`, resolves source directory, and reads/merges per-command `kg.config`. Also converts a package name to its normalized id (`Package.nameToId`). |
| `CliPackages` | Discovers command/blueprint plugin packages from the root `kg.cli` list (via each plugin's `kg-cli.config.json`) and instantiates their command classes. |
| `CliCommand` | Wraps a resolved plugin command; validates parameters and runs it against a package. |
| `CliParameter` | Parses and validates the invocation into root/required/optional parameters, including the shared global flags. |
| `ICliPackageCommand` | The interface every command class implements: an `information` descriptor (parameters + configuration schema) plus a `run()` method. |
| `Import` | Dynamic `import()` helpers for modules, JSON, and resolving import specifiers to URLs/paths. |
| `Process` / `ProcessParameter` / `ProcessContext` | Spawn child processes (e.g. `deno test`), capture or inherit their I/O, and read the current process args / working directory. |
| `FileSystem` | Synchronous file/directory helpers: read/write, copy, glob, recursive find (forward **and** reverse/upward search), path conversion. |
| `Console` | Console output helpers: colored lines, banners, and validated prompts. |

### Anatomy of a command

Every command class implements `ICliPackageCommand`:

```typescript
import type { CliCommandDescription, CliParameter, ICliPackageCommand, Package, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand<MyConfig> {
    public get information(): CliCommandDescription<MyConfig> {
        return {
            command: {
                description: 'What this command does.',
                parameters: {
                    root: 'mycommand',                 // the word typed after `kg`
                    required: [],                       // positional args (no leading dash)
                    optional: {                         // named flags (--name / -n)
                        force: { shortName: 'f' }
                    }
                }
            },
            configuration: {                            // optional per-package config
                name: 'mycommand',                      // key inside kg.config
                default: { /* ... */ }
            }
        };
    }

    public async run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // pPackage is null in project scope, or a Package in package scope.
    }
}
```

- **`required`** parameters are positional and must not start with a dash.
- **`optional`** parameters are named flags. `shortName` enables a one-letter alias; a `default` makes the flag always present with that value.
- **`configuration`** (optional) declares a config block stored under `kg.config[name]` in each package's `deno.json`, with defaults filled in on read.

## The blueprint mechanic

Blueprints are the templates the `create` command uses to scaffold new packages (and the `init` flow uses to scaffold a whole project). They are pluggable the same way commands are.

A **blueprint package** declares itself with `"type": "blueprint"` in its `kg-cli.config.json` and points at a resolver class:

```json
{
    "type": "blueprint",
    "name": "my-blueprint",
    "packageBlueprints": { "resolveClass": "MyBlueprint" }
}
```

The resolver implements `ICliPackageBlueprintResolver` (from `@kartoffelgames/environment-command-create`):

- **`availableBlueprints()`** returns a `Map<string, URL>` of blueprint name → URL of a `.zip` file containing the template.
- **`afterCopy(parameter, project)`** runs after the CLI extracts the zip into the new package directory. This is where placeholders such as `{{PACKAGE_NAME}}`, `{{PACKAGE_ID_NAME}}`, `{{PACKAGE_FOLDER}}` and `{{PROJECT_FOLDER}}` are replaced.

When you run `kg create`, the command collects blueprints from **every** registered blueprint package, lets you pick one by name, unzips it into `packages/<id>/`, runs the resolver's `afterCopy`, and registers the new package in both the root `deno.json` workspace and the VS Code `*.code-workspace` file.

The bundled `@kartoffelgames/environment-blueprint` package ships the default `kg-main` template. See its README and the **create** README for the full custom-blueprint walkthrough.

## Extending your project

### Add a command

1. Publish (or reference locally) a package that exports a class implementing `ICliPackageCommand`.
2. Give it a `kg-cli.config.json` with `"type": "command"`, a unique `name` (the command word), and `commandEntryClass` (the exported class name).
3. Export both the class and the config from the package's `deno.json` `exports`.
4. Add the package's import path to `kg.cli` in your root `deno.json`.

The command word is now available as `deno task kg <name>`. The **create** README contains a complete, copy-pasteable example.

### Add a blueprint

Follow the same steps but with `"type": "blueprint"` and a `packageBlueprints.resolveClass` entry pointing at an `ICliPackageBlueprintResolver` implementation, then register it in `kg.cli`. Full walkthrough in the [create command README](./packages/kartoffelgames.environment.command_create/README.md).

## Repository layout

All packages live under [`packages/`](./packages). The CLI host and core are the foundation; everything prefixed `command_` is a loadable command; `blueprint` is the default blueprint provider; `bundle` is the bundling engine used by several commands.

## Package documentation

| Package | Description |
|---------|-------------|
| [environment-cli](./packages/kartoffelgames.environment.cli/README.md) | The `kg` CLI host: argument parsing, project resolution, command loading, global flags. |
| [environment-command-help](./packages/kartoffelgames.environment.command_help/README.md) | `help` — list all registered commands with their parameters. |
| [environment-command-create](./packages/kartoffelgames.environment.command_create/README.md) | `create` — scaffold a new package from a blueprint (includes the custom-blueprint guide). |
| [environment-command-sync](./packages/kartoffelgames.environment.command_sync/README.md) | `sync` — align package versions and re-apply command config defaults. |
| [environment-command-build](./packages/kartoffelgames.environment.command_build/README.md) | `build` — build package files into distributable artifacts by type (e.g. `bundle`). |
| [environment-command-test](./packages/kartoffelgames.environment.command_test/README.md) | `test` — run package tests with optional coverage and inspector. |
| [environment-command-page](./packages/kartoffelgames.environment.command_page/README.md) | `page` — build and serve a live-reloading HTML page to disk. |
| [environment-command-scratchpad](./packages/kartoffelgames.environment.command_scratchpad/README.md) | `scratchpad` — serve an in-memory live-reloading scratch page. |
| [environment-command-bump](./packages/kartoffelgames.environment.command_bump/README.md) | `bump` — bump the root project version. |
| [environment-command-transform](./packages/kartoffelgames.environment.command_transform/README.md) | `transform` — transform a package to another runtime (Node.js via dnt). |

> Note: `@kartoffelgames/environment-core`, `@kartoffelgames/environment-bundle`, `@kartoffelgames/environment-blueprint` and the `@kartoffelgames/environment` init package do not ship their own README. Core is summarized in [The core package](#the-core-package) and the blueprint provider in [The blueprint mechanic](#the-blueprint-mechanic). `@kartoffelgames/environment-bundle` is the bundling engine used internally by the `page` and `scratchpad` commands.

## License

LGPL-3.0-only. See [LICENSE](./LICENSE).
