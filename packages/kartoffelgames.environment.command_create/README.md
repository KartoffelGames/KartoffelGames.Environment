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

## Configuration

After a package is created, the blueprint name is stored in the package's `deno.json` under `kg.config.package-blueprint`:

```jsonc
{
    "kg": {
        "config": {
            "package-blueprint": "kg-main"
        }
    }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `package-blueprint` | `string` | `""` | The name of the blueprint used to create this package. |

## Creating a Custom Blueprint Package

Blueprints are pluggable. You can create your own blueprint package to provide custom templates for the `create` command.

### Package Structure

```
my-blueprint-package/
├── deno.json
├── kg-cli.config.json
├── source/
│   ├── index.ts
│   └── my-blueprint.ts
└── blueprint/
    └── my-template.zip
```

### 1. Implement the Blueprint Resolver

Create a class that implements the `ICliPackageBlueprintResolver` interface from `@kartoffelgames/environment-command-create`:

```typescript
import type {
    CliPackageBlueprintParameter,
    ICliPackageBlueprintResolver
} from '@kartoffelgames/environment-command-create';
import { FileSystem, type Project } from '@kartoffelgames/environment-core';

export class MyBlueprint implements ICliPackageBlueprintResolver {
    /**
     * Returns all available blueprints.
     * Each entry maps a blueprint name to a URL pointing to a ZIP file.
     */
    public availableBlueprints(): Map<string, URL> {
        const blueprints = new Map<string, URL>();
        blueprints.set('my-template', new URL('../blueprint/my-template.zip', import.meta.url));
        return blueprints;
    }

    /**
     * Called after the blueprint ZIP is extracted into the new package directory.
     * Use this to replace placeholders or perform other post-processing.
     */
    public async afterCopy(pParameter: CliPackageBlueprintParameter, pProject: Project): Promise<void> {
        const fileList = FileSystem.findFiles(pParameter.packageDirectory);

        for (const filePath of fileList) {
            let content = FileSystem.read(filePath);

            content = content
                .replaceAll('{{PACKAGE_NAME}}', pParameter.packageName)
                .replaceAll('{{PACKAGE_ID_NAME}}', pParameter.packageIdName);

            FileSystem.write(filePath, content);
        }
    }
}
```

The `afterCopy` handler receives a `CliPackageBlueprintParameter` with the following fields:

| Field | Description |
|-------|-------------|
| `packageName` | Full package name (e.g., `@scope/package-name`). |
| `packageIdName` | Normalized ID derived from the package name (e.g., `Scope.Package_Name`). |
| `packageDirectory` | Absolute path to the directory where the blueprint was extracted. |

### 2. Export the Resolver

In `source/index.ts`, export the resolver class:

```typescript
export { MyBlueprint } from './my-blueprint.ts';
```

### 3. Create the CLI Config

Create a `kg-cli.config.json` that registers the package as a blueprint provider:

```json
{
    "type": "blueprint",
    "name": "my-blueprint",
    "packageBlueprints": {
        "resolveClass": "MyBlueprint"
    }
}
```

| Field | Description |
|-------|-------------|
| `type` | Must be `"blueprint"`. |
| `name` | A unique name for this blueprint package. |
| `packageBlueprints.resolveClass` | The name of the exported class that implements `ICliPackageBlueprintResolver`. |

### 4. Configure deno.json

```jsonc
{
    "name": "@scope/my-blueprint-package",
    "version": "1.0.0",
    "exports": {
        ".": "./source/index.ts",
        "./kg-cli.config.json": "./kg-cli.config.json"
    },
    "publish": {
        "include": [
            "source/",
            "blueprint/",
            "deno.json",
            "kg-cli.config.json"
        ]
    }
}
```

The `exports` must include both the main source entry and the `kg-cli.config.json`.

### 5. Create the Blueprint ZIP

Create a ZIP file containing the template files for the new package. Files can include placeholders (e.g., `{{PACKAGE_NAME}}`) that get replaced by the `afterCopy` handler.

### 6. Register the Blueprint

Add the blueprint package to the root `deno.json` `kg.cli` array:

```jsonc
{
    "kg": {
        "cli": [
            "jsr:@kartoffelgames/environment-command-create@<version>",
            "jsr:@scope/my-blueprint-package@<version>"
        ]
    }
}
```
