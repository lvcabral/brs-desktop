/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain, screen } from "electron";
import { getSimulatorOption, getTitleOverlayTheme } from "./settings";
import path from "path";
import jetpack from "fs-jetpack";

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";

export let appFocused = false;

export function createWindow(name, options) {
    const userDataDir = jetpack.cwd(app.getPath("userData"));
    const stateStoreFile = `window-state-${name}.json`;
    const defaultSize = {
        width: options.width,
        height: options.height,
    };
    let state = {};
    let win;

    const restore = () => {
        let restoredState = {};
        try {
            restoredState = userDataDir.read(stateStoreFile, "json");
        } catch (err) {
            // For some reason json can't be read (might be corrupted).
            // No worries, we have defaults.
        }
        return Object.assign({}, defaultSize, restoredState);
    };

    const getWindowState = () => {
        const bounds = win.getBounds();
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            backgroundColor: global.sharedObject.backgroundColor,
        };
    };

    const windowWithinBounds = (windowState, bounds) => {
        return (
            windowState.x >= bounds.x &&
            windowState.y >= bounds.y &&
            windowState.x + windowState.width <= bounds.x + bounds.width &&
            windowState.y + windowState.height <= bounds.y + bounds.height
        );
    };

    const resetToDefaults = () => {
        const bounds = screen.getPrimaryDisplay().bounds;
        return Object.assign({}, defaultSize, {
            x: (bounds.width - defaultSize.width) / 2,
            y: (bounds.height - defaultSize.height) / 2,
        });
    };

    const ensureVisibleOnSomeDisplay = (windowState) => {
        const visible = screen.getAllDisplays().some((display) => {
            return windowWithinBounds(windowState, display.bounds);
        });
        if (!visible) {
            // Window is partially or fully not visible now.
            // Reset it to safe defaults.
            return resetToDefaults();
        }
        return windowState;
    };

    const saveState = () => {
        if (!win.isMinimized() && !win.isMaximized() && !win.isFullScreen()) {
            Object.assign(state, getWindowState());
        }
        userDataDir.write(stateStoreFile, state, { atomic: true });
    };

    state = ensureVisibleOnSomeDisplay(restore());

    win = new BrowserWindow(
        Object.assign(options, state, {
            webPreferences: {
                preload: path.join(__dirname, "./preload.js"),
                contextIsolation: true,
                enableRemoteModule: true,
                nodeIntegration: true,
                nodeIntegrationInWorker: true,
                webSecurity: true,
                nativeWindowOpen: true
            },
            icon: __dirname + "/images/icon.ico",
            frame: false,
            show: false,
        })
    );
    require("@electron/remote/main").enable(win.webContents);

    // Enable SharedArrayBuffer
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        details.responseHeaders["Cross-Origin-Opener-Policy"] = ["same-origin"];
        details.responseHeaders["Cross-Origin-Embedder-Policy"] = ["require-corp"];
        callback({ responseHeaders: details.responseHeaders });
    });

    // Control Child Windows behavior
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.endsWith("editor.html")) {
            const userTheme = global.sharedObject.theme;
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    title: "Code Editor",
                    titleBarStyle: isWindows || isMacOS ? "hidden": null,
                    titleBarOverlay: getTitleOverlayTheme(userTheme),
                    minWidth: 600,
                    minHeight: 600,
                    backgroundColor: "black",
                    webPreferences: {
                        preload: path.join(__dirname, "./preload.js"),
                        contextIsolation: true,
                        enableRemoteModule: true,
                        nodeIntegration: true,
                        nodeIntegrationInWorker: true,
                        webSecurity: true,
                    },
                }
            }
        };
        return { action: "allow" };
    });

    // Window Focus Events
    win.on("focus", () => {
        appFocused = true;
    });
    win.on("blur", () => {
        appFocused = false;
    });
    win.on("close", saveState);
    // App Renderer Events
    ipcMain.on("openConsole", () => {
        openCodeEditor();
    });
    ipcMain.on("debugStarted", () => {
        if (getSimulatorOption("consoleOnDebug")) {
            openCodeEditor();
        }
    });
    ipcMain.on("setBackgroundColor", (_, color) => {
        win.setBackgroundColor(color);
        global.sharedObject.backgroundColor = color;
    });
    ipcMain.on("isFullScreen", (event) => {
        event.returnValue = win.isFullScreen();
    });
    ipcMain.on("toggleFullScreen", () => {
        win.setFullScreen(!win.isFullScreen());
    });
    ipcMain.on("updateRegistry", (_, data) => {
        if (data instanceof Map) {
            global.sharedObject.deviceInfo.registry = data;
        }
    });
    ipcMain.on("showEditor", () => {
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.some((window) => {
            if (window.getURL().endsWith("editor.html")) {
                if (window.isMinimized()) {
                    window.restore();
                } else if (!window.isVisible()) {
                    window.show();
                }
                window.focus({ steal: true });
                return true;
            }
        });
    });
    ipcMain.on("reset", () => {
        win.reload();
    });

    if (isMacOS) {
        // macOS windows flags
        win.setMaximizable(true);
        win.setWindowButtonVisibility(true);
    } else {
        win.on("resize", () => {
            setAspectRatio(false);
        });
    }
    return win;
}
export function openDevTools(window) {
    window.openDevTools({ mode: 'detach' });
}

export function setAspectRatio(changed = true) {
    const displayMode = global.sharedObject.deviceInfo.displayMode || "720p";
    const ASPECT_RATIO_SD = 4 / 3;
    const ASPECT_RATIO_HD = 16 / 9;
    const window = BrowserWindow.fromId(1);
    let aspectRatio = displayMode === "480p" ? ASPECT_RATIO_SD : ASPECT_RATIO_HD;
    const statusOn = getSimulatorOption("statusBar");
    let height = window.getBounds().height;
    let offset = statusOn ? 45 : 25;
    if (window) {
        if (isMacOS) {
            height -= offset;
            window.setAspectRatio(aspectRatio, { width: 0, height: offset });
        } else {
            const width = Math.round((height - offset) * aspectRatio);
            aspectRatio = width / height;
            window.setAspectRatio(aspectRatio);
        }
        if (changed) {
            window.setBounds({ width: Math.round(height * aspectRatio) });
        }
    }
}

export function setAlwaysOnTop(enabled) {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.setAlwaysOnTop(enabled);
    }
}

export function copyScreenshot() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.send("copyScreenshot");
    }
}

export function closeChannel() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.send("closeChannel", "EXIT_USER_NAV");
    }
}

export function reloadApp() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.reloadIgnoringCache();
    }
}

export function openCodeEditor() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.send("openEditor");
    }
}