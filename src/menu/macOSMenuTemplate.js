/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app } from "electron";
import { showSettings } from "../helpers/settings";
import { showAbout } from "../helpers/about";

export const macOSMenuTemplate = {
    label: app.getName(),
    submenu: [
        {
            label: `About ${app.getName()}`,
            click: showAbout,
        },
        { type: "separator" },
        {
            id: "settings",
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: showSettings,
        },
        { type: "separator" },
        {
            label: "Services",
            role: "services",
            submenu: [],
        },
        {
            type: "separator",
        },
        {
            label: `Hide ${app.getName()}`,
            role: "hide",
        },
        {
            label: "Hide Others",
            role: "hideothers",
        },
        {
            label: "Show All",
            role: "unhide",
        },
        {
            type: "separator",
        },
        {
            label: `Quit ${app.getName()}`,
            role: "quit",
        },
    ],
};
