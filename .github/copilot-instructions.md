# BrightScript Simulator Desktop - AI Coding Instructions

## Project Overview
This is an Electron-based desktop application that simulates Roku devices for BrightScript development. It wraps the `brs-engine` library (imported as `brs-engine` npm package) and provides a complete Roku device simulator with networking services.

## Architecture

### Electron Process Structure

#### Main Process (`src/main.js`)
- **Application Lifecycle**: Electron app initialization, window creation, global state management
- **Device Information**: Creates unified `deviceInfo` object with Roku device specs, network config, localization
- **Server Orchestration**: Initializes and manages ECP, Installer, Telnet, Debug and Remote Screen servers
- **Menu System**: Platform-specific menu creation and IPC event routing
- **Settings Integration**: Loads/applies user preferences from JSON storage
- **Command Line Processing**: Handles startup arguments (devtools, console, files, etc.)
- **Global Shared State**: `globalThis.sharedObject` for cross-process data sharing

#### Main Process Helper Modules (`src/helpers/`)
- **`settings.js`**: ElectronPreferences integration, device configuration, UI themes
- **`window.js`**: Window management (create, focus, aspect ratio, screenshot, fullscreen)
- **`files.js`**: File loading (ZIP/BPK packages, BRS source), recent files management
- **`console.js`**: Telnet server integration, debug message routing
- **`dialog.js`**: Native file dialogs (open packages, save screenshots)
- **`about.js`**: About window with version information
- **`util.js`**: Network utilities (local IPs, gateway detection)
- **`roku.js`**: Peer Roku device communication via ECP

#### Main Process Menu System (`src/menu/`)
- **`menuService.js`**: Central menu management, recent files, context menus
- **`*MenuTemplate.js`**: Platform-specific menu definitions (File, Edit, Device, View, Help)
- **`macOSMenuTemplate.js`**: macOS-specific application menu structure

#### Renderer Process (`src/app/app.js`)
- **BRS Engine Interface**: Global `brs` object initialization and event subscription
- **Device Simulation UI**: Display management, stats overlay, theme handling
- **App Lifecycle Events**: Handles loaded/started/closed/error events from engine
- **Input Management**: Keyboard/gamepad mapping, custom key bindings
- **IPC Communication**: Main ↔ Renderer messaging via preload bridge
- **Debug Integration**: Micro debugger support, console redirection

#### Renderer Process Modules (`src/app/`)
- **`preload.js`**: Secure contextBridge API for main ↔ renderer communication
- **`statusbar.js`**: Bottom status bar (file info, services, resolution, audio)
- **`editor.js`**: Monaco-based BrightScript code editor window, with integrated web terminal
- **`brightscript.js`**: BrightScript Monaco language definition (Monarch tokens, language config, themes)
- **`monaco.js`**: `MonacoManager` class wrapping Monaco editor creation, theme and indentation settings
- **`mirror.js`**: Hidden fixed-size canvas, the frame source for Remote Screen. Driven by the engine's `frame` event (`brs.setFrameNotify`, requires `brs-engine` >= 2.4.0) and copies `brs.getDisplayBuffer()` — native display-mode resolution, unlike the window-sized `#display`. Captured at `captureStream(0)` and pushed with `requestFrame()`, plus a 1s keepalive so an idle app still feeds the encoder. The engine's separate `cleared` event blanks the mirror rather than copying the buffer, which still holds the exited app's last frame
- **`webrtc.js`**: Remote Screen peer connections (one per viewer session), offer creation and ICE relay
- **`web/remote.html|remote.css|remote.js`**: The Remote Screen viewer page, copied unbundled to `app/web/`

### Core Components

#### BRS Engine Integration
- **Global `brs` Object**: Exposes `initialize()`, `subscribe()`, `deviceData`, `getVersion()`, `getSerialNumber()`
- **Event System**: Engine publishes events (loaded, started, closed, error, debug, redraw, control)
- **Device Data Sync**: `brs.deviceData` properties sync with main process settings
- **Custom Key Mapping**: Supports Roku remote buttons + game controller inputs
- **Performance Stats**: Optional overlay showing FPS, memory, draw calls

#### Network Services (All run in main process)
- **ECP Server** (`src/server/ecp.js`, port 8060): 
  - REST API: `/query/device-info`, `/query/apps`, `/keypress/*`, `/launch/*`
  - ECP-2 WebSocket API for mobile app compatibility
  - SSDP discovery service for device detection
  - Observer pattern for event distribution
- **Web Installer** (`src/server/installer.js`, default port 80):
  - HTTP digest authentication (username: rokudev)
  - File upload interface for ZIP/BPK deployment
  - Screenshot capture and download
  - Channel deletion and management
- **Telnet Server** (`src/server/telnet.js`, port 8085):
  - Remote console access for debugging
  - Command execution and output streaming
  - Micro debugger integration
  - Multi-client support with observer pattern
