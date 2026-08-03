# BrightScript Simulator (brs-desktop) Architecture Document

## Overview
The **BrightScript Simulator Desktop Application** (`brs-desktop`) is a cross-platform desktop application designed to emulate a Roku device interface and execute Roku channel apps (written in BrightScript and SceneGraph). 

At its core, the application is built on top of **Electron**, acting as a desktop wrapper for the **`brs-engine`** (the simulation execution engine) and **`brs-scenegraph`** (the Roku SceneGraph XML layout extension). The main purpose of the desktop application is to extend `brs-engine` into a fully integrated local environment, supporting automated deployment, interactive telnet debugging, and network control APIs identical to a physical Roku box.

---

## High-Level Architecture & Process Model
`brs-desktop` conforms to Electron's multi-process model. It segregates logic between a single, privileged Node.js **Main Process** (backend) and one or more sandboxed **Renderer Processes** (frontend UI).

### Process & Communication Topology

```mermaid
graph TD
    subgraph Developer Desktop / Local Network
        VSCode["VS Code (BrightScript Extension)"]
        TelnetCli["Telnet Client (Terminal / PuTTY)"]
        Browser["Web Browser (sideloading & config)"]
    end

    subgraph Electron Main Process (Node.js)
        Main["main.js (App Bootstrap & Windows)"]
        Settings["settings.js (Preferences Manager)"]
        ECP["ecp.js (SSDP & REST API - Port 8060)"]
        Installer["installer.js (HTTP sideload - Port 80/custom)"]
        Telnet["telnet.js (Telnet Console - Port 8085)"]
        Screen["remotescreen.js (WebRTC Screen - Port 8090)"]
    end

    subgraph Electron Renderer Process (Chrome / Web Workers)
        Preload["preload.js (Secure contextBridge)"]
        App["app.js / index.html (Main Simulator UI)"]
        Canvas["HTML5 Canvas (Simulation display)"]
        Engine["brs-engine & brs-scenegraph"]
        Editor["editor.js / editor.html (Monaco Editor)"]
    end

    %% Network interactions
    VSCode -.->|SSDP discovery & ECP controls| ECP
    VSCode -.->|Telnet console debugging| Telnet
    TelnetCli -.->|Interactive MicroDebugger commands| Telnet
    Browser -.->|Sideload zip/bpk & Take Screenshots| Installer
    Browser -.->|WebRTC video feed & signaling| Screen

    %% Internal Electron communications
    Main <-->|IPC IPC-Channels| Preload
    Preload <-->|window.api object| App
    Preload <-->|window.api object| Editor
    App <-->|Direct JS Calls / Worker message| Engine
    Engine -->|Web Worker frame updates| Canvas
    
    %% Main process components control
    Main --> ECP
    Main --> Installer
    Main --> Telnet
    Main --> Screen
    Screen <-->|Signaling relayed over IPC| Preload
    Canvas -->|captureStream mirror| App
```

---

## Core Process & Module Breakdown

### 1. Main Process (Backend Orchestration)
The **Main Process** (`src/main.js`) handles application lifecycle, creates browser windows, reads/writes preferences, and launches background servers mimicking Roku hardware services.

*   **Window Management (`src/helpers/window.js`)**: Creates the primary simulator window (`index.html`) and auxiliary windows like the **Code Editor & Console** (`editor.html`). Saves window dimensions and states across restarts.
*   **Security & SharedArrayBuffer Support**: By default, Electron disables certain cross-origin features. To allow `brs-engine` to run in multithreaded environments with `SharedArrayBuffer`, the Main Process registers response headers to implement **Cross-Origin Opener Policy (COOP)** and **Cross-Origin Embedder Policy (COEP)**:
    ```javascript
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        details.responseHeaders["Cross-Origin-Opener-Policy"] = ["same-origin"];
        details.responseHeaders["Cross-Origin-Embedder-Policy"] = ["require-corp"];
        details.responseHeaders["Cross-Origin-Resource-Policy"] = ["cross-origin"];
        callback({ responseHeaders: details.responseHeaders });
    });
    ```
