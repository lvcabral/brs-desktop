/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import prompt from "electron-prompt";
import * as dialog from "../helpers/dialog";
import { closeChannel } from "../helpers/window";
import { loadUrl } from "../helpers/files";
import { loadPackage, clearRecentFiles } from "./menuService";

export const maxMenuFiles = 15;

// Generate recent file menu items dynamically
function buildRecentSubmenu() {
    const items = [];
    for (let i = 0; i < maxMenuFiles; i++) {
        const entry = {
            id: `zip-${i}`,
            label: "",
            visible: false,
            click: () => {
                loadPackage(i);
            },
        };
        if (i === 0) {
            entry.accelerator = "CmdOrCtrl+R";
        }
        items.push(entry);
    }
    items.push({
        id: "zip-empty",
        label: "No app .zip/.bpk file Recently Opened",
        enabled: false,
    });
    items.push(
        { type: "separator" },
        {
            id: "file-clear",
            label: "Clear Recently Opened",
            enabled: false,
            click: () => {
                clearRecentFiles();
            },
        },
    );
    return items;
}

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
            id: "open-url",
            label: "Open from URL...",
            accelerator: "CmdOrCtrl+U",
            enabled: true,
            click: (_, window) => {
                const userTheme = globalThis.sharedObject.theme;
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
                        customStylesheet:
                            __dirname + `/css/prompt-${userTheme}.css`,
                    },
                    window,
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
            submenu: buildRecentSubmenu(),
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