- **Remote Screen Server** (`src/server/remotescreen.js`, port 8090):
  - WebRTC video feed of the simulator display; no Roku counterpart
  - Serves the viewer page (`src/app/web/remote.html|css|js`) and a `/config` JSON document
  - `/rtc-session` WebSocket signaling relayed to the renderer over IPC (`rtcViewerJoined`, `rtcViewerLeft`, `rtcSignal`); the renderer is the offerer because it owns the media track
  - Offers are only sent on join, so `rtcReady` (renderer announces its handlers are live; main re-announces open sessions) and `rtcSessionFailed` (renderer reports a dead peer; main closes the socket) close the gaps in that one-shot handshake
  - Cross-origin requests are refused on both `/rtc-session` and `/paste`: WebSockets are exempt from CORS and a body-only POST needs no preflight, so a hostile page on loopback would otherwise pass the local-only address check
  - `/paste` reuses the renderer's existing `pasteText` queue; remote buttons are posted by the page directly to ECP on 8060, so ECP must also be enabled
  - Unauthenticated, therefore the only service whose setting defaults to disabled (`services.screen` is `[]`); capped at 4 concurrent viewers

#### Settings Architecture
- **Storage**: JSON file in `app.getPath("userData")/brs-settings.json`
- **UI**: `@lvcabral/electron-preferences` with custom CSS themes
- **Structure**: Nested sections (simulator, services, device, display, remote, audio, localization, captions)
- **Dot Notation Access**: `settings.value("device.deviceModel")` for nested properties
- **Live Updates**: Settings changes trigger IPC events to update running simulation

### Build System
- **Webpack**: Multi-config build in `build/webpack.app.config.js` 
  - Main entry: Creates `app/main.js` from `src/main.js`
  - App entry: Creates `app/app.js` from `src/app/app.js` 
  - Editor entry: Creates `app/editor.js` from `src/app/editor.js`
- **Development**: `npm run start` runs `build/start.js` with webpack watch + electron spawn
- **Release**: `npm run dist` builds production bundles + electron-builder packages

## Key Patterns

### Main Process Helper Module Details

#### Settings System (`src/helpers/settings.js`)
- **ElectronPreferences Integration**: Modal settings window with form validation
- **Device Configuration**: 15+ device models, display modes (480p/720p/1080p), localization
- **Service Management**: Enable/disable ECP, Installer, Telnet, Debug and Remote Screen servers with port configuration
- **Theme System**: Purple/Light/Dark/System themes with CSS variable management
- **Remote Control Mapping**: Custom keyboard shortcuts for Roku remote buttons
- **Caption Styling**: Font, color, opacity, background for closed captioning
- **Peer Roku Integration**: Deploy apps to real Roku devices for comparison testing

#### Window Management (`src/helpers/window.js`)
- **Multi-Window Support**: Main simulator, code editor, settings, about windows
- **State Persistence**: JSON storage of window bounds, position, fullscreen state
- **Aspect Ratio Control**: Automatic sizing based on display mode (4:3 vs 16:9)
- **Platform Differences**: Custom title bar on Windows, dock integration on macOS
- **Screenshot API**: Capture simulation display, copy to clipboard or save to file
- **DevTools Integration**: Detached Chrome DevTools for debugging renderer process

#### File Operations (`src/helpers/files.js`)
- **Package Loading**: ZIP/BPK extraction, manifest parsing, icon extraction
- **Source Code Handling**: BRS file loading, temporary package creation for code execution
- **Recent Files Management**: JSON persistence, menu integration, channel ID mapping
- **External App Launch**: ECP integration for launching apps on peer Roku devices
- **File Validation**: Extension checking, manifest validation, error handling

#### Network Utilities (`src/helpers/util.js`)
- **Local IP Detection**: Multi-interface network discovery for ECP services  
- **Gateway Detection**: Router IP identification for network info display
- **URL Validation**: Protocol checking for external app loading
- **MAC Address Generation**: Unique device identification for SSDP

### IPC Communication
```javascript
// Main → Renderer
window.webContents.send("eventName", data);

// Renderer → Main (via preload contextBridge)
api.send("eventName", data);

// Main process handlers
ipcMain.on("eventName", (event, data) => { /* handler */ });
```

### Renderer Process Module Details

#### Main App Logic (`src/app/app.js`)
- **Engine Event Handling**: Processes loaded/started/closed/error/debug events from BRS engine
- **Theme Management**: CSS custom property updates, title bar color synchronization
- **Display Control**: Canvas management, fullscreen transitions, aspect ratio handling
- **Input Processing**: Keyboard shortcuts, gamepad mapping, custom key combinations
- **Debug Integration**: Micro debugger state management, console message routing
- **Toast Notifications**: User feedback for operations, errors, and state changes

#### Status Bar (`src/app/statusbar.js`)
- **Service Status Display**: Real-time indicators for ECP, Telnet, Web Installer and Remote Screen services
- **File Information**: Currently loaded app name, version, resolution display
- **Error/Warning Counters**: Console message categorization and count display
- **Audio Status**: Volume level, mute state, audio language indicators
- **Network Info**: Local IP, device model, locale information
- **Clickable Links**: Direct access to ECP endpoints, web installer, console