*   **Settings Persistence (`src/helpers/settings.js`)**: Uses `@lvcabral/electron-preferences` to handle user-customizable settings (display resolution, overscan mode, audio mute, localization, remote controller key assignments, and remote services ports).

---

### 2. Renderer Process & Simulation Engine (Frontend Core)
The **Renderer Process** handles UI rendering and executes the simulation runtime. It communicates with the Main Process via `preload.js`.

*   **Simulation Core (`src/app/app.js` & `src/app/brightscript.js`)**:
    *   Initializes `brs-engine` and hooks into its event listeners.
    *   Feeds device metadata (serial numbers, display configuration, mock network properties) into the engine's initialization pipeline.
    *   Binds event handlers for mouse clicks, keyboard remote shortcuts, and gamepads to emulate the physical Roku remote.
    *   Handles audio volume management and coordinates virtual volume mounts (mounting `.zip` archives to `ext1:/`).
*   **Roku SceneGraph Support**: Passes the `brs-sg.js` extension library path during initialization to support Roku OS SceneGraph XML components (experimental alpha).
*   **Status Bar Module (`src/app/statusbar.js`)**: Updates real-time diagnostic indicators (audio state, listening network ports, localization locales, and CPU/FPS counters).

---

### 3. Integrated Development Environment (IDE)
The IDE is implemented inside the **Editor Window** (`src/app/editor.html`), giving developers a quick-testing workspace.

*   **Editor Controller (`src/app/editor.js`)**: Orchestrates file loading/saving and links the console to the simulation engine.
*   **Monaco Engine Integration (`src/app/monaco.js`)**: Loads and configures Microsoft Monaco Editor.
*   **BrightScript Language Support (`src/app/brightscript.js`)**: Defines custom syntax highlighting tokens (Monarch grammar rules), autocomplete tags for `roXXX` built-in components, and formatting/indentation configurations specifically tailored for BrightScript.

---

## Background Emulator Services
To make the simulator behave like a real Roku device on the local network, the Main Process spins up four Node.js background services:

### A. ECP Server (`src/server/ecp.js`)
Emulates Roku's **External Control Protocol** (REST API) and **SSDP** (Simple Service Discovery Protocol).
*   **SSDP Discovery**: Uses `@lvcabral/node-ssdp` to multicast UPnP device discovery notifications (`roku:ecp`). This allows external tools like the **VS Code BrightScript extension** to auto-detect the running simulator on the local network.
*   **REST Routing (`restana`)**: Listens on TCP port `8060`. Exposes specific endpoints mimicking physical devices:
    *   `GET /query/device-info` — XML payload containing serial number, model, locale, country, time-zone, firmware, and developer ID.
    *   `GET /query/apps` — List of all sideloaded/recent channels.
    *   `POST /launch/:appID` — Direct deep-linking app launch triggers.
    *   `POST /keypress/:key` — Dispatches remote button presses (`Home`, `Back`, `Play`, `Up`, `Down`, etc.).
*   **ECP-2 WebSockets**: Listens on `/ecp-session` to enable WebSocket commands. Replicates challenges/handshakes requested by official mobile applications.

### B. Application Sideload Web Installer (`src/server/installer.js`)
Emulates the **Roku Developer Web Panel** typically accessed on physical TVs to sideload application archives.
*   **HTTP Server & Basic Authentication**: Runs on port `80` (or user-defined port). Protects pages using **MD5 Digest Authentication** (Default credentials: `rokudev`/`rokudev`).
*   **Package Processing (`busboy`)**: Parses incoming multipart form streams to upload, delete, and replace the active channel executable archive (`dev.zip` or `dev.bpk`). Saves payloads to the local app data folder and triggers automatic simulation reloads.
*   **Screenshot Utility**: Mimics Roku's mock utilities by extracting the active canvas viewport buffer and exporting it as `dev.png`.

