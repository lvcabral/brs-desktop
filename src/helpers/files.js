/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getAudioMuted, getSimulatorOption, getDisplayOption } from "./settings";
import { runOnPeerRoku, resetPeerRoku } from "./roku";
import { appFocused } from "./window";
import { isValidUrl } from "./util";
import { BRS_HOME_APP_PATH, EDITOR_CODE_BRS, MAX_PACKAGE_SIZE_MB } from "../constants";
import { zipSync, strToU8 } from "fflate";
import path from "node:path";
import fs from "node:fs";

export function loadFile(file, input) {
    resetPeerRoku();
    if (!file?.length) return;
    const window = BrowserWindow.fromId(1);
    if (file[0] !== BRS_HOME_APP_PATH) {
        focusWindow(window);
    }
    let filePath = file?.[0]?.split("?")[0] ?? "";
    if (filePath.startsWith("./")) {
        filePath = path.join(__dirname, filePath);
    }
    if (!fs.existsSync(filePath)) {
        window.webContents.send("console", `Invalid file: ${filePath}`, true);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            executeFile(window, fs.readFileSync(filePath), file[0], input);
        } catch (error) {
            window.webContents.send("console", `Error opening ${fileName}:${error.message}`, true);
        }
    } else {
        window.webContents.send("console", `File format not supported: ${fileExt}`, true);
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
    const fileName = path.parse(url).base;
    const fileExt = path.parse(url).ext.toLowerCase().split("?")[0];
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            const response = await fetch(url);
            if (response.status === 200) {
                const fileData = await response.arrayBuffer();
                executeFile(window, Buffer.from(fileData), url, input);
            } else {
                window.webContents.send(
                    "console",
                    `Error fetching ${fileName}: ${response.statusText} ${response.status}`,
                    true
                );
            }
        } catch (error) {
            window.webContents.send("console", `Error fetching ${url}: ${error.message}`, true);
        }
    } else {
        window.webContents.send("console", `File format not supported: ${fileExt}`, true);
    }
}

export function saveFile(file, data) {
    fs.writeFileSync(file, new Buffer.from(data, "base64"));
}

// App Renderer Events
ipcMain.on("saveFile", (_, data) => {
    saveFile(data[0], data[1]);
});
ipcMain.on("saveIcon", (_, data) => {
    const iconPath = path.join(app.getPath("userData"), data.iconId + ".png");
    saveFile(iconPath, data.iconData);
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
    if (input == undefined) {
        input = new Map();
    }
    if (!input.has("source")) {
        input.set("source", "desktop_app");
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
        runOnPeerRoku(packageBrs(fileData));
    } else if (fileExt !== ".bpk" && filePath !== BRS_HOME_APP_PATH) {
        runOnPeerRoku(fileData);
    }
}

function focusWindow(window) {
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
