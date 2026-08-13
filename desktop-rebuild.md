# Desktop rebuild — design & plan

Rework the browser-build + serving story so a single client directory (`./app`) can be
**served as a web page** (dev + static hosting) and **packaged as a native desktop binary**
via Deno's experimental `deno desktop` (Deno ≥ 2.9), without a frontend framework.

## Core decisions

1. **Build entries have no `type`.** Every entry is just "bundle this TS file". All bundles land
   in one directory, so the type (which only ever picked an output directory) is gone.
2. **One output directory: `./app/bundle`.** Every bundle for a package goes here. The app has
   access to all of them by path, no manual cross-referencing.
3. **The client directory is `./app`.** It holds the user-authored `index.html`, CSS, assets and
   `source/` TS, plus the generated `bundle/` output.
4. **The dev command is renamed `page` → `app`.** It serves the *entire* `./app` directory as-is
   (no path rewrites), watches, rebuilds bundles, and live-reloads.
5. **Desktop packaging lives in the `build` command config** under `kg.config.build.desktop`.
   `desktop: null` (or absent) means no desktop binary is produced.
6. **`build` gains `--bundle-only`.** It skips the (heavy, experimental) desktop compile and only
   produces bundles. The `app` dev-server watch loop uses it so a file save re-bundles fast.
7. **Reload is a per-entry capability, not a type.** An entry marked `reloadable: true` *may*
   receive the live-reload client; it is only actually injected when the build runs with
   `--injectreload` (i.e. from `kg app`). Non-reloadable entries (e.g. web workers, which have no
   `window`/`location`) never get it. Production `kg build` injects nothing.
8. **Sharing build output between packages uses Deno-native `publish.include`.** A package that
   wants to publish its `./app/bundle` output lists it in `publish.include` in its `deno.json`.
   (No `exports`: the IIFE bundles are `<script>`-loaded, not importable modules. Cross-package
   *code* sharing already happens through Deno workspace source imports.)

## Config schema

```jsonc
{
  "kg": {
    "config": {
      "build": {
        "files": {
          "./app/source/index.ts":  { "name": "app",    "reloadable": true },
          "./app/source/worker.ts": { "name": "worker" }
        },
        "desktop": {
          "name": "My App",
          "identifier": "com.example.myapp",
          "icons":  { "windows": "./icons/app.ico", "macos": "./icons/app.icns", "linux": "./icons/app.png" },
          "output": { "windows": "./dist/MyApp",     "macos": "./dist/MyApp.app", "linux": "./dist/my-app" }
        }
      }
    }
  }
}
```

### `kg.config.build`

| Field | Type | Description |
|-------|------|-------------|
| `files` | `Record<string, BuildFile>` | Map of **input TS file** → bundle options. Each is bundled to `./app/bundle/<name>.js` (+ `.map`). |
| `desktop` | `Desktop \| null` | Desktop packaging config, or `null` to build no desktop binary. |

### `BuildFile`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | — | Output basename → `./app/bundle/<name>.js`. |
| `reloadable` | `boolean` | `false` | Entry *may* receive the live-reload client. Only injected when the build runs with `--injectreload`. Set `false` for workers / non-`window` bundles. |

### `Desktop`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Application display name. |
| `identifier` | `string` | Reverse-DNS app id (`com.example.myapp`). |
| `icons` | `{ windows?, macos?, linux? }` | Per-OS icon paths. |
| `output` | `{ windows?, macos?, linux? }` | Per-OS output paths; extension picks format (`.app`/`.dmg`/`.msi`/`.AppImage`/…). |
| `backend` | `"webview" \| "cef"` (optional) | Rendering backend. Default `webview`. |

The client directory is always `./app`, so `desktop` needs no `source` field.

Default config (filled by `sync`): `{ "files": {}, "desktop": null }`.

## Directory layout

```
<package>/
  app/
    index.html          # user-authored, loads /bundle/app.js
    index.css           # user-authored
    source/
      index.ts          # user-authored entry (bundled)
      worker.ts         # optional additional entry
    bundle/             # GENERATED — all bundles land here
      app.js  app.js.map
      worker.js worker.js.map
  dist/                 # GENERATED — desktop binaries (per output config)
```

## Command behaviour

### `kg build [-a | -p=…] [--bundle-only] [--injectreload]`

1. Read `kg.config.build`.
2. For every `files` entry: bundle the input TS → `./app/bundle/<name>.js` (+ `.map`).
   - If `--injectreload` **and** the entry is `reloadable`, wrap the entry with the live-reload
     client (temp wrapper entry importing the real file), otherwise bundle directly.
3. If **not** `--bundle-only` and `desktop` is not `null`: run the desktop packaging step.
4. Removed from the old build command: the `type` field, the `--type` filter, and the
   `library/bundle` vs `page/build` output split (all → `./app/bundle`).

