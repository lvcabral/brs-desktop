import { app, BrowserWindow, Menu } from "electron";
import { fileMenuTemplate } from "./fileMenuTemplate";
import { editMenuTemplate } from "./editMenuTemplate";
import { deviceMenuTemplate } from "./deviceMenuTemplate";
import { viewMenuTemplate } from "./viewMenuTemplate";
import { helpMenuTemplate } from "./helpMenuTemplate";
import jetpack from "fs-jetpack";

const isMacOS = process.platform === "darwin";
const maxFiles = 7;
const userDataDir = jetpack.cwd(app.getPath("userData"));
const recentFilesJson = "recent-files.json";
let recentFiles;
let recentMenu;
let menuTemplate;

export function createMenu() {
    menuTemplate = [ fileMenuTemplate, editMenuTemplate, deviceMenuTemplate, viewMenuTemplate, helpMenuTemplate ];
    if(!isMacOS) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    }
    restoreRecentFiles();
}

export function getRecentPackage(index) {
    return recentFiles.zip[index];
}

export function addRecentPackage(filePath) {
    let idx = recentFiles.zip.indexOf(filePath);
    if (idx === 0) {
        return;
    } else if (idx > 0) {
        recentFiles.zip.splice(idx, 1);
    }
    recentFiles.zip.unshift(filePath);
    saveRecentFiles();
    rebuildRecentMenu();
}

export function addRecentSource(filePath) {
    let idx = recentFiles.brs.indexOf(filePath);
    if (idx === 0) {
        return;
    } else if (idx > 0) {
        recentFiles.brs.splice(idx, 1);
    }
    recentFiles.brs.unshift(filePath);
    saveRecentFiles();
    rebuildRecentMenu();
}

export function clearRecentFiles() {
    recentFiles = {zip:[], brs:[]};
    saveRecentFiles();
    rebuildRecentMenu();
}

function restoreRecentFiles() {
    let recentFilesDefault = {zip:[], brs:[]};
    try {
        recentFiles = userDataDir.read(recentFilesJson, "json");
    } catch (err) {
        console.error("error reading recent files json");
    }
    recentFiles = recentFiles || recentFilesDefault;
    rebuildRecentMenu(false);
}

function saveRecentFiles() {
    try {
        userDataDir.write(recentFilesJson, recentFiles, { atomic: true });
    } catch (err) {
        console.error("error saving recent files json");
    }
}

function rebuildRecentMenu(update = true) {
    if (isMacOS) {
        //TODO: Remove the magic numbers usage
        recentMenu = menuTemplate[0].submenu[5].submenu; 
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu[index];
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }           
        }
        if (recentFiles.zip.length > 0) {
            recentMenu[recentMenu.length-1].enabled = true;
            recentMenu[maxFiles].visible = false;
        } else {
            recentMenu[recentMenu.length-1].enabled = false;
            recentMenu[maxFiles].visible = true;
        }
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
    }
    else {
        const appMenu = app.getApplicationMenu();
        const recentMenu = appMenu.getMenuItemById("file-open-recent");
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu.submenu.getMenuItemById(`zip-${index}`);
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }           
        }
        if (recentFiles.zip.length > 0) {
            recentMenu.submenu.getMenuItemById("file-clear").enabled = true;
            recentMenu.submenu.getMenuItemById("zip-empty").visible = false;
        } else {
            recentMenu.submenu.getMenuItemById("file-clear").enabled = false;
            recentMenu.submenu.getMenuItemById("zip-empty").visible = true;
        }
    }
}
