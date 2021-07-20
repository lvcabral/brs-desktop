/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import path from "path";

export function loadFile(file) {
    let window = BrowserWindow.fromId(1);
    if (file == undefined) return;
    if (window.isMinimized()) {
        window.restore();
    } else if (!window.isVisible()) {
        window.show();
    }
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        window.webContents.send("clientException",`Invalid file: ${file[0]}`);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if (fileExt === ".zip" || fileExt === ".brs") {
        try {
            window.webContents.send("fileSelected", filePath, fs.readFileSync(filePath));
        } catch (error) {
            window.webContents.send("clientException",`Error opening ${fileName}:${error.message}`);
        }
    } else {
        window.webContents.send("clientException",`File format not supported: ${fileExt}`);
    }
}

export function saveFile(file, data) {
    fs.writeFileSync(file, new Buffer.from(data, "base64"));
}

// App Renderer Events
ipcMain.on("saveFile", (event, data) => {
    saveFile(data[0], data[1]);
});
ipcMain.on("saveIcon", (event, data) => {
    const iconPath = path.join(
        app.getPath("userData"),
        data[0] + ".png"
    );
    saveFile(iconPath, data[1]);
});
