/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import { ipcMain } from "electron";
import openAboutWindow from "electron-about-window";
import packageInfo from "../../package.json";

const isMacOS = process.platform === "darwin";
const aboutOptions = {
    icon_path: path.join(__dirname, "images/icon.png"),
    css_path: path.join(__dirname, "css/about.css"),
    copyright: `Copyright ${packageInfo.copyright}`,
    homepage: `${packageInfo.repository.url}#readme`,
    win_options: {},
    use_version_info: ['electron', 'chrome', 'node'].map(e => [e, process.versions[e]]),
    bug_link_text: "got bugs?",
    show_close_button: isMacOS ? "Close" : false,
};

ipcMain.on("engineVersion", (_, version) => {
    aboutOptions.use_version_info.unshift(["brs-engine", version]);
});

export function showAbout(item, window) {
    const bounds = window.getBounds();
    const w = 350;
    const h = 450;
    const x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
    const y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);
    aboutOptions.win_options = {
        parent: window,
        x: x,
        y: y,
        width: w,
        height: h,
        opacity: 0.9,
        modal: true,
        maximizable: false,
        minimizable: false,
    };
    const about = openAboutWindow(aboutOptions);
    about.setMenuBarVisibility(false);
    about.setResizable(false);
}