import { isECPEnabled, enableECP, disableECP } from "../servers/ecp";
import { isTelnetEnabled, enableTelnet, disableTelnet } from "../servers/telnet";
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
            id: "web-installer",
            label: "Web Application Installer",
            type: "checkbox",
            checked: true,
            click: (event, window) => {
                if (hasInstaller) {
                    disableInstaller(window);
                } else {
                    enableInstaller(window);
                }
            }
        },
        {
            id: "ecp-api",
            label: "External Control Protocol",
            type: "checkbox",
            checked: true,
            click: (event, window) => {
                if (isECPEnabled) {
                    disableECP(window);
                } else {
                    enableECP(window);
                }
            }
        },
        {
            id: "telnet",
            label: "BrightScript Remote Console",
            type: "checkbox",
            checked: true,
            click: (event, window) => {
                if (isTelnetEnabled) {
                    disableTelnet(window);
                } else {
                    enableTelnet(window);
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
