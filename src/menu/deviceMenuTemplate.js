import { BrowserWindow, Menu } from "electron";

export const deviceMenuTemplate = {
    label: "&Device",
    submenu: [
        {
            id: "device-480p",
            label: "Display Mode: SD 480p (4:3)",
            type: "radio",
            checked: false,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setDisplay", "480p");
            }
        },
        {
            id: "device-720p",
            label: "Display Mode: HD 720p (16:9)",
            type: "radio",
            checked: true,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setDisplay", "720p");
            }
        },
        {
            id: "device-1080p",
            label: "Display Mode: FHD 1080p (16:9)",
            type: "radio",
            checked: false,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setDisplay", "1080p");
            }
        },
        { type: "separator" },
        {
            id: "overscan-disabled",
            label: "TV Overscan: Disabled",
            type: "radio",
            checked: true,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setOverscan", "disabled");
            }
        },
        {
            id: "overscan-guide-lines",
            label: "TV Overscan: Guide Lines",
            type: "radio",
            checked: false,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setOverscan", "guide-lines");
            }
        },
        {
            id: "overscan-enabled",
            label: "TV Overscan: Enabled",
            type: "radio",
            checked: false,
            click: () => {
                var window = BrowserWindow.getFocusedWindow();
                window.webContents.send("setOverscan", "enabled");
            }
        },
        { type: "separator" },
        {
            label: "Reset Device",
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => {
                BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
            }
        }
    ]
};
