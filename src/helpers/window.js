/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain, screen, Menu } from "electron";
import path from "path";
import jetpack from "fs-jetpack";

const isMacOS = process.platform === "darwin";

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
        const appMenu = app.applicationMenu;
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
    win.on("close", saveState);
    // App Renderer Events
    ipcMain.on("openDevTools", (event, data) => {
        win.openDevTools();
    });
    ipcMain.on("setBackgroundColor", (event, color) => {
        win.setBackgroundColor(color);
        global.sharedObject.backgroundColor = color;
    });
    ipcMain.on("isFullScreen", (event) => {
        event.returnValue = win.isFullScreen();
    });
    ipcMain.on("toggleFullScreen", () => {
        win.setFullScreen(!win.isFullScreen());
    });
    ipcMain.on("reset", () => {
        win.reload();
    });
    // macOS windows flags
    if (isMacOS) {
        win.setMaximizable(true);
        win.setWindowButtonVisibility(true);
    }
    return win;
}

export function setAspectRatio(displayMode, changed = true) {
    const ASPECT_RATIO_SD = 4 / 3;
    const ASPECT_RATIO_HD = 16 / 9;
    const window = BrowserWindow.fromId(1);
    const aspectRatio = displayMode === "480p" ? ASPECT_RATIO_SD : ASPECT_RATIO_HD;
    const appMenu = Menu.getApplicationMenu();
    const statusOn = appMenu.getMenuItemById("status-bar").checked;
    const offset = statusOn ? 45 : 25;
    if (window) {
        if (isMacOS && changed) {
            const height = window.getBounds().height - offset;
            window.setBounds({ width: Math.round(height * aspectRatio) });
        }
        window.setAspectRatio(aspectRatio, { width: 0, height: offset });
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
        window.webContents.send("closeChannel", "Menu");
    }
}

export function reloadApp() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.reloadIgnoringCache();
    }
}
