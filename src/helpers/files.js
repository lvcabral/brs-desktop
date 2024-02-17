/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getAudioMuted, getSimulatorOption } from "./settings";
import { runOnPeerRoku, runBrs } from "./roku";
import { appFocused } from "./window";
import fs from "fs";
import path from "path";

export function loadFile(file, source) {
    let window = BrowserWindow.fromId(1);
    if (file == undefined) return;
    if (window.isMinimized()) {
        window.restore();
    } else if (!window.isVisible()) {
        window.show();
    } else if (!appFocused) {
        window.setAlwaysOnTop(true);
        app.focus({ steal: true });
        window.setAlwaysOnTop(false);
    }
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        window.webContents.send("console", `Invalid file: ${file[0]}`, true);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if (fileExt === ".zip" || fileExt === ".bpk" || fileExt === ".brs") {
        try {
            const fileData = fs.readFileSync(filePath);
            window.webContents.send(
                "fileSelected",
                filePath,
                fileData,
                !getSimulatorOption("keepDisplayOnExit"),
                getAudioMuted(),
                getSimulatorOption("debugOnCrash"),
                source ?? "desktop_app"
            );
            if (fileExt === ".zip") {
                runOnPeerRoku(filePath);
            } else if (fileExt === ".brs") {
                runBrs(fileData)
            }
        } catch (error) {
            window.webContents.send("console", `Error opening ${fileName}:${error.message}`, true);
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
