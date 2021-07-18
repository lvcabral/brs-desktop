import { BrowserWindow, dialog } from "electron";
import { loadFile } from "./files";
/*
 * Show open dialog to open a .zip or .brs file.
 */
export function openChannelPackage() {
    const opts = {
        title: "Select a Channel package file.",
        filters: [ { name: "Channel Packages", extensions: [ "zip" ] }, { name: "All Files", extensions: [ "*" ] } ],
        properties: [ "openFile" ]
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
        filters: [ { name: "BrightScript source files", extensions: [ "brs" ] }, { name: "All Files", extensions: [ "*" ] } ],
        properties: [ "openFile" ]
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
        filters: [ { name: "PNG Image", extensions: [ "png" ] }, { name: "All Files", extensions: [ "*" ] } ]
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
