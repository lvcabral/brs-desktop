/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getAudioMuted, getSimulatorOption } from "./settings";
import { runOnPeerRoku } from "./roku";
import { appFocused } from "./window";
import { zipSync, strToU8 } from "fflate";
import path from "path";
import * as fsExtra from "fs-extra";

export function loadFile(file, source) {
    if (file == undefined) return;
    let window = BrowserWindow.fromId(1);
    focusWindow(window);
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fsExtra.existsSync(file[0])) {
        filePath = file[0];
    } else {
        window.webContents.send("console", `Invalid file: ${file[0]}`, true);
        return;
    }
    const fileName = path.parse(filePath).base;
    let fileExt = path.parse(filePath).ext.toLowerCase();
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            let fileData = fsExtra.readFileSync(filePath);
            window.webContents.send(
                "fileSelected",
                filePath,
                fileData,
                !getSimulatorOption("keepDisplayOnExit"),
                getAudioMuted(),
                getSimulatorOption("debugOnCrash"),
                source ?? "desktop_app"
            );
            if (fileExt === ".brs") {
                filePath = packageBrs(fileName, fileData);
            }
            if (fileExt !== ".bpk") {
                runOnPeerRoku(filePath);
            }
        } catch (error) {
            window.webContents.send("console", `Error opening ${fileName}:${error.message}`, true);
        }
    } else {
        window.webContents.send("console", `File format not supported: ${fileExt}`, true);
    }
}

export async function loadUrl(url, source) {
    let window = BrowserWindow.fromId(1);
    focusWindow(window);
    if (typeof url === "string" && isValidUrl(url)) {
        console.log(url, url.trimEnd().slice(-3));
    } else {
        window.webContents.send("console", `Invalid Url: ${url}`, true);
        return;
    }
    const fileName = path.parse(url).base;
    let fileExt = path.parse(url).ext.toLowerCase();
    if ([".zip", ".bpk", ".brs"].includes(fileExt)) {
        try {
            const response = await fetch(url);
            if (response.status === 200) {
                let fileData = await response.arrayBuffer();
                window.webContents.send(
                    "fileSelected",
                    url,
                    fileData,
                    !getSimulatorOption("keepDisplayOnExit"),
                    getAudioMuted(),
                    getSimulatorOption("debugOnCrash"),
                    source ?? "desktop_app"
                );
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
    fsExtra.writeFileSync(file, new Buffer.from(data, "base64"));
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
    const newZipPath = packageBrs("editor", code);
    loadFile([newZipPath]);
});

function packageBrs(name, code) {
    let manifest = `
    title=BrsRunApp
    subtitle=Generic Code Runner
    major_version=1
    minor_version=0
    build_version=0
    mm_icon_focus_hd=pkg:/images/channel-poster_hd.png
    splash_screen_hd=pkg:/images/splash-screen_hd.jpg`;
    const zewZip = zipSync({
        manifest: [strToU8(manifest), {}],
        "source/main.brs": [strToU8(code), {}],
    });
    const filePath = path.join(app.getPath("userData"), `${name}.zip`);
    fsExtra.writeFileSync(filePath, zewZip);
    return filePath;
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
