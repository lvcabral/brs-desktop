/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getAudioMuted, getSimulatorOption, getDisplayOption, getDeepLink } from "./settings";
import { runOnPeerRoku, resetPeerRoku } from "./roku";
import { appFocused } from "./window";
import { isValidUrl } from "./util";
import {
    BRS_HOME_APP_PATH,
    EDITOR_CODE_BRS,
    ICONS_DIR,
    LOCAL_STORAGE_MIGRATED_MARKER,
    MAX_PACKAGE_SIZE_MB,
} from "../constants";
import { iconFileName } from "./hash";
import { zipSync, strToU8 } from "fflate";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function loadFile(file, input) {
    resetPeerRoku();
    if (!file?.length) return;
    const window = BrowserWindow.fromId(1);
    if (file[0] !== BRS_HOME_APP_PATH) {
        focusWindow(window);
    }
    let filePath = file?.[0]?.split("?")[0] ?? "";
    let errMessage = "";
    if (filePath.startsWith("./")) {
        filePath = path.join(__dirname, filePath);
    }
    if (fs.existsSync(filePath)) {
        const fileName = path.parse(filePath).base;
        const fileExt = path.parse(filePath).ext.toLowerCase();
        if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
            try {
                executeFile(window, fs.readFileSync(filePath), file[0], input);
                return;
            } catch (error) {
                errMessage = `Error opening ${fileName}:${error.message}`;
            }
        } else {
            errMessage = `Unsupported file format: ${fileExt}`;
        }
    } else {
        errMessage = `Invalid file: ${filePath}`;
    }
    if (errMessage !== "") {
        window.webContents.send("console", errMessage, true);
    }
    if (!getSimulatorOption("disableHomeScreen")) {
        loadFile([BRS_HOME_APP_PATH]);
    }
}

export async function loadUrl(url, input) {
    const window = BrowserWindow.fromId(1);
    focusWindow(window);
    resetPeerRoku();
    if (!isValidUrl(url)) {
        window.webContents.send("console", `Invalid Url: ${url}`, true);
        return;
    }
    let errMessage = "";
    const fileName = path.parse(url).base;
    const fileExt = path.parse(url).ext.toLowerCase().split("?")[0];
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            const response = await fetch(url);
            if (response.status === 200) {
                const fileData = await response.arrayBuffer();
                executeFile(window, Buffer.from(fileData), url, input);
                return;
            } else {
                errMessage = `Error fetching ${fileName}: ${response.statusText} ${response.status}`;
            }
        } catch (error) {
            errMessage = `Error fetching ${url}: ${error.message}`;
        }
    }
    if (errMessage !== "") {
        window.webContents.send("console", errMessage, true);
    }
    if (!getSimulatorOption("disableHomeScreen")) {
        loadFile([BRS_HOME_APP_PATH]);
    }
}

export function saveFile(file, data) {
    fs.writeFileSync(file, new Buffer.from(data, "base64"));
}

function getIconsDir() {
    return path.join(app.getPath("userData"), ICONS_DIR);
}

// Icons used to be saved flat in userData (v2.4.0 and earlier); they now live under ICONS_DIR,
// the only part of userData exposed to the app windows (see helpers/protocol.js). Moves any
// leftover <hash>.png from an existing install into the new location so upgraded users don't
// lose their cached icons and see every recent app fall back to a generic one until relaunched.
// Safe to call on every startup: once nothing matches, it's a single readdir and an early return.
export function migrateIconCache() {
    const userDataDir = app.getPath("userData");
    let entries;
    try {
        entries = fs.readdirSync(userDataDir);
    } catch {
        return;
    }
    const legacyIcons = entries.filter((name) => /^\d+\.png$/.test(name));
    if (legacyIcons.length === 0) {
        return;
    }
    const iconsDir = getIconsDir();
    fs.mkdirSync(iconsDir, { recursive: true });
    for (const name of legacyIcons) {
        const oldPath = path.join(userDataDir, name);
        const newPath = path.join(iconsDir, name);
        try {
            if (fs.existsSync(newPath)) {
                fs.rmSync(oldPath);
            } else {
                fs.renameSync(oldPath, newPath);
            }
        } catch {
            // Best-effort: worst case this one icon re-caches on next launch instead of moving.
        }
    }
}

