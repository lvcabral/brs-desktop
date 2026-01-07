/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

export const windowMenuTemplate = {
    label: "Window",
    role: "window",
    submenu: [
        {
            label: "Minimize",
            accelerator: "CmdOrCtrl+M",
            role: "minimize",
        },
        {
            label: "Zoom",
            role: "zoom",
        },
        {
            type: "separator",
        },
        {
            label: "Bring All to Front",
            role: "front",
        },
    ],
};
