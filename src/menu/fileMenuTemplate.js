import * as dialog from "../helpers/dialog";
import { getRecentPackage, clearRecentFiles, getRecentSource } from "./menuService";

export const fileMenuTemplate = {
    label: "&File",
    submenu: [
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
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 0);
                    }
                },
                {
                    id: "zip-1",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 1);
                    }
                },
                {
                    id: "zip-2",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 2);
                    }
                },
                {
                    id: "zip-3",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 3);
                    }
                },
                {
                    id: "zip-4",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 4);
                    }
                },
                {
                    id: "zip-5",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 5);
                    }
                },
                {
                    id: "zip-6",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        packageClick(window, 6);
                    }
                },
                {
                    id: "zip-empty",
                    label: "No Channel .zip Package Recently Opened",
                    enabled: false
                },
                { type: "separator" },
                {
                    id: "brs-0",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 0);
                    }
                },
                {
                    id: "brs-1",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 1);
                    }
                },
                {
                    id: "brs-2",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 2);
                    }
                },
                {
                    id: "brs-3",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 3);
                    }
                },
                {
                    id: "brs-4",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 4);
                    }
                },
                {
                    id: "brs-5",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 5);
                    }
                },
                {
                    id: "brs-6",
                    label: "",
                    visible: false,
                    click: (event, window) => {
                        sourceClick(window, 6);
                    }
                },
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
            id: "close-channel",
            label: "Close Channel",
            accelerator: "CmdOrCtrl+W",
            enabled: false,
            click: (event, window) => {
                window.webContents.send("closeChannel", "Menu");
            }
        },
        { type: "separator" },
        {
            role: "quit"
        }
    ]
};

function packageClick(window, id) {
    window.webContents.send("fileSelected", [ getRecentPackage(id) ]);
    window.blur();
    window.focus();
}

function sourceClick(window, id) {
    window.webContents.send("fileSelected", [ getRecentSource(id) ]);
    window.blur();
    window.focus();
}
