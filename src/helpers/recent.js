import { app, BrowserWindow } from "electron";
import jetpack from "fs-jetpack";

const maxFiles = 7;
const userDataDir = jetpack.cwd(app.getPath("userData"));
const recentFilesJson = "recent-files.json";
let recentFiles;

export function restoreRecentFiles() {
    let recentFilesDefault = {zip:[], brs:[]};
    try {
        recentFiles = userDataDir.read(recentFilesJson, "json");
    } catch (err) {
        console.error("error reading recent files json");
    }
    recentFiles = recentFiles || recentFilesDefault;    
    rebuildRecentMenu();
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

function rebuildRecentMenu() {
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

function saveRecentFiles() {
    try {
        userDataDir.write(recentFilesJson, recentFiles, { atomic: true });
    } catch (err) {
        console.error("error saving recent files json");
    }
}