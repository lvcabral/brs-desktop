import { setAspectRatio } from "./menuService";
import { isECPEnabled, enableECP, disableECP } from "../servers/ecp";
import { isTelnetEnabled, enableTelnet, disableTelnet } from "../servers/telnet";
import { hasInstaller, enableInstaller, disableInstaller } from "../servers/installer";
import { getSettings } from "../helpers/settings";

const isMacOS = process.platform === "darwin";

export const deviceMenuTemplate = {
    label: "&Device",
    submenu: [
        {
            id: "device-480p",
            label: "Display Mode: SD 480p (4:3)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                window.webContents.send("setDisplay", "480p");
                setAspectRatio(item.id);
            }
        },
        {
            id: "device-720p",
            label: "Display Mode: HD 720p (16:9)",
            type: "radio",
            checked: true,
            click: (item, window) => {
                window.webContents.send("setDisplay", "720p");
                setAspectRatio(item.id);
            }
        },
        {
            id: "device-1080p",
            label: "Display Mode: FHD 1080p (16:9)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                window.webContents.send("setDisplay", "1080p");
                setAspectRatio(item.id);
            }
        },
        { type: "separator" },
        {
            id: "overscan-disabled",
            label: "TV Overscan: Disabled",
            type: "radio",
            checked: true,
            click: (item, window) => {
                window.webContents.send("setOverscan", "disabled");
            }
        },
        {
            id: "overscan-guide-lines",
            label: "TV Overscan: Guide Lines",
            type: "radio",
            checked: false,
            click: (item, window) => {
                window.webContents.send("setOverscan", "guide-lines");
            }
        },
        {
            id: "overscan-enabled",
            label: "TV Overscan: Enabled",
            type: "radio",
            checked: false,
            click: (item, window) => {
                window.webContents.send("setOverscan", "enabled");
            }
        },
        { type: "separator" },
        {
            id: "locale-menu",
            label: "Localization",
            submenu: [
                {
                    id: "en_US",
                    label: "US English (en-US)",
                    type: "radio",
                    checked: true,
                    click: (event, window) => {
                        changeLocale(window, "en_US");
                    }
                },
                {
                    id: "en_GB",
                    label: "British English (en-GB)",
                    type: "radio",
                    checked: false,
                    click: (event, window) => {
                        changeLocale(window, "en_GB");
                    }
                },
                {
                    id: "fr_CA",
                    label: "Canadian French (fr-CA)",
                    type: "radio",
                    checked: false,
                    click: (event, window) => {
                        changeLocale(window, "fr_CA");
                    }
                },
                {
                    id: "es_ES",
                    label: "International Spanish (es-ES)",
                    type: "radio",
                    checked: false,
                    click: (event, window) => {
                        changeLocale(window, "es_ES");
                    }
                },
                {
                    id: "es_MX",
                    label: "Mexican Spanish (es-MX)",
                    type: "radio",
                    checked: false,
                    click: (event, window) => {
                        changeLocale(window, "es_MX");
                    }
                },
                {
                    id: "de_DE",
                    label: "German (de-DE)",
                    type: "radio",
                    checked: false,
                    click: (event, window) => {
                        changeLocale(window, "de_DE");
                    }
                },
                {
                    id: "it_IT",
                    label: "Italian (it-IT)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, "it_IT");
                    }
                },
                {
                    id: "pt_BR",
                    label: "Brazilian Portuguese (pt-BR)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, "pt_BR");
                    }
                },
            ]
        },
        { type: "separator" },
        {
            id: "web-installer",
            label: "Web Application Installer",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (hasInstaller) {
                    getSettings(window).value("services.installer", []);
                    disableInstaller(window);
                } else {
                    getSettings(window).value("services.installer", ["enabled"]);
                    enableInstaller(window);
                }
                if (!isMacOS) { item.checked = !item.checked }; // TODO: added to address a bug with electron-toolbar in Windows only
            }
        },
        {
            id: "ecp-api",
            label: "External Control Protocol",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (isECPEnabled) {
                    getSettings(window).value("services.ecp", []);
                    disableECP(window);
                } else {
                    getSettings(window).value("services.ecp", ["enabled"]);
                    enableECP(window);
                }
                if (!isMacOS) { item.checked = !item.checked }; // TODO: added to address a bug with electron-toolbar in Windows only
            }
        },
        {
            id: "telnet",
            label: "BrightScript Remote Console",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (isTelnetEnabled) {
                    getSettings(window).value("services.telnet", []);
                    disableTelnet(window);
                } else {
                    getSettings(window).value("services.telnet", ["enabled"]);
                    enableTelnet(window);
                }
                if (!isMacOS) { item.checked = !item.checked }; // TODO: added to address a bug with electron-toolbar in Windows only
            }
        },
        { type: "separator" },
        {
            label: "Reset Device",
            accelerator: "CmdOrCtrl+Shift+R",
            click: (item, window) => {
                window.webContents.reloadIgnoringCache();
            }
        }
    ]
};

function changeLocale(window, locale) {
    window.webContents.send("setLocale", locale);
    window.blur();
    window.focus();
}
