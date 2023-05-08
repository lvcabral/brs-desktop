/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrowserWindow, dialog } from "electron";
import { loadFile } from "./files";
/*
 * Show open dialog to open a .zip or .brs file.
 */
export function openChannelPackage() {
    const opts = {
        title: "Select a Channel package file.",
        filters: getFileFilter("Channel Packages",["zip"]),
        properties: ["openFile"],
    };
    const window = BrowserWindow.fromId(1);
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                console.log("cancelled");
                return;
            }
            loadFile(result.filePaths);
        })
        .catch((err) => {
            console.log(err);
        });
}

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
                console.log("cancelled");
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