#### Code Editor (`src/app/editor.js`)
- **Monaco Integration**: Editor instance managed via `MonacoManager` from `src/app/monaco.js`
- **Terminal Emulation**: Integrated console (`@lvcabral/terminal`) for BRS engine output and Micro Debugger commands
- **File Operations**: Save/load BRS source files, package creation for execution
- **Theme Support**: Editor themes synchronized with main application theme
- **Debug Features**: Breakpoint support, variable inspection, step debugging

#### BrightScript Language Mode (`src/app/brightscript.js`)
- **`defineBrightScriptLanguage(monaco)`**: Registers the `brightscript` language, Monarch token provider, and language configuration (brackets, comments, folding, auto-indentation)
- **`defineBrightScriptTheme(monaco, theme)`**: Defines/returns the Monaco theme matching the app theme, using VS Code-compatible colors
- **Syntax Highlighting**: Keywords, functions, operators, comments, strings
- **Custom Extensions**: Roku-specific language features and built-in functions

Note: Monaco is bundled by `monaco-editor-webpack-plugin` with a trimmed language/feature list configured in `build/webpack.app.config.js` — `brightscript` is registered manually at runtime, not through that plugin.

#### Preload Bridge (`src/app/preload.js`)
- **Secure API Exposure**: contextBridge for main ↔ renderer communication
- **Preference Management**: Settings window integration, real-time updates
- **Console Integration**: Buffer access, telnet message routing
- **File System Access**: Secure file operations via main process
- **External Link Handling**: Browser integration for documentation, URLs
- **Keyboard Shortcuts**: Global hotkey registration (screenshot, fullscreen)

### BRS Engine Integration
```javascript
// Initialize simulation engine
brs.initialize(deviceInfo, options);

// Subscribe to engine events  
brs.subscribe("desktop", (event, data) => { /* handler */ });

// Access device state
brs.deviceData.property = value;
```

### Server Observer Pattern
Each server (`ecp.js`, `installer.js`, `telnet.js`, `debug.js`, `remotescreen.js`) uses observer pattern:
```javascript
export function subscribeECP(observerId, callback) { /* subscribe */ }
function notifyAll(eventName, eventData) { /* notify observers */ }
```

### Settings Management
Settings use nested object structure with dot notation:
```javascript
settings.value("services.ecp")  // ["enabled"] array
settings.value("device.deviceModel")  // "4200X" string
settings.value("simulator.options")  // ["statusBar", "debugOnCrash"] array
```

## Development Workflows

### Local Development
```bash
npm install          # Install dependencies
npm run start            # Development mode with hot reload
npm run build            # Build without packaging  
npm run clean            # Clear build artifacts
```

### Cross-Platform Distribution
```bash
npm run dist             # Current platform
npm run dist-win         # Windows x64/x86
npm run dist-linux64     # Linux x64 AppImage
npm run dist-deb64       # Linux x64 Debian
```

### File Loading Patterns
- **ZIP/BPK packages**: Handled by `loadFile()` in `src/helpers/files.js`
- **Source code**: Monaco editor integration via `src/app/editor.js`
- **Recent files**: JSON persistence in user data directory

## Important File Paths
- **User Data**: `app.getPath("userData")` for settings/cache
- **Build Output**: `app/` directory (webpack output)
- **Engine Assets**: Copied from `node_modules/brs-engine/assets/**`
- **Recent Files**: `recent-files.json` in user data directory

## Platform Considerations
- **macOS**: Uses dock integration, different menu structure, notarization requirements
- **Windows**: Custom title bar with `custom-electron-titlebar`
- **Linux**: AppImage and Debian package formats

## Testing & Quality
- **Test Runner**: Vitest (`npm test`). Specs live in `test/unit/**` (pure logic, mirroring the `src/` tree) and `test/integration/**` (the real ECP, installer, telnet, debug and Remote Screen servers on ephemeral ports)
- **Electron Stubs**: `test/mocks/electron.js` plus the alias list in `vitest.config.mjs`; Electron is never launched. Assert IPC through the fake window's `webContents.send` spy, and drive main-process handlers with `ipcMain.emit(channel, {}, payload)`
- **No E2E layer**: window, menu and visual changes must still be verified by running the app. Remote Screen's media path is in the same category — there is no DOM canvas, `captureStream()` or `RTCPeerConnection` under Vitest, so only the server, signaling relay and local-only guards are covered
- **CI/CD**: GitHub Actions in `.github/workflows/build.yml` — the `test` job runs on all three platforms and gates the `release` job
- **Code Signing**: macOS notarization via Apple Developer credentials
- **Multi-arch**: Universal macOS builds, x64/x86 Windows, ARM Linux support

## External Dependencies
- **Core Engine**: `brs-engine` provides BrightScript simulation
- **Network**: `restana` for HTTP servers, `ws` for WebSockets, `node-ssdp` for discovery
- **UI**: `electron-preferences` for settings, `monaco-editor` for code editing, `@lvcabral/terminal` for the console
- **Build**: `webpack` + `electron-builder` for packaging

## Debugging
- DevTools: Main window supports Chrome DevTools (`--devtools` flag)
- Console: Telnet server provides remote console access
- Network: ECP endpoints return XML responses for external tools
- Logging: Console messages routed through main process to telnet clients