### C. Telnet Debug Server (`src/server/telnet.js`)
Emulates the Roku **MicroDebugger** command shell on port `8085`.
*   **TCP Connection Socket (`net` module)**: Accepts multiple local client streams. Broadcasts standard terminal debugger feeds to connectable shell clients (Terminal, Command Prompt, or PuTTY).
*   **MicroDebugger Interface**: Relays key events and text inputs between telnet connections and the running BrightScript process, executing commands such as:
    *   `bt` (print callstack backtrace)
    *   `var` (dump local variables)
    *   `threads` (view execution threads)
    *   `cont` or `c` (continue running)
    *   `step` or `s` (step instruction)

### D. Remote Screen Server (`src/server/remotescreen.js`)
Streams the simulator display to a browser over **WebRTC** on port `8090`. This one has **no Roku counterpart** — a physical device offers nothing equivalent.
*   **Single-Port HTTP + WebSocket**: A plain `node:http` server serves the viewer page (`src/app/web/remote.html`, `remote.css`, `remote.js`) and a `/config` JSON document, while a `ws` server attached with `{ noServer: true }` handles the `/rtc-session` signaling channel through a manual `upgrade` handler.
*   **Signaling Relay**: A TCP listener can only exist in the Main Process; `RTCPeerConnection` and `captureStream()` only in the Renderer. So the Main Process merely relays: `rtcViewerJoined` / `rtcViewerLeft` / `rtcSignal` over IPC, with the **Renderer as the offerer** because it owns the media track (`src/app/webrtc.js` manages the peer connections, `src/app/mirror.js` the frame source). Because offers are only ever sent on join, two channels close the gaps in that one-shot handshake: `rtcReady` (Renderer -> Main) re-announces sessions that connected before the Renderer's handlers existed, and `rtcSessionFailed` (Renderer -> Main) drops the socket of a peer connection that died, so the viewer reconnects instead of holding a slot.
*   **Fixed-Size Mirror Canvas**: `#display`'s backing store is resized on every `brs.redraw()`, so capturing it directly would renegotiate the stream on every window resize. `mirror.js` keeps a hidden canvas sized from the display mode (720x540 / 1280x720 / 1920x1080).
*   **Event-Driven Frames (requires `brs-engine` >= 2.4.0)**: the engine repaints only when the running app draws something, so a settled SceneGraph app posts no frames at all while a busy one posts at 60fps — sampling on a timer was therefore both late and wasteful, and a static menu app took seconds to update remotely. `mirror.js` instead enables the engine's `frame` event (`brs.setFrameNotify(true)`, only while a viewer is connected) and copies `brs.getDisplayBuffer()` on each one. That buffer is the canvas the visible display is drawn *from*: always at the display mode's native resolution and free of overscan guidelines, where `#display` may be scaled down to the window and would stream blurry. The captured track is taken at `captureStream(0)` and pushed explicitly with `requestFrame()`, so no browser sampling clock sits between a repaint and the wire; a 1s keepalive plus a push on viewer join keeps the encoder fed while an app is idle. Blanking the display is reported as a separate `cleared` event and handled by blanking the mirror, *not* by copying the buffer: the engine leaves the buffer holding the last drawn image, so treating it as a frame would leave the viewer looking at an app that had already exited.
*   **Input**: Remote buttons are `POST`ed by the page straight to **ECP on port 8060** with `mode: "no-cors"`, so the service is only fully useful with ECP also enabled; text entry `POST`s to this service's own `/paste`, which reuses the Renderer's existing `pasteText` queue.
*   **Unauthenticated, therefore opt-in**: the only gate is the `services.remoteAccess` local-only toggle, enforced per HTTP request, at WS upgrade, and by dropping already-open remote sessions when the setting flips. It is the **one service whose default is disabled** (`services.screen` is `[]`), and it caps concurrent viewers at four.

---

## Secure Bridge Configuration (IPC)
To keep the execution environment safe, code running in the Chromium Renderer cannot call native Node APIs or access Electron internal configurations directly. **Preload** (`src/app/preload.js`) uses `contextBridge` to expose a restricted, whitelisted communication interface:

