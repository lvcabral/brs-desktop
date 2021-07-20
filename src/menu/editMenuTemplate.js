/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { showSettings } from "../helpers/settings";
import { copyScreenshot } from "../helpers/window";
const isMacOS = process.platform === "darwin";

export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            enabled: false,
            click: () => {
                copyScreenshot();
            }
        },
        { type: "separator" },
        { 
            id: "settings",
            label: "Settings...", 
            visible: !isMacOS,
            accelerator: "CmdOrCtrl+,",
            click: () => {
                showSettings();
            }
        }
    ]
};
