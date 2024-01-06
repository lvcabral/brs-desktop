/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { setThemeSource, setSimulatorOption, setStatusBar } from "../helpers/settings";
import { setAlwaysOnTop } from "../helpers/window";

export const viewMenuTemplate = {
    id: "view-menu",
    label: "&View",
    submenu: [
        {
            label: "Full Screen",
            role: "togglefullscreen",
        },
        {
            label: "Developer Tools",
            role: "toggleDevTools",
        },
        { type: "separator" },
        {
            id: "theme-purple",
            label: "Purple Theme",
            type: "radio",
            checked: true,
            click: (item) => {
                setThemeSource(item.id.slice(6), true);
            },
        },
        {
            id: "theme-light",
            label: "Light Theme",
            type: "radio",
            checked: false,
            click: (item) => {
                setThemeSource(item.id.slice(6), true);
            },
        },
        {
            id: "theme-dark",
            label: "Dark Theme",
            type: "radio",
            checked: false,
            click: (item) => {
                setThemeSource(item.id.slice(6), true);
            },
        },
        {
            id: "theme-system",
            label: "System Theme",
            type: "radio",
            checked: false,
            click: (item) => {
                setThemeSource(item.id.slice(6), true);
            },
        },
        { type: "separator" },
        {
            id: "on-top",
            label: "Always on Top",
            type: "checkbox",
            checked: false,
            enabled: true,
            click: (item) => {
                setSimulatorOption("alwaysOnTop", item.checked, item.id);
                setAlwaysOnTop(item.checked);
            },
        },
        {
            id: "status-bar",
            label: "Status Bar",
            type: "checkbox",
            checked: true,
            enabled: true,
            click: (item) => {
                setSimulatorOption("statusBar", item.checked, item.id);
                setStatusBar(item.checked);
            },
        },
    ],
};
