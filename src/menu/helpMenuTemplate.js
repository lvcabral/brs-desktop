/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { shell } from "electron";
import { showAbout } from "../helpers/about";
import { checkForUpdates } from "../helpers/updates";
import packageInfo from "../../package.json";

const isMacOS = process.platform === "darwin";

export const helpMenuTemplate = {
    label: "&Help",
    submenu: [
        {
            label: "Documentation",
            accelerator: "F1",
            click: () => {
                shell.openExternal(`${packageInfo.repository.url}#readme`);
            },
        },
        {
            label: "Control Keyboard Reference",
            accelerator: "CmdOrCtrl+F1",
            click: () => {
                shell.openExternal(
                    `${packageInfo.repository.url}/blob/master/docs/control-reference.md`
                );
            },
        },
        { type: "separator" },
        {
            label: "Release Notes",
            click: () => {
                shell.openExternal(`${packageInfo.repository.url}/blob/master/CHANGELOG.md`);
            },
        },
        {
            label: "View License",
            click: () => {
                shell.openExternal(`${packageInfo.repository.url}/blob/master/LICENSE`);
            },
        },
        { type: "separator" },
        {
            label: "Check for Updates...",
            click: () => {
                checkForUpdates(true).catch((error) => {
                    console.error("Manual update check failed:", error);
                });
            },
        },
        { type: "separator", visible: !isMacOS },
        {
            label: "About",
            visible: !isMacOS,
            click: showAbout,
        },
    ],
};
