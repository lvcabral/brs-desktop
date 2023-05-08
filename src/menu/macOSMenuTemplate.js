/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { showSettings } from "../helpers/settings";

export const macOSMenuTemplate = {
    label: "BrightScript Emulator",
    submenu: [
        {
            label: "About BrightScript Emulator",
            role: "about",
        },
        { type: "separator" },
        {
            id: "settings",
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: () => {
                showSettings();
            },
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
            label: "Hide BrightScript Emulator",
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
            label: "Quit BrightScript Emulator",
            role: "quit",
        },
    ],
};
