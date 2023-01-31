/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import { shell } from "electron";
import openAboutWindow from "electron-about-window";

const isMacOS = process.platform === "darwin";

export const helpMenuTemplate = {
    label: "&Help",
    submenu: [
        {
            label: "Documentation",
            accelerator: "F1",
            click: () => {
                shell.openExternal("https://github.com/lvcabral/brs-emu-app/blob/master/README.md");
            }
        },
        {
            label: "Control Keyboard Reference",
            accelerator: "CmdOrCtrl+F1",
            click: () => {
                shell.openExternal("https://github.com/lvcabral/brs-emu-app/blob/master/docs/control-reference.md");
            }
        },
        { type: "separator" },
        {
            label: "Release Notes",
            click: () => {
                shell.openExternal("https://github.com/lvcabral/brs-emu/releases");
            }
        },
        {
            label: "View License",
            click: () => {
                shell.openExternal("https://github.com/lvcabral/brs-emu-app/blob/master/LICENSE");
            }
        },
        // { type: "separator" },
        // { label: "Check for Updates...", enabled: false },
        { type: "separator", visible: !isMacOS },
        {
            label: "About",
            visible: !isMacOS,
            click: (item, window) => {
                const bounds = window.getBounds();
                const w = 350;
                const h = 450;
                const x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
                const y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);
                const about = openAboutWindow({
                    icon_path: path.join(__dirname, "images/icon512x512.png"),
                    copyright: "Copyright © 2019-2023 Marcelo Lv Cabral",
                    win_options: {
                        parent: window,
                        x: x,
                        y: y,
                        width: w,
                        height: h,
                        opacity: 0.9,
                        modal: true
                    }
                });
                about.setMenuBarVisibility(false);
                about.setResizable(false);
            }
        }
    ]
};
