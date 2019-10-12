import { dialog, BrowserWindow } from "electron";

/*
 * Show open dialog to open a .zip or .brs file.
 */
export function openChannelPackage() {
    const opts = {
        title: "Select a Channel package file.",
        filters: [ { name: "Channel Packages", extensions: [ "zip" ] }, { name: "All Files", extensions: [ "*" ] } ],
        properties: [ "openFile" ]
    };
    var window = BrowserWindow.getFocusedWindow();
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                console.log("cancelled");
                return;
            }
            window.webContents.send("fileSelected", result.filePaths);
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
    var window = BrowserWindow.getFocusedWindow();
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                console.log("cancelled");
                return;
            }
            window.webContents.send("fileSelected", result.filePaths);
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
    var window = BrowserWindow.getFocusedWindow();
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
