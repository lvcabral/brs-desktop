/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain, screen } from "electron";
import { getSimulatorOption, getTitleOverlayTheme } from "./settings";
import * as dialog from "../helpers/dialog";
import path from "node:path";
import jetpack from "fs-jetpack";

const userDataDir = jetpack.cwd(app.getPath("userData"));
const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";

export let appFocused = false;

export function createWindow(name, options) {
    const stateStoreFile = `window-state-${name}.json`;
    const defaultSize = {
        width: options.width,
        height: options.height,
    };
    let state = {};
    let win;

    state = restoreWindowState(stateStoreFile, defaultSize);

    win = new BrowserWindow(
        Object.assign(options, state, {
            webPreferences: {
                preload: path.join(__dirname, "./preload.js"),
                contextIsolation: true,
                enableRemoteModule: true,
                nodeIntegration: true,
                nodeIntegrationInWorker: true,
                webSecurity: true,
                nativeWindowOpen: true,
            },
            icon: __dirname + "/images/icon.ico",
            frame: false,
            show: false,
        })
    );
    require("@electron/remote/main").enable(win.webContents);

    // Control Child Windows behavior
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.endsWith("editor.html")) {
            const stateStoreFile = "window-state-editor.json";
            const defaultSize = { width: 1440, height: 800 };
            const state = restoreWindowState(stateStoreFile, defaultSize);
            const userTheme = globalThis.sharedObject.theme;
            return {
                action: "allow",
                overrideBrowserWindowOptions: Object.assign(state, {
                    title: "Code Editor",
                    titleBarStyle: isWindows || isMacOS ? "hidden" : null,
                    titleBarOverlay: getTitleOverlayTheme(userTheme),
                    minWidth: 600,
                    minHeight: 600,
                    webPreferences: {
                        preload: path.join(__dirname, "./preload.js"),
                        contextIsolation: true,
                        enableRemoteModule: true,
                        nodeIntegration: true,
                        nodeIntegrationInWorker: true,
                        webSecurity: true,
                    },
                }),
            };
        }
        return { action: "allow" };
    });

    // Window Focus Events
    win.on("focus", () => {
        appFocused = true;
    });
    win.on("blur", () => {
        if (!isMacOS) {
            for (const window of BrowserWindow.getAllWindows()) {
                if (window.isMenuBarVisible()) {
                    window.setMenuBarVisibility(false);
                }
            }
        }
        appFocused = false;
    });
    win.on("close", () => {
        saveWindowState(stateStoreFile, state, win);
    });
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
        globalThis.sharedObject.backgroundColor = color;
    });
    ipcMain.on("isFullScreen", (event) => {
        event.returnValue = win.isFullScreen();
    });
    ipcMain.on("toggleFullScreen", () => {
        win.setFullScreen(!win.isFullScreen());
    });
    ipcMain.on("updateRegistry", (_, data) => {
        if (data instanceof Map) {
            globalThis.sharedObject.deviceInfo.registry = data;
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

    ipcMain.on("closeSimulator", () => {
        win.close();
        app.quit();
    });

    ipcMain.on("openAppPackage", () => {
        dialog.openChannelPackage();
    });

    if (isMacOS) {
        // macOS windows flags
        win.setMaximizable(true);
        win.setWindowButtonVisibility(true);
    }
    win.on("resize", () => {
        setAspectRatio(false);
    });
    return win;
}

export function openDevTools(window) {
    window.openDevTools({ mode: "detach" });
}

export function setAspectRatio(changed = true) {
    const displayMode = globalThis.sharedObject.deviceInfo.displayMode || "720p";
    const ASPECT_RATIO_SD = 4 / 3;
    const ASPECT_RATIO_HD = 16 / 9;
    const window = BrowserWindow.fromId(1);
    let aspectRatio = displayMode === "480p" ? ASPECT_RATIO_SD : ASPECT_RATIO_HD;
    const statusOn = getSimulatorOption("statusBar");
    let height = window.getBounds().height;
    let offset = statusOn ? 45 : 25;
    if (window) {
        const availableHeight = Math.max(height - offset, 1);
        const targetWidth = Math.max(Math.round(availableHeight * aspectRatio), 1);
        const normalizedAspect = targetWidth / height;
        window.setAspectRatio(normalizedAspect);
        if (changed) {
            window.setBounds({ width: targetWidth });
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

export function reloadDevice() {
    // Close all windows except the main window before reloading
    const allWindows = BrowserWindow.getAllWindows();
    const mainWindow = BrowserWindow.fromId(1);
    for (const window of allWindows) {
        if (window.id !== 1 && !window.isDestroyed()) {
            window.close();
        }
    }
    if (mainWindow) {
        mainWindow.webContents.reloadIgnoringCache();
    }
}

export function openCodeEditor() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.send("openEditor");
    }
}

export function saveWindowState(stateStoreFile, state, win) {
    if (!win.isMinimized() && !win.isMaximized() && !win.isFullScreen() && win.isVisible()) {
        Object.assign(state, getWindowState(win));
    }
    if (state.width && state.height) {
        userDataDir.write(stateStoreFile, state, { atomic: true });
    }
}

// Helper Functions
function getWindowState(win) {
    const bounds = win.getBounds();
    return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        backgroundColor: globalThis.sharedObject.backgroundColor,
    };
}

function restoreWindowState(stateStoreFile, defaultSize) {
    let restoredState = {};
    try {
        restoredState = userDataDir.read(stateStoreFile, "json");
    } catch (err) {
        // For some reason json can't be read (might be corrupted).
        // No worries, we have defaults.
    }
    return ensureVisibleOnSomeDisplay({ ...defaultSize, ...restoredState }, defaultSize);
}

function ensureVisibleOnSomeDisplay(windowState, defaultSize) {
    const visible = screen.getAllDisplays().some((display) => {
        return windowWithinBounds(windowState, display.bounds);
    });
    if (!visible) {
        // Window is partially or fully not visible now.
        // Reset it to safe defaults.
        const bounds = screen.getPrimaryDisplay().bounds;
        return Object.assign({}, defaultSize, {
            x: (bounds.width - defaultSize.width) / 2,
            y: (bounds.height - defaultSize.height) / 2,
        });
    }
    return windowState;
}

function windowWithinBounds(windowState, bounds) {
    return (
        windowState.x >= bounds.x &&
        windowState.y >= bounds.y &&
        windowState.x + windowState.width <= bounds.x + bounds.width &&
        windowState.y + windowState.height <= bounds.y + bounds.height
    );
}
