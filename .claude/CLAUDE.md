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
npm test               # vitest run — unit + service integration tests
npm run test:watch     # vitest watch mode
npm run test:coverage  # v8 coverage into coverage/
npm run lint           # eslint (flat config in eslint.config.mjs)
npm run lint:fix       # eslint --fix
npm run prettier       # prettier --check
npm run prettier:write # prettier --write
```

**Always run `npm run lint` and `npm run prettier` before committing**, and fix what they report —
CI runs both, and a formatting-only diff on a later PR re-attributes untouched code to that PR's new
code in SonarCloud (see below). `npm run lint:fix` and `npm run prettier:write` handle most of it.

Other `dist-*` scripts target Windows / Linux (appimage, deb, arm). Installers must be built on their
native OS.

CLI args can be appended to `npm run start` (e.g. `npm run start -- --devtools --console -m hd`); see
`docs/how-to-use.md` for the full list (`-o/-f/-m/-e/-r/-w/-p/-c/-d`).

## Tests

Tests run on **Vitest** (`test/**/*.spec.js`, config in `vitest.config.mjs`). Two layers:

- `test/unit/**` mirrors the `src/` tree and covers pure logic.
- `test/integration/**` boots the real ECP, web installer, telnet and debug servers in-process on
  **ephemeral ports** against a fake window, and drives them over real sockets.

There is **no E2E/Playwright layer**. Window behaviour, menus and anything visual still have to be
verified by running the app — `npm test` passing does not mean the UI works.

**Electron is never loaded.** `vitest.config.mjs` aliases `electron`, `@electron/remote`,
`@lvcabral/electron-preferences`, `@lvcabral/node-ssdp`, `network`, `electron-prompt` and
`electron-about-window` to stubs in `test/mocks/`. Mocking SSDP is what keeps UDP multicast out of CI.
`test/setup/global.js` polyfills `process.getSystemVersion()`, points `app.getPath("userData")` at a
temp dir, and installs a fresh `globalThis.sharedObject` before each test.

Two traps worth knowing:

- Several modules register `ipcMain` handlers **at module-evaluation time** and can never re-register.
  Do not call `ipcMain.removeAllListeners()` in a shared hook — it silently disables the code under
  test. Drive those handlers with `ipcMain.emit(channel, {}, payload)`.
- Routes that read bundled assets via `path.join(__dirname, …)` resolve to `src/` under vite-node
  rather than the webpack bundle's `app/`, so they fail in tests only. Those cases are marked.

When adding an IPC channel, a `gen*Xml` builder, or a debug command, add the matching test — the
whitelist-parity, XML and command-shell specs are the guardrails for those three contracts.

### Static analysis (SonarCloud)

Every PR is gated on SonarCloud's **new code** Quality Gate: A ratings for security, reliability and
maintainability, and hotspots 100% reviewed. The project key is `lvcabral_brs-emu-app`, which does not
match the repo name. Query findings with `resolved=false`, or already-closed issues come back too and
the list looks far worse than it is:

```bash
gh pr checks <PR>
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=lvcabral_brs-emu-app&pullRequest=<PR>&resolved=false&ps=100"
```

**Moving code re-attributes it to new code**, so an extraction can pull an existing finding onto your
PR without you having written anything new. Check what a finding points at before assuming you caused it.

Rules this codebase trips most often, worth writing to up front:

| Rule | What it wants |
| --- | --- |
| S4790 | No weak hashes (MD5, SHA-1). Where a wire protocol mandates one, route every call through a single helper carrying the justification, so there is one documented exemption instead of many. |
| S5443 | No fixed path under a shared temp directory. Use `fs.mkdtempSync(path.join(os.tmpdir(), …))` — unique and owner-only. |
| S1313 | No hardcoded IP addresses. In fixtures and docs use the RFC 5737 ranges (`192.0.2.0/24`); loopback and subnet masks are fine. |
| S2699 | Every test needs at least one explicit `expect()`. A helper that throws on timeout does not count — assert the outcome after awaiting it. Empty `it.skip` bodies are flagged too; a comment explaining the gap says more. |
| S4123 | `@returns` on an `async` function must be `Promise<T>`. Type inference reads JSDoc and trusts it over the `async` keyword, so a wrong annotation makes correct `await` code look like a bug. |
| S3776 | Keep cognitive complexity under 25. A lookup table beats a long `switch` or `else if` chain. |
| S8786 | No super-linear regex on externally supplied input. Measure before rewriting: emulated atomic groups remove backtracking inside a pattern but not the cost of a global scan retrying every start position. |
| S1128 | Remove the imports a refactor leaves behind. |
| S6594, S6353 | `RegExp.test()` or `.exec()` over `String.match()`; `\d` over `[0-9]`. |
| S7755, S7771 | `.at(-1)` and negative `splice` indices over `length - n`. |
| S7781, S7780, S7757 | `replaceAll` over `replace(/…/g)`; `String.raw` over escaped backslashes; class fields over constructor assignment of constants. |

When a finding is deliberately left open, record why in a comment at the code rather than only in the
PR description — the next person to meet it will be reading the file, not the pull request.

### `npm audit`

`npm audit` reports ~10 high findings; `npm audit --omit=dev` reports **0** — nothing vulnerable ships.
All residual findings are one dev-only chain: `electron-builder` → `app-builder-lib` →
`electron-builder-squirrel-windows` → `electron-winstaller` → `temp` → `rimraf@2` → `glob@7` →
`minimatch@3` → `brace-expansion@1`. There is **no upstream fix**: `temp@0.9.4` is current and still
pins `rimraf ~2.6.2`, and `electron-builder-squirrel-windows` is a non-optional peer dep of
`app-builder-lib` (npm installs it; this project builds NSIS, never Squirrel). Don't try to "fix" these:

- Never override `brace-expansion` to 5.x or `minimatch` to 10.x globally — their CJS entries export
  objects, while `minimatch@3/5` and `glob@7` call them as functions. It resolves the audit and breaks
  the build at runtime.
- The `overrides` block in `package.json` is deliberate; `@electron/asar@4` + `@electron/universal@3`
  mirror what `electron-builder@27-alpha` uses upstream and require Node >=22.12.
- `npm audit fix --force` wants to *downgrade* dependencies. Don't run it.

Revisit when `electron-builder@27` ships stable.

Vitest and `@vitest/coverage-v8` (Vite + esbuild + rollup) add nothing to that chain — the finding
count is unchanged and `npm audit --omit=dev` is still 0. Re-check after bumping them.

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

Default ports live in `src/constants.js`, not scattered literals. Each service takes the port as an
optional trailing parameter defaulting to that constant — `enableECP(win, port)`,
`enableTelnet(win, port)`, `enableDebugServer(win, prefs, port)`, and `setPort()` for the installer
(whose default, 80, is privileged). Integration tests rely on this to bind ephemeral ports; don't
reintroduce a hard-coded `listen(CONSTANT)`.

The Electron-free halves live alongside: `src/server/debugHelp.js` (help text), `src/server/debugKeys.js`
(the `press` character map) and `src/helpers/digest.js` (both the server and client sides of digest auth).

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
- ESM (`import`/`export`) everywhere under `src/`, except `preload.js` and `preloadKeys.js`
  (CommonJS, copied unbundled — `preloadKeys.js` holds the IPC channel whitelists and the key
  conversion that mirrors `src/helpers/keyCodes.js`) and `build/*.js` (CommonJS).
- 4-space indent in `src/` (see `.vscode/settings.json`), 2-space in `build/`. Both are enforced by
  Prettier (config block in `package.json`, ported from `brs-engine`: `tabWidth` 4, `printWidth` 120,
  `trailingComma` es5, with a `build/**/*.js` override at `tabWidth` 2) — don't hand-format.
- `eslint.config.mjs` is flat config and ports the JS-applicable half of `brs-engine`'s `.eslintrc.js`
  (the `@typescript-eslint` rules have no meaning here). `eslint-config-prettier` is last in the array
  so Prettier alone owns formatting; keep it there. Renderer globals injected by preload (`api`,
  `__setTheme`) and `electron` as an `import/core-modules` entry are declared there rather than
  suppressed at each call site. A rule that must be disabled gets an `eslint-disable-next-line` with
  the reason at the code, as in `src/helpers/hash.js`.
- LF line endings everywhere, enforced by `* text=auto eol=lf` in `.gitattributes`.
- Node builtins are imported with the `node:` prefix.

## Other AI/agent docs in this repo

`GEMINI.md` and `.github/copilot-instructions.md` describe the same architecture in more prose and are
kept in sync with the source. Prefer the source when they disagree.
