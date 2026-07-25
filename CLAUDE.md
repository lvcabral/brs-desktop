# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`brs-desktop` is an Electron desktop wrapper around the **`brs-engine`** npm package (the BrightScript
simulation engine) plus **`brs-scenegraph`** (SceneGraph XML extension, alpha). Its job is to turn the
engine into a full Roku *device* simulator: network services (ECP/SSDP, web installer, telnet debugger),
device settings/persistence, menus, and an integrated Monaco-based code editor + console.

Language/runtime issues (BrightScript semantics, `roXXX` components) belong to `brs-engine`, not this repo.

## Commands

```bash
npm install            # postinstall runs electron-builder install-app-deps
npm run start          # dev mode: webpack watch (build/start.js) + spawns electron on first successful build
npm run build          # webpack dev build into app/
npm run release        # webpack production build into app/ (what CI runs)
npm run dist           # production build + electron-builder installers for the current platform -> dist/<version>/
npm run clean          # wipe app/
```

Other `dist-*` scripts target Windows / Linux (appimage, deb, arm). Installers must be built on their
native OS.

CLI args can be appended to `npm run start` (e.g. `npm run start -- --devtools --console -m hd`); see
`docs/how-to-use.md` for the full list (`-o/-f/-m/-e/-r/-w/-p/-c/-d`).

There is **no test framework wired up**: `build/webpack.unit.config.js` and `build/webpack.e2e.config.js`
are leftovers from the electron-boilerplate template — there are no `*.spec.js` files, no `e2e/` folder,
and no `test` script. Don't claim tests were run; verify changes by running the app.

Releases: bump `package.json` version, update `CHANGELOG.md`, then `git tag -a vX.Y.Z && git push --follow-tags`.
The GitHub Actions workflow builds a draft release. Local notarized builds need the `.env` Apple
credentials and uncommenting `require('dotenv').config()` in `build/notarize.mac.js` (see `docs/release.md`).

## Architecture

### Process split

Everything under `src/` is bundled by webpack into `app/` — three entry points, two webpack configs:

| Entry | Config target | Output |
| --- | --- | --- |
| `src/main.js` | `electron-renderer` base, node externals | `app/main.js` (Electron main process) |
| `src/app/app.js` | same | `app/app.js` + `app/index.html` (simulator window) |
| `src/app/editor.js` | `web`, externals overridden so everything bundles | `app/editor.js` + `app/editor.html` |

`src/app/preload.js` is *copied*, not bundled (CommonJS `require` only, no ESM/import). Engine libs
(`brs.api.js`, `brs.worker.js`, `brs-sg.js`) are copied from `node_modules/brs-engine|brs-scenegraph`
into `app/lib/` by CopyWebpackPlugin — bumping those packages changes what ships without touching `src/`.

### Main process (`src/main.js` + `src/helpers/` + `src/menu/` + `src/server/`)

- Builds the canonical `deviceInfo` object (model, locale, display mode, network info, appList…) and
  parks it on `globalThis.sharedObject` alongside `theme` and `backgroundColor`. Renderer reads it via
  `@electron/remote`'s `getGlobal("sharedObject")` in preload. This is the shared-state backbone —
  changes to device config generally mean: update `sharedObject`, persist via settings, *and* push an
  IPC event to the renderer.
- Registers COOP/COEP/CORP response headers so the engine can use `SharedArrayBuffer` in its worker.
  Removing those headers breaks multithreaded execution.
- **The main simulator window is always `BrowserWindow.fromId(1)`.** Roughly 35 call sites rely on this;
  it is created first in `createWindow()`. The editor window is opened as a child via
  `setWindowOpenHandler` intercepting `editor.html`, not via a separate `createWindow` call.
- Window geometry persists to `window-state-<name>.json` in `app.getPath("userData")`.

### Renderer (`src/app/app.js`)

Owns the global `brs` object from `brs.api.js`: `brs.initialize(deviceInfo, options)`,
`brs.subscribe("desktop", handler)`, `brs.deviceData.*`, `brs.execute/terminate/debug/sendKeyPress/...`.
Engine events (loaded/started/closed/error/debug/redraw/control) are translated into UI updates,
status bar changes (`statusbar.js`), console output, and IPC back to main.

### IPC contract (`src/app/preload.js`)

`contextBridge` exposes `window.api` with **explicit channel whitelists** — `api.send()` has one list,
`api.receive()` another. Adding an IPC channel requires editing the corresponding whitelist in
`preload.js` *and* adding the `ipcMain.on(...)` handler (main side) or `webContents.send(...)` call.
Silently dropped messages with a `console.warn` about an "invalid channel" mean the whitelist wasn't updated.

`preload.js` also intercepts keyboard events in the **capture phase** (Cmd/Ctrl+V paste, the Home key
mapped to "close app") specifically to beat `brs-engine`'s bubbling-phase handlers. That ordering is
intentional — see `matchesKey`/`convertSettingsKey`, which mirror the key-name conversion in `settings.js`.

### Network services (`src/server/`, all in the main process)

Each service is a module with an observer registration function (`subscribeECP`, `subscribeInstaller`,
`subscribeTelnet`, `subscribeDebugServer`); `src/helpers/events.js` is the single subscriber that wires
service events back into settings/status/file-loading.

- `ecp.js` — ECP REST API + ECP-2 WebSockets + SSDP discovery (port 8060). This is what makes the VS Code
  BrightScript extension detect the simulator as a real Roku.
- `installer.js` — Roku web installer clone with MD5 digest auth (default `rokudev`/`rokudev`), port 80;
  handles `dev.zip`/`dev.bpk` upload and screenshots via `busboy`.
- `telnet.js` — plain console feed, port 8085.
- `debug.js` — MicroDebugger command shell (port 8080), implements the Roku debug command set
  (`bt`, `var`, `chanperf`, `sgnodes`, `press`, `type`, …).

Default ports live in `src/constants.js`, not scattered literals.

### Settings (`src/helpers/settings.js`, ~2.4k lines)

Uses `@lvcabral/electron-preferences`; stored as JSON in `app.getPath("userData")`. Sections:
`simulator`, `editor`, `services`, `device`, `remote`, `display`, `audio`, `localization`, `captions`,
`peerRoku`, `deepLinking`, `externalVolume`, `customization`. Accessed with dot notation
(`settings.value("device.deviceModel")`). Most settings need three things kept in sync: the preferences
schema, `globalThis.sharedObject.deviceInfo`, and an IPC push to the renderer — the `set*`/`get*`
exports at the bottom of the file are the established pattern for that.

### Editor window

Monaco-based (`src/app/monaco.js` + `src/app/editor.js`), with BrightScript Monarch grammar,
completions, and formatting in `src/app/brightscript.js`. Monaco is bundled by
`monaco-editor-webpack-plugin` with a deliberately trimmed feature list — enabling a Monaco feature
means editing that plugin config in `build/webpack.app.config.js`.

## Conventions

- All `src/` files start with the standard copyright header block; match it in new files.
- ESM (`import`/`export`) everywhere under `src/`, except `preload.js` (CommonJS, unbundled) and
  `build/*.js` (CommonJS).
- 4-space indent in `src/` (see `.vscode/settings.json`), 2-space in `build/`.
- Node builtins are imported with the `node:` prefix.

## Other AI/agent docs in this repo

`GEMINI.md` and `.github/copilot-instructions.md` describe the same architecture in more prose and are
kept in sync with the source. Prefer the source when they disagree.