// localStorage is origin-scoped, and the app windows moved from file:// to app:// (see
// helpers/protocol.js) -- a different origin -- so a pre-2.5.0 install's localStorage (the
// editor's saved code snippets, brs-engine's per-channel roRegistry values, and a couple of UI
// flags) is invisible under the new one. The data isn't gone: Chromium keeps every origin's
// localStorage in one shared LevelDB database, and index.html/editor.html share a single file://
// origin, so a hidden window loaded at the old index.html URL can still read it back out; this
// replays it into the already-loaded main window's localStorage. Runs once, gated by a marker
// file -- unlike migrateIconCache(), a no-op run here still costs a whole extra hidden window.
export async function migrateLocalStorage(mainWindow, appDir) {
    const markerFile = path.join(app.getPath("userData"), LOCAL_STORAGE_MIGRATED_MARKER);
    if (fs.existsSync(markerFile)) {
        return;
    }
    const legacyWindow = new BrowserWindow({ show: false });
    try {
        await legacyWindow.loadURL(pathToFileURL(path.join(appDir, "index.html")).href);
        const dumped = await legacyWindow.webContents.executeJavaScript("JSON.stringify(Object.entries(localStorage))");
        const entries = JSON.parse(dumped);
        if (entries.length > 0) {
            // Only fills in keys the new origin doesn't already have, so a retry after a partial
            // failure (or a second profile that already ran this) can't clobber newer data.
            await mainWindow.webContents.executeJavaScript(`(() => {
                for (const [key, value] of ${JSON.stringify(entries)}) {
                    if (localStorage.getItem(key) === null) {
                        localStorage.setItem(key, value);
                    }
                }
            })();`);
        }
        fs.writeFileSync(markerFile, new Date().toISOString());
    } catch {
        // Leave the marker unwritten so a genuine failure (as opposed to "nothing to migrate",
        // which still resolves normally with an empty entries array) retries on the next launch.
    } finally {
        legacyWindow.destroy();
    }
}

// App Renderer Events
ipcMain.on("saveFile", (_, data) => {
    saveFile(data[0], data[1]);
});
ipcMain.on("saveIcon", (_, data) => {
    const iconsDir = getIconsDir();
    fs.mkdirSync(iconsDir, { recursive: true });
    saveFile(path.join(iconsDir, iconFileName(data.path)), data.iconData);
});
ipcMain.on("runCode", (_, code) => {
    const editorCodeFile = path.join(app.getPath("userData"), EDITOR_CODE_BRS);
    fs.writeFileSync(editorCodeFile, code);
    loadFile([editorCodeFile]);
});
ipcMain.on("runFile", (_, filePath) => {
    loadFile([filePath]);
});
ipcMain.on("runUrl", (_, url) => {
    loadUrl(url);
});
function packageBrs(code) {
    const manifest = `
title=BrightScript Engine
subtitle=Generic Code Runner
major_version=1
minor_version=0
build_version=0
mm_icon_focus_hd=pkg:/images/channel-poster_hd.png
splash_screen_hd=pkg:/images/splash-screen_hd.jpg`;
    const poster = fs.readFileSync(path.join(__dirname, "images", "channel-icon.png"));
    const zewZip = zipSync({
        manifest: [strToU8(manifest), {}],
        "source/main.brs": [strToU8(code), {}],
        "images/channel-poster_hd.png": [poster, {}],
    });
    return Buffer.from(zewZip);
}

function executeFile(window, fileData, filePath, input) {
    // Check file size limit
    const fileSize = fileData.length || fileData.byteLength || 0;
    const fileSizeMB = fileSize / (1024 * 1024);
    if (fileSizeMB > MAX_PACKAGE_SIZE_MB) {
        const fSize = fileSizeMB.toFixed(2);
        const errorMsg = `Package size (${fSize}MB) exceeds the maximum limit of ${MAX_PACKAGE_SIZE_MB}MB`;
        window.webContents.send("console", errorMsg, true);
        return;
    }
    // Send the app to the simulator to be executed
    let fileExt = path.parse(filePath).ext.toLowerCase().split("?")[0];
    input ??= new Map();
    const deepLink = getDeepLink();
    for (const [key, value] of Object.entries(deepLink)) {
        input.set(key, value);
    }
    if (!input.has("source")) {
        input.set("source", input.size ? "external-control" : "desktop-app");
    }
    window.webContents.send(
        "executeFile",
        filePath,
        fileData,
        !getDisplayOption("keepDisplayOnExit"),
        getAudioMuted(),
        getSimulatorOption("debugOnCrash"),
        input
    );
    // Send to the Roku peer
    if (fileExt === ".brs") {
        runOnPeerRoku(packageBrs(fileData), input);
    } else if (fileExt !== ".bpk" && filePath !== BRS_HOME_APP_PATH) {
        runOnPeerRoku(fileData, input);
    }
}

function focusWindow(window) {
    // Opt-out for users who deliberately keep the simulator minimized or in the background while
    // working elsewhere: a remote launch (VS Code deploy, web installer upload, ECP) would otherwise
    // yank the window in front of whatever they were doing.
    if (getSimulatorOption("disableFocusOnLaunch")) {
        return;
    }
    if (window.isMinimized()) {
        window.restore();
    } else if (!window.isVisible()) {
        window.show();
    } else if (!appFocused && !window.isAlwaysOnTop()) {
        window.setAlwaysOnTop(true);
        window.focus({ steal: true });
        window.setAlwaysOnTop(false);
    }
}
