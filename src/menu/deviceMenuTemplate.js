import { setAspectRatio, changeLocale } from "./menuService";
import { isECPEnabled, enableECP, disableECP } from "../servers/ecp";
import { isTelnetEnabled, enableTelnet, disableTelnet } from "../servers/telnet";
import { hasInstaller, enableInstaller, disableInstaller } from "../servers/installer";
import { getSettings, setDisplayOption } from "../helpers/settings";

const isMacOS = process.platform === "darwin";

export const deviceMenuTemplate = {
    label: "&Device",
    submenu: [
        {
            id: "480p",
            label: "Display Mode: SD 480p (4:3)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, window);
                setAspectRatio(item.id, window);
            }
        },
        {
            id: "720p",
            label: "Display Mode: HD 720p (16:9)",
            type: "radio",
            checked: true,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, window);
                setAspectRatio(item.id, window);
            }
        },
        {
            id: "1080p",
            label: "Display Mode: FHD 1080p (16:9)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, window);
                setAspectRatio(item.id, window);
            }
        },
        { type: "separator" },
        {
            id: "overscan-disabled",
            label: "TV Overscan: Disabled",
            type: "radio",
            checked: true,
            click: (item, window) => {
                getSettings().value("display.overscan", "disabled");
                window.webContents.send("setOverscan", "disabled");
            }
        },
        {
            id: "overscan-guidelines",
            label: "TV Overscan: Guide Lines",
            type: "radio",
            checked: false,
            click: (item, window) => {
                getSettings().value("display.overscan", "guidelines");
                window.webContents.send("setOverscan", "guidelines");
            }
        },
        {
            id: "overscan-enabled",
            label: "TV Overscan: Enabled",
            type: "radio",
            checked: false,
            click: (item, window) => {
                getSettings().value("display.overscan", "enabled");
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
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "en_GB",
                    label: "British English (en-GB)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "fr_CA",
                    label: "Canadian French (fr-CA)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "es_ES",
                    label: "International Spanish (es-ES)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "es_MX",
                    label: "Mexican Spanish (es-MX)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "de_DE",
                    label: "German (de-DE)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "it_IT",
                    label: "Italian (it-IT)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
                    }
                },
                {
                    id: "pt_BR",
                    label: "Brazilian Portuguese (pt-BR)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        changeLocale(window, item.id);
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
            checked: false,
            click: (item, window) => {
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
            checked: false,
            click: (item, window) => {
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
            click: (item, window) => {
                window.webContents.reloadIgnoringCache();
            }
        }
    ]
};
