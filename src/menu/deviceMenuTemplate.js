/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isECPEnabled, enableECP, disableECP } from "../server/ecp";
import { isTelnetEnabled, enableTelnet, disableTelnet } from "../server/telnet";
import { isInstallerEnabled, enableInstaller, disableInstaller } from "../server/installer";
import { setLocaleId, setDisplayOption } from "../helpers/settings";
import { reloadApp } from "../helpers/window";

export const deviceMenuTemplate = {
    label: "&Device",
    submenu: [
        {
            id: "480p",
            label: "Display Mode: SD 480p (4:3)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, true);
            },
        },
        {
            id: "720p",
            label: "Display Mode: HD 720p (16:9)",
            type: "radio",
            checked: true,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, true);
            },
        },
        {
            id: "1080p",
            label: "Display Mode: FHD 1080p (16:9)",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("displayMode", item.id, true);
            },
        },
        { type: "separator" },
        {
            id: "disabled",
            label: "TV Overscan: Disabled",
            type: "radio",
            checked: true,
            click: (item, window) => {
                setDisplayOption("overscanMode", item.id, true);
            },
        },
        {
            id: "guidelines",
            label: "TV Overscan: Guide Lines",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("overscanMode", item.id, true);
            },
        },
        {
            id: "overscan",
            label: "TV Overscan: Enabled",
            type: "radio",
            checked: false,
            click: (item, window) => {
                setDisplayOption("overscanMode", item.id, true);
            },
        },
        { type: "separator" },
        {
            id: "locale-menu",
            label: "Channel Localization",
            submenu: [
                {
                    id: "en_US",
                    label: "US English (en-US)",
                    type: "radio",
                    checked: true,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "en_GB",
                    label: "British English (en-GB)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "fr_CA",
                    label: "Canadian French (fr-CA)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "es_ES",
                    label: "International Spanish (es-ES)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "es_MX",
                    label: "Mexican Spanish (es-MX)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "de_DE",
                    label: "German (de-DE)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "it_IT",
                    label: "Italian (it-IT)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
                {
                    id: "pt_BR",
                    label: "Brazilian Portuguese (pt-BR)",
                    type: "radio",
                    checked: false,
                    click: (item, window) => {
                        setLocaleId(item.id);
                    },
                },
            ],
        },
        { type: "separator" },
        {
            id: "web-installer",
            label: "Web Application Installer",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (isInstallerEnabled) {
                    disableInstaller();
                } else {
                    enableInstaller();
                }
            },
        },
        {
            id: "ecp-api",
            label: "External Control Protocol",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (isECPEnabled) {
                    disableECP();
                } else {
                    enableECP();
                }
            },
        },
        {
            id: "telnet",
            label: "BrightScript Remote Console",
            type: "checkbox",
            checked: false,
            click: (item, window) => {
                if (isTelnetEnabled) {
                    disableTelnet();
                } else {
                    enableTelnet();
                }
            },
        },
        { type: "separator" },
        {
            label: "Reset Device",
            accelerator: "CmdOrCtrl+Shift+R",
            click: (item, window) => {
                reloadApp();
            },
        },
    ],
};
