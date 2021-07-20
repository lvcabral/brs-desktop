/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "path";
import jetpack from "fs-jetpack";

const isMacOS = process.platform === "darwin";

export function createWindow(name, options) {
    const userDataDir = jetpack.cwd(app.getPath("userData"));
    const stateStoreFile = `window-state-${name}.json`;
    const defaultSize = {
        width: options.width,
        height: options.height
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
            backgroundColor: global.sharedObject.backgroundColor
        }
    }

    const windowWithinBounds = (windowState, bounds) => {
        return (
            windowState.x >= bounds.x &&
            windowState.y >= bounds.y &&
            windowState.x + windowState.width <= bounds.x + bounds.width &&
            windowState.y + windowState.height <= bounds.y + bounds.height
        )
    }

    const resetToDefaults = () => {
        const bounds = screen.getPrimaryDisplay().bounds;
        return Object.assign({}, defaultSize, {
            x: (bounds.width - defaultSize.width) / 2,
            y: (bounds.height - defaultSize.height) / 2
        });
    }

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
    }

    const saveState = () => {
        if (!win.isMinimized() && !win.isMaximized() && !win.isFullScreen()) {
            Object.assign(state, getWindowState());
        }
        userDataDir.write(stateStoreFile, state, { atomic: true });
    }

    state = ensureVisibleOnSomeDisplay(restore());

    win = new BrowserWindow(
        Object.assign(options, state, {
            webPreferences: {
                preload: path.join(__dirname, "./preload.js"),
                contextIsolation: true,
                enableRemoteModule: true,
                nodeIntegration: true,
                nodeIntegrationInWorker: true,
                webSecurity: true
            },
            icon: __dirname + "/images/icon48x48.ico",
            frame: false,
            show: false
        })
    );
    win.on("close", saveState);
    // App Renderer Events
    ipcMain.on("openDevTools", (event, data) => {
        win.openDevTools();
    });
    ipcMain.on("setBackgroundColor", (event, color) => {
        win.setBackgroundColor(color);
        global.sharedObject.backgroundColor = color;
    });
    ipcMain.on('isFullScreen', (event) => {
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

export function setAspectRatio(displayMode) {
    const ASPECT_RATIO_SD = 1.27;
    const ASPECT_RATIO_HD = 1.67;
    const window = BrowserWindow.fromId(1);
    const aspectRatio = displayMode === "480p" ? ASPECT_RATIO_SD : ASPECT_RATIO_HD;
    if (window) {
        if (isMacOS) {
            window.setBounds({ width: Math.round(window.getBounds().height * aspectRatio) });
        }
        window.setAspectRatio(aspectRatio);
    }
}

export function setAlwaysOnTop(enabled) {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.setAlwaysOnTop(enabled);
    }
}

export function setStatusBar() {
    const window = BrowserWindow.fromId(1);
    if (window) {
        window.webContents.send("toggleStatusBar");
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
