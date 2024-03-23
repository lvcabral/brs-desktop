/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { macOSMenuTemplate } from "./macOSMenuTemplate";
import { fileMenuTemplate } from "./fileMenuTemplate";
import { editMenuTemplate, editSettingsMenuTemplate } from "./editMenuTemplate";
import { deviceMenuTemplate } from "./deviceMenuTemplate";
import { viewMenuTemplate } from "./viewMenuTemplate";
import { helpMenuTemplate } from "./helpMenuTemplate";
import { isInstallerEnabled } from "../server/installer";
import { isECPEnabled } from "../server/ecp";
import { isTelnetEnabled } from "../server/telnet";
import { getSimulatorOption, setDisplayOption } from "../helpers/settings";
import { loadFile, loadUrl } from "../helpers/files";
import path from "path";
import jetpack from "fs-jetpack";
import "../helpers/hash";

const isMacOS = process.platform === "darwin";
const maxFiles = 7;
const userDataDir = jetpack.cwd(app.getPath("userData"));
const recentFilesJson = "recent-files.json";

let fileMenuIndex = 0;
let recentMenuIndex = 3;
let recentFiles;
let menuTemplate;
// External Functions
export function createMenu() {
    menuTemplate = [
        fileMenuTemplate,
        editMenuTemplate,
        deviceMenuTemplate,
        viewMenuTemplate,
        helpMenuTemplate,
    ];
    if (isMacOS) {
        menuTemplate.unshift(macOSMenuTemplate);
        if (fileMenuIndex === 0) {
            fileMenuIndex = 1;
            // Only need to do it once
            const fileMenu = menuTemplate[fileMenuIndex].submenu;
            fileMenu.splice(fileMenu.length - 2, 2);
        }
    }
    restoreRecentFiles();
    rebuildMenu(true);
}

export function createShortMenu() {
    menuTemplate = [fileMenuTemplate, editSettingsMenuTemplate, helpMenuTemplate];
    if (isMacOS) {
        menuTemplate.unshift(macOSMenuTemplate);
        fileMenuIndex = 1;
    }
    restoreRecentFiles();
    rebuildMenu(true);
}

export function getChannelIds() {
    return recentFiles.ids;
}

export function getPackages() {
    return recentFiles.zip;
}

export function getRecentPackage(index) {
    return recentFiles.zip[index];
}

export function getRecentId(index) {
    const devFile = path.join(app.getPath("userData"), "dev.zip");
    if (devFile.hashCode() === recentFiles.ids[index]) {
        return "dev";
    }
    return recentFiles.ids[index];
}

export function getRecentName(index) {
    return recentFiles.names[index];
}

export function getRecentVersion(index) {
    return recentFiles.versions[index];
}

export function getRecentSource(index) {
    return recentFiles.brs[index];
}

export function clearRecentFiles() {
    recentFiles = { ids: [], zip: [], names: [], versions: [], brs: [] };
    saveRecentFiles();
    rebuildMenu();
}

export function loadPackage(id) {
    let pkg = getRecentPackage(id);
    if (typeof pkg === "string") {
        if (pkg.startsWith("http")) {
            loadUrl(pkg);
        } else {
            loadFile([pkg]);
        }
    } else {
        console.log("No recent package to load!");
    }
}

export function loadSource(id) {
    let brs = getRecentSource(id);
    if (typeof brs === "string") {
        if (brs.startsWith("http")) {
            loadUrl(brs);
        } else {
            loadFile([brs]);
        }
    } else {
        console.log("No recent file to load!");
    }
}

export function checkMenuItem(id, checked) {
    const item = app.applicationMenu.getMenuItemById(id);
    if (item) {
        item.checked = checked;
    }
}

export function enableMenuItem(id, enabled) {
    const item = app.applicationMenu.getMenuItemById(id);
    if (item) {
        item.enabled = enabled;
    }
}

export function isMenuItemEnabled(id) {
    const item = app.applicationMenu.getMenuItemById(id);
    return item ? item.enabled : false;
}

