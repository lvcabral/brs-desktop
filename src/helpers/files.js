/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getAudioMuted, getSimulatorOption } from "./settings";
import { runOnPeerRoku, resetPeerRoku } from "./roku";
import { appFocused } from "./window";
import { zipSync, strToU8 } from "fflate";
import path from "path";
import fs from "fs";

export const editorCodeFile = path.join(app.getPath("userData"), "editor_code.brs");

export function loadFile(file, input) {
    resetPeerRoku();
    if (file == undefined) return;
    const window = BrowserWindow.fromId(1);
    focusWindow(window);
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        window.webContents.send("console", `Invalid file: ${file[0]}`, true);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            executeFile(window, fs.readFileSync(filePath), filePath, input);
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
    const fileExt = path.parse(url).ext.toLowerCase();
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            const response = await fetch(url);
            if (response.status === 200) {
                let fileData = await response.arrayBuffer();
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
    const iconPath = path.join(app.getPath("userData"), data[0] + ".png");
    saveFile(iconPath, data[1]);
});
ipcMain.on("runCode", (_, code) => {
    fs.writeFileSync(editorCodeFile, code);
    loadFile([editorCodeFile]);
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
        "manifest": [strToU8(manifest), {}],
        "source/main.brs": [strToU8(code), {}],
        "images/channel-poster_hd.png": [poster, {}],
    });
    return Buffer.from(zewZip);
}

function executeFile(window, fileData, filePath, input) {
    let fileExt = path.parse(filePath).ext.toLowerCase();
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
        !getSimulatorOption("keepDisplayOnExit"),
        getAudioMuted(),
        getSimulatorOption("debugOnCrash"),
        input
    );
    if (fileExt === ".brs") {
        runOnPeerRoku(packageBrs(fileData));
    } else if (fileExt !== ".bpk") {
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

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}
