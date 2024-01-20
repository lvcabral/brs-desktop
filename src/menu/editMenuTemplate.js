/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { showSettings } from "../helpers/settings";
import { copyScreenshot } from "../helpers/window";
const isMacOS = process.platform === "darwin";

export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:", visible: isMacOS, },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:", visible: isMacOS, },
        { type: "separator", visible: isMacOS, },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:", visible: isMacOS, },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:", visible: isMacOS, },
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+Shift+C",
            enabled: false,
            click: () => {
                copyScreenshot();
            },
        },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:", visible: isMacOS, },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:", visible: isMacOS, },
        { type: "separator" },
        {
            id: "settings",
            label: "Settings...",
            visible: !isMacOS,
            accelerator: "CmdOrCtrl+,",
            click: () => {
                showSettings();
            },
        },
    ],
};

export const editSettingsMenuTemplate = {
    label: "&Edit",
    submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ],
};