| IPC Channel Name | Direction | Primary Purpose |
| :--- | :--- | :--- |
| `telnet` | Renderer -> Main | Forwards logging stdout strings to the active Telnet socket clients. |
| `saveScreenshot` | Renderer -> Main | Requests filesystem write of screenshot binary streams. |
| `deviceData` | Renderer -> Main | Synchronizes device model configurations to the REST ECP server. |
| `runFile` / `runUrl` | Renderer -> Main | Triggers compilation/execution of a side-loaded package or script. |
| `executeFile` | Main -> Renderer | Instructs `brs-engine` to load and run a channel package. |
| `postKeyPress` | Main -> Renderer | Relays keydown/keyup events received from the ECP API server. |
| `mountExternalVolume` | Main -> Renderer | Requests virtual attachment of a mock external drive file buffer. |
| `rtcSignal` | Both directions | Relays WebRTC offers, answers and ICE candidates between the Renderer's peer connections and a Remote Screen viewer socket. |
| `rtcViewerJoined` / `rtcViewerLeft` | Main -> Renderer | Announces a Remote Screen viewer arriving or leaving, so the Renderer creates or tears down its peer connection. |
| `rtcReady` | Renderer -> Main | Announced once the Renderer's signaling handlers are live, prompting the Main Process to re-announce every already-open session. `rtcViewerJoined` is fire-and-forget, so a viewer that connected before that point would otherwise wait forever for an offer. |
| `rtcSessionFailed` | Renderer -> Main | Reports a peer connection the Renderer could not build or that ICE gave up on, so the Main Process closes the socket instead of letting a dead peer hold one of the four viewer slots. |

---

## Data Directories & Configuration
*   **Preferences Storage**: Configs are stored as JSON structures via Electron's default app settings engine.
*   **Sideload Directory**: Temporary sideloaded channels (`dev.zip` / `dev.bpk`) and screenshots (`dev.png`) are cached in Electron's standard user data directory:
    *   **macOS**: `~/Library/Application Support/brs-desktop/`
    *   **Windows**: `%APPDATA%\brs-desktop\`
    *   **Linux**: `~/.config/brs-desktop/`

## Automated Testing
The project is covered by a [Vitest](https://vitest.dev) suite, run with `npm test` (`npm run test:watch` while developing, `npm run test:coverage` for a report). It is organised in two layers:

*   **Unit specs** (`test/unit/**`) mirror the `src/` tree and exercise pure logic: the Roku firmware-version decoder, digest-authentication arithmetic, key-code conversion, ECP payload builders, the debug shell's help and key tables, and the recent-files store.
*   **Integration specs** (`test/integration/**`) start the real network services in-process — ECP REST and its ECP-2 WebSocket, the web installer, the telnet console, the debug command shell and the Remote Screen HTTP/signaling server — and drive them over genuine sockets. Each binds an ephemeral port supplied by `getFreePort()`, so the suites can run concurrently and never collide with a running simulator.

**Electron is never launched.** `vitest.config.mjs` aliases the `electron` module, `@electron/remote`, `@lvcabral/electron-preferences`, `@lvcabral/node-ssdp`, `network`, `electron-prompt` and `electron-about-window` to hand-written stubs in `test/mocks/`. Stubbing SSDP in particular removes UDP multicast from the test run, which would otherwise be both a permissions hazard and a source of flakiness on CI. Assertions about main-to-renderer traffic go through the fake window's `webContents.send` spy; renderer-to-main handlers are driven with `ipcMain.emit(channel, {}, payload)`.

Two characteristics of this codebase shape how tests must be written. First, several modules register their `ipcMain` handlers at module-evaluation time and cannot re-register them, so a blanket `ipcMain.removeAllListeners()` in a shared hook will quietly disable the code under test. Second, handlers that read bundled assets through `path.join(__dirname, …)` resolve against `src/` under the test runner rather than the webpack bundle's `app/`, so those specific routes fail only in tests; the affected cases are marked as such.

There is deliberately **no end-to-end layer**. Window management, menus, and anything visual are not covered, and still require running the application to verify. The same is true of Remote Screen's media path: with Electron aliased away there is no DOM canvas, no `captureStream()` and no `RTCPeerConnection`, so the suite covers the server, the signaling relay and the local-only guards, but the video itself can only be checked by running the app and opening the viewer page.
