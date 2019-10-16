import * as dialog from "../helpers/dialog";
import { getRecentPackage, clearRecentFiles, addRecentPackage } from "../helpers/recent"
const isMacOS = process.platform === "darwin";

export const fileMenuTemplate = {
    label: "&File",
    submenu: [
        { role: "about", visible: isMacOS },
        {
            label: "Check for Updates...",
            visible: isMacOS,
            enabled: false
        },
        {
            type: isMacOS ? "separator" : "normal", // Electron won't hide separator
            label: "",
            visible: isMacOS
        },
        {
            label: "Open Channel Package...",
            accelerator: "CmdOrCtrl+O",
            click: () => {
                dialog.openChannelPackage();
            }
        },
        {
            label: "Open Source File...",
            accelerator: "CmdOrCtrl+Shift+O",
            click: () => {
                dialog.openBrightScriptFile();
            }
        },
        {
            id: "file-open-recent",
            label: "Open Recent",
            submenu: [
                { 
                    id: "zip-0", 
                    label:"", 
                    visible: false,
                    click (event, window) {
                        window.webContents.send("fileSelected", [getRecentPackage(0)]);
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-1",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(1)]);
                        addRecentPackage(getRecentPackage(1));
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-2",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(2)]);
                        addRecentPackage(getRecentPackage(2));
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-3",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(3)]);
                        addRecentPackage(getRecentPackage(3));
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-4",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(4)]);
                        addRecentPackage(getRecentPackage(4));
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-5",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(5)]);
                        addRecentPackage(getRecentPackage(5));
                        window.blur();
                        window.focus();
                    }
                },
                { 
                    id: "zip-6",
                    label:"", 
                    visible: false,
                    click: (event, window) => {
                        window.webContents.send("fileSelected", [getRecentPackage(6)]);
                        addRecentPackage(getRecentPackage(6));
                        window.blur();
                        window.focus();
                    }
                },
                {
                    id: "zip-empty",
                    label: "No Channel .zip Package Recently Opened",
                    enabled: false
                },
                { type: "separator" },
                { id: "brs-0", label:"", visible: false},
                { id: "brs-1", label:"", visible: false},
                { id: "brs-2", label:"", visible: false},
                { id: "brs-3", label:"", visible: false},
                { id: "brs-4", label:"", visible: false},
                { id: "brs-5", label:"", visible: false},
                { id: "brs-6", label:"", visible: false},
                {
                    id: "brs-empty",
                    label: "No Source .brs File Recently Opened",
                    enabled: false
                },
                { type: "separator" },
                {
                    id: "file-clear",
                    label: "Clear Recently Opened",
                    enabled: false,
                    click: (event, window) => {
                        clearRecentFiles();
                        window.blur();
                        window.focus();
                    }
                }
            ]
        },
        { type: "separator" },
        {
            label: "Save Screenshot...",
            accelerator: "CmdOrCtrl+S",
            click: () => {
                dialog.saveScreenshot();
            }
        },
        { type: "separator" },
        {
            role: "quit"
        }
    ]
};
