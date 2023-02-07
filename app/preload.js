/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { contextBridge, ipcRenderer, shell } = require("electron");
const { BrowserWindow, Menu, getCurrentWebContents, getGlobal } = require('@electron/remote')
const customTitlebar = require("custom-electron-titlebar");
const Mousetrap = require("mousetrap");
const path = require("path");

let onPreferencesChangedHandler = (preferences) => { };
let titleBar;
let titleBarConfig;
let titleColor;

window.addEventListener('DOMContentLoaded', () => {
    // Detect Clipboard Copy to create Screenshot
    Mousetrap.bind(["command+c", "ctrl+c"], function () {
        getCurrentWebContents().send("copyScreenshot");
        return false;
    });
});

contextBridge.exposeInMainWorld("api", {
    showPreferences: () => {
        ipcRenderer.send("showPreferences");
    },
    getPreferences: () => {
        return ipcRenderer.sendSync("getPreferences");
    },
    onPreferencesChanged: (handler) => {
        onPreferencesChangedHandler = handler;
    },
    isStatusEnabled: () => {
        const appMenu = Menu.getApplicationMenu();
        return appMenu.getMenuItemById("status-bar").checked;
    },
    getDeviceInfo: () => {
        return getGlobal("sharedObject").deviceInfo;
    },
    getTheme: () => {
        return getGlobal("sharedObject").theme;
    },
    setBackgroundColor: (color) => {
        ipcRenderer.send("setBackgroundColor", color);
    },
    openExternal: (url) => {
        shell.openExternal(url);
    },
    pathParse: (fullPath) => {
        return path.parse(fullPath);
    },
    isFullScreen: () => {
        return ipcRenderer.sendSync("isFullScreen");
    },
    toggleFullScreen: () => {
        ipcRenderer.send("toggleFullScreen");
    },
    createNewTitleBar: (mnColor, bgColor, itColor) => {
        titleColor = mnColor;
        titleBarConfig = {
            backgroundColor: customTitlebar.Color.fromHex(bgColor),
            itemBackgroundColor: customTitlebar.Color.fromHex(itColor),
            icon: "./images/icon512x512.png",
            enableMnemonics: true,
            shadow: true
        };
        titleBar = new customTitlebar.Titlebar(titleBarConfig);
    },
    updateTitle: (title) => {
        titleBar.updateTitle(title);
    },
    updateTitlebarColor: (mnColor, bgColor, itColor) => {
        titleColor = mnColor;
        titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(bgColor);
        titleBar.updateBackground(titleBarConfig.backgroundColor);
        titleBar.updateItemBGColor(customTitlebar.Color.fromHex(itColor));
    },
    enableMenuItem: (id, enable) => {
        ipcRenderer.send("enableMenuItem", id, enable);
        if (titleBar) {
            titleBar.refreshMenu();
        }    
    },
    send: (channel, data) => {
        // whitelist channels
        let validChannels = [
            "telnet", 
            "addRecentSource", 
            "addRecentPackage", 
            "openDevTools",
            "saveFile",
            "saveIcon",
            "reset"
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`api.send() - invalid channel: ${channel}`);
        }
    },
    receive: (channel, func) => {
        let validChannels = [
            "console",
            "postKeyDown",
            "postKeyUp",
            "postKeyPress",
            "closeChannel",
            "setTheme",
            "setDisplay",
            "setOverscan",
            "setLocale",
            "setDeviceInfo",
            "toggleStatusBar",
            "serverStatus",
            "copyScreenshot",
            "saveScreenshot",
            "fileSelected"
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        } else {
            console.warn(`api.receive() - invalid channel: ${channel}`);
        }
    }
});

ipcRenderer.on("refreshMenu", (e) => {
    if (titleBar) {
        titleBar.refreshMenu();
    }
});

ipcRenderer.on("preferencesUpdated", (e, preferences) => {
    onPreferencesChangedHandler(preferences);
});