Flags: `--bundle-only` (`-b`) skip desktop; `--injectreload` (`-r`) inject the reload client into
`reloadable` entries.

### `kg app [-a | -p=…]`

The dev server (formerly `page`). Always builds then serves; to build without serving use `kg build`.

1. Ensure `./app` exists (no scaffolding of files — the directory content is package-owned).
2. Initial bundle: run `build --bundle-only --injectreload` in-process.
3. Serve `./app` as-is over HTTP (static, `dir → index.html`, COOP/COEP headers kept for
   `SharedArrayBuffer`, websocket for reload). No path rewrites.
4. Watch package source + `./app` (ignoring `./app/bundle`); on change re-run
   `build --bundle-only --injectreload` and push `REFRESH` to connected browsers.

### Desktop packaging step (inside `build`)

For each configured `output` target:

1. Generate a temporary **server entrypoint** (TS): a headless version of the app HTTP server that
   serves the embedded `./app` directory from `import.meta.dirname` (reuse the current
   `PageHttpServer` file-serving + MIME + COOP/COEP logic; drop the websocket/reload).
2. Invoke `deno desktop <server-entry> --include-as-is ./app` mapped from the `desktop` config
   (`--output`, `--icon`, `--target`, backend). The `./app` directory (HTML + CSS + `bundle/`) is
   embedded into the binary's virtual filesystem and served by the generated entrypoint.
3. Emit the per-OS binary to the configured `output` path.

> `deno desktop` is **experimental** (Deno 2.9). Validate the exact flag/config surface against the
> installed Deno version during implementation; treat cross-compile & code-signing as opt-in.

## Reload injection truth table

| `--injectreload` (build) | entry `reloadable` | Client injected? |
|---|---|---|
| yes (via `kg app`) | `true`  | **yes** |
| yes (via `kg app`) | `false` | no |
| no (via `kg build`) | any    | no |

## Implementation plan

1. **Bundle output** — collapse the build command's per-type output dirs to a single
   `./app/bundle`. Remove `type` from entries and the `--type` filter.
2. **Build config shape** — change `kg.config.build` from a flat entry map to `{ files, desktop }`.
   Update `BuildConfiguration` types and the default (`{ files: {}, desktop: null }`).
3. **`reloadable`** — inject the reload client only when `--injectreload` is set *and* the entry is
   `reloadable`.
4. **`--bundle-only`** — add the flag; skip the desktop step when set.
5. **Desktop step** — implement the generate-server → `deno desktop --include-as-is ./app` → binary
   flow, mapped from `kg.config.build.desktop`. Skip entirely when `desktop` is `null`.
6. **Rename `page` → `app`**:
   - Package `kartoffelgames.environment.command_page` → `…command_app`
     (`deno.json` name `@kartoffelgames/environment-command-app`, `kg-cli.config.json` name `app`,
     `kg.name`).
   - Root `deno.json`: update the `kg.cli` entry and the `workspace` entry.
   - Command root parameter `page` → `app`; serve `./app`; remove `page`-file scaffolding
     (`initPageFiles` already removed).
   - Optional file renames: `page-http-server.ts` → `app-http-server.ts`,
     `page-file-watcher.ts` → `app-file-watcher.ts`.
7. **Reuse for desktop server** — factor the `PageHttpServer` file-serving into a form usable both
   by the dev server (with websocket/reload) and the generated desktop server entry (without).
8. **Docs** — rewrite the command READMEs (build: `files`/`desktop`, `--bundle-only`; app: serves
   `./app`, no rewrites, SharedArrayBuffer headers). Update the root README command table.
9. **Tests** — update `command_build` tests (new config shape, `reloadable`, `--bundle-only`,
   `./app/bundle` output; a desktop test likely gated on Deno version / marked slow) and the
   `app` command test (serves `./app`, reload injected into `reloadable` entries only). Migrate the
   repo's own package `kg.config.build` blocks via `sync`.

## Risks / open items

- **`deno desktop` is experimental** — API may shift; requires Deno ≥ 2.9. The desktop step should
  fail gracefully (clear message) on older runtimes.
- **Desktop build cost** — per-OS compile is heavy; `--bundle-only` keeps the dev loop fast, but
  `kg build -a` with desktop configured across many packages will be slow. Consider surfacing that.
- **Code signing** — real macOS signing must run on a macOS host; default is ad-hoc.
- **`reloadable` default** — chosen `false` (safe for workers). The common single-entry app must set
  `reloadable: true` on its main entry; document prominently.
- **Non-app / library packages** — a package with no `./app` simply configures no `files`/`desktop`
  and never runs `kg app`; its bundles (if any) still land in `./app/bundle` and can be published
  via `publish.include`.