// Events
ipcMain.on("addRecentPackage", (event, currentChannel) => {
    let idx = recentFiles.ids.indexOf(currentChannel.id);
    if (idx >= 0) {
        recentFiles.ids.splice(idx, 1);
        recentFiles.zip.splice(idx, 1);
        recentFiles.names.splice(idx, 1);
        recentFiles.versions.splice(idx, 1);
    }
    recentFiles.ids.unshift(currentChannel.id);
    recentFiles.zip.unshift(currentChannel.file);
    recentFiles.names.unshift(currentChannel.title);
    recentFiles.versions.unshift(currentChannel.version);
    if (recentFiles.ids.length > maxFiles) {
        recentFiles.ids.length = maxFiles;
        recentFiles.zip.length = maxFiles;
        recentFiles.names.length = maxFiles;
        recentFiles.versions.length = maxFiles;
    }
    saveRecentFiles();
    rebuildMenu();
});

ipcMain.on("addRecentSource", (event, filePath) => {
    let idx = recentFiles.brs.indexOf(filePath);
    if (idx >= 0) {
        recentFiles.brs.splice(idx, 1);
    }
    recentFiles.brs.unshift(filePath);
    if (recentFiles.brs.length > maxFiles) {
        recentFiles.brs.length = maxFiles;
    }
    saveRecentFiles();
    rebuildMenu();
});

ipcMain.on("enableMenuItem", (event, id, enable) => {
    enableMenuItem(id, enable);
});

// Internal functions
function restoreRecentFiles() {
    let recentFilesDefault = { ids: [], zip: [], names: [], versions: [], brs: [] };
    try {
        recentFiles = userDataDir.read(recentFilesJson, "json");
    } catch (err) {
        console.error("error reading recent files json");
    }
    recentFiles = recentFiles || recentFilesDefault;
    if (!recentFiles.ids) {
        Object.assign(recentFiles, { ids: new Array(recentFiles.zip.length) });
        recentFiles.zip.forEach((value, index) => {
            recentFiles.ids[index] = value.hashCode();
        });
    }
    if (!recentFiles.names) {
        const names = new Array(recentFiles.zip.length).fill("No Title");
        Object.assign(recentFiles, { names: names });
    }
    if (!recentFiles.versions) {
        const versions = new Array(recentFiles.zip.length).fill("v0.0.0");
        Object.assign(recentFiles, { versions: versions });
    }
}

function saveRecentFiles() {
    try {
        userDataDir.write(recentFilesJson, recentFiles, { atomic: true });
    } catch (err) {
        console.error("error saving recent files json");
    }
}

function rebuildMenu(template = false) {
    const window = BrowserWindow.fromId(1);
    const appMenu = app.applicationMenu;
    if (isMacOS || template) {
        const recentMenu = menuTemplate[fileMenuIndex].submenu[recentMenuIndex].submenu;
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu[index];
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu[index + maxFiles + 2];
            if (index < recentFiles.brs.length) {
                fileMenu.label = recentFiles.brs[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        const brsEnd = maxFiles * 2 + 2;
        recentMenu[maxFiles].visible = recentFiles.zip.length === 0;
        recentMenu[brsEnd].visible = recentFiles.brs.length === 0;
        recentMenu[recentMenu.length - 1].enabled =
            recentFiles.zip.length + recentFiles.brs.length > 0;
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
        if (isMacOS && window) {
            if (appMenu.getMenuItemById("view-menu")) {
                let userTheme = global.sharedObject.theme;
                if (userTheme === "system") {
                    userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
                }
                const localeId = global.sharedObject.deviceInfo.locale;
                checkMenuItem(localeId, true);
                checkMenuItem(`theme-${userTheme}`, true);
                checkMenuItem("on-top", window.isAlwaysOnTop());
                checkMenuItem("status-bar", getSimulatorOption("statusBar"));
            }
            if (appMenu.getMenuItemById("device-menu")) {
                setDisplayOption("displayMode");
                setDisplayOption("overscanMode");
                checkMenuItem("web-installer", isInstallerEnabled);
                checkMenuItem("ecp-api", isECPEnabled);
                checkMenuItem("telnet", isTelnetEnabled);
            }
        }
    } else {
        const recentMenu = appMenu.getMenuItemById("file-open-recent").submenu;
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu.getMenuItemById(`zip-${index}`);
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu.getMenuItemById(`brs-${index}`);
            if (index < recentFiles.brs.length) {
                fileMenu.label = recentFiles.brs[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        recentMenu.getMenuItemById("zip-empty").visible = recentFiles.zip.length === 0;
        recentMenu.getMenuItemById("brs-empty").visible = recentFiles.brs.length === 0;
        recentMenu.getMenuItemById("file-clear").enabled =
            recentFiles.zip.length + recentFiles.brs.length > 0;
    }
    if (window) {
        window.webContents.send("refreshMenu");
    }
}
