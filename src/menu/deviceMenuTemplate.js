import { isECPEnabled, enableECP, disableECP } from "../servers/ecp";
import { hasInstaller, enableInstaller, disableInstaller } from "../servers/installer";

export const deviceMenuTemplate = {
    label: "&Device",
    submenu: [
        {
            id: "device-480p",
            label: "Display Mode: SD 480p (4:3)",
            type: "radio",
            checked: false,
            click: (event, window) => {
                window.webContents.send("setDisplay", "480p");
            }
        },
        {
            id: "device-720p",
            label: "Display Mode: HD 720p (16:9)",
            type: "radio",
            checked: true,
            click: (event, window) => {
                window.webContents.send("setDisplay", "720p");
            }
        },
        {
            id: "device-1080p",
            label: "Display Mode: FHD 1080p (16:9)",
            type: "radio",
            checked: false,
            click: (event, window) => {
                window.webContents.send("setDisplay", "1080p");
            }
        },
        { type: "separator" },
        {
            id: "overscan-disabled",
            label: "TV Overscan: Disabled",
            type: "radio",
            checked: true,
            click: (event, window) => {
                window.webContents.send("setOverscan", "disabled");
            }
        },
        {
            id: "overscan-guide-lines",
            label: "TV Overscan: Guide Lines",
            type: "radio",
            checked: false,
            click: (event, window) => {
                window.webContents.send("setOverscan", "guide-lines");
            }
        },
        {
            id: "overscan-enabled",
            label: "TV Overscan: Enabled",
            type: "radio",
            checked: false,
            click: (event, window) => {
                window.webContents.send("setOverscan", "enabled");
            }
        },
        { type: "separator" },
        {
            id: "ecp-api",
            label: "ECP Server (port 8060)",
            type: "checkbox",
            checked: true,
            click: (event, window) => {
                if (isECPEnabled) {
                    disableECP();
                    window.webContents.send("toggleECP", false);
                } else {
                    enableECP();
                    window.webContents.send("toggleECP", true);
                }
            }
        },
        {
            id: "web-installer",
            label: "Web Installer (port 80)",
            type: "checkbox",
            checked: true,
            click: (event, window) => {
                if (hasInstaller) {
                    disableInstaller();
                    window.webContents.send("toggleInstaller", false);
                } else {
                    enableInstaller();
                    window.webContents.send("toggleInstaller", true);
                }
            }
        },
        { type: "separator" },
        {
            label: "Reset Device",
            accelerator: "CmdOrCtrl+Shift+R",
            click: (event, window) => {
                window.webContents.reloadIgnoringCache();
            }
        }
    ]
};
