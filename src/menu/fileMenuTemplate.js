/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import prompt from "electron-prompt";
import * as dialog from "../helpers/dialog";
import { closeChannel } from "../helpers/window";
import { loadUrl } from "../helpers/files";
import { loadPackage, loadSource, clearRecentFiles } from "./menuService";

export const fileMenuTemplate = {
    label: "&File",
    submenu: [
        {
            label: "Open App Package...",
            accelerator: "CmdOrCtrl+O",
            click: () => {
                dialog.openChannelPackage();
            },
        },
        {
            label: "Open Source File...",
            accelerator: "CmdOrCtrl+Shift+O",
            click: () => {
                dialog.openBrightScriptFile();
            },
        },
        {
            id: "open-url",
            label: "Open from URL...",
            accelerator: "CmdOrCtrl+U",
            enabled: true,
            click: (_, window) => {
                const userTheme = global.sharedObject.theme;
                prompt(
                    {
                        title: "Open from URL",
                        label: "URL:",
                        value: "",
                        inputAttrs: {
                            type: "url",
                        },
                        height: 177,
                        icon: __dirname + "/images/icon.ico",
                        type: "input",
                        customStylesheet: __dirname + `/css/prompt-${userTheme}.css`,
                    },
                    window
                )
                    .then((url) => {
                        if (url) {
                            loadUrl(url);
                        }
                    })
                    .catch(console.error);
            },
        },
        {
            id: "file-open-recent",
            label: "Open Recent",
            submenu: [
                {
                    id: "zip-0",
                    label: "",
                    accelerator: "CmdOrCtrl+R",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(0);
                    },
                },
                {
                    id: "zip-1",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(1);
                    },
                },
                {
                    id: "zip-2",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(2);
                    },
                },
                {
                    id: "zip-3",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(3);
                    },
                },
                {
                    id: "zip-4",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(4);
                    },
                },
                {
                    id: "zip-5",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(5);
                    },
                },
                {
                    id: "zip-6",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadPackage(6);
                    },
                },
                {
                    id: "zip-empty",
                    label: "No app .zip/.bpk file Recently Opened",
                    enabled: false,
                },
                { type: "separator" },
                {
                    id: "brs-0",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(0);
                    },
                },
                {
                    id: "brs-1",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(1);
                    },
                },
                {
                    id: "brs-2",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(2);
                    },
                },
                {
                    id: "brs-3",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(3);
                    },
                },
                {
                    id: "brs-4",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(4);
                    },
                },
                {
                    id: "brs-5",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(5);
                    },
                },
                {
                    id: "brs-6",
                    label: "",
                    visible: false,
                    click: (item, window) => {
                        loadSource(6);
                    },
                },
                {
                    id: "brs-empty",
                    label: "No Source .brs File Recently Opened",
                    enabled: false,
                },
                { type: "separator" },
                {
                    id: "file-clear",
                    label: "Clear Recently Opened",
                    enabled: false,
                    click: (item, window) => {
                        clearRecentFiles();
                    },
                },
            ],
        },
        { type: "separator" },
        {
            id: "save-screen",
            label: "Save Screenshot...",
            accelerator: "CmdOrCtrl+S",
            enabled: false,
            click: () => {
                dialog.saveScreenshot();
            },
        },
        { type: "separator" },
        {
            id: "close-channel",
            label: "Close App",
            accelerator: "CmdOrCtrl+W",
            enabled: false,
            click: () => {
                closeChannel();
            },
        },
        { type: "separator" },
        {
            role: "quit",
        },
    ],
};
