/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrowserWindow, dialog } from "electron";
import { loadFile } from "./files";
/*
 * Show open dialog to open an app package .zip or .bpk file.
 */
export function openChannelPackage() {
    const opts = {
        title: "Select an App package file.",
        filters: getFileFilter("App Packages",["zip", "bpk"]),
        properties: ["openFile"],
    };
    const window = BrowserWindow.fromId(1);
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                return;
            }
            loadFile(result.filePaths);
        })
        .catch((err) => {
            console.log(err);
        });
}

/*
 * Show open dialog to open a source code .brs file.
 */
export function openBrightScriptFile() {
    const opts = {
        title: "Select a BrightScript source file.",
        filters: getFileFilter("BrightScript source files", ["brs"]),
        properties: ["openFile"],
    };
    const window = BrowserWindow.fromId(1);
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                return;
            }
            loadFile(result.filePaths);
        })
        .catch((err) => {
            console.log(err);
        });
}

export function saveScreenshot() {
    const opts = {
        title: "Save the Screenshot as",
        filters: getFileFilter("PNG Image", ["png"]),
    };
    const window = BrowserWindow.fromId(1);
    dialog
        .showSaveDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                return;
            }
            window.webContents.send("saveScreenshot", result.filePath);
        })
        .catch((err) => {
            console.log(err);
        });
}

// Helper functions

function getFileFilter(description, extensions) {
    return [
        { name: description, extensions: extensions },
        { name: "All Files", extensions: ["*"] },
    ];
}