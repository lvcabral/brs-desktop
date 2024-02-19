/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { contextBridge, ipcRenderer, shell } = require("electron");
const { getCurrentWebContents, getGlobal } = require('@electron/remote')
const customTitlebar = require("custom-electron-titlebar");
const Mousetrap = require("mousetrap");
const path = require("path");
const isMacOS = process.platform === "darwin";

let onPreferencesUpdatedHandler = () => { };
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
    onPreferencesUpdated: (handler) => {
        onPreferencesUpdatedHandler = handler;
    },
    getConsoleBuffer: () => {
        return ipcRenderer.sendSync("getConsoleBuffer");
    },
    isStatusEnabled: () => {
        const settings = ipcRenderer.sendSync("getPreferences");
        const options = settings?.simulator?.options;
        return options ? options.includes("statusBar") : false;
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
            backgroundColor: customTitlebar.TitlebarColor.fromHex(bgColor),
            itemBackgroundColor: customTitlebar.TitlebarColor.fromHex(itColor),
            icon: "./images/icon.png",
            containerOverflow: "hidden",
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
        titleBarConfig.backgroundColor = customTitlebar.TitlebarColor.fromHex(bgColor);
        titleBar.updateBackground(titleBarConfig.backgroundColor);
        titleBar.updateItemBGColor(customTitlebar.TitlebarColor.fromHex(itColor));
    },
    enableMenuItem: (id, enable) => {
        ipcRenderer.send("enableMenuItem", id, enable);
        if (titleBar) {
            titleBar.refreshMenu();
        }
    },
    processPlatform: () => { return process.platform; },
    send: (channel, data) => {
        // whitelist channels
        let validChannels = [
            "telnet",
            "addRecentSource",
            "addRecentPackage",
            "openConsole",
            "debugStarted",
            "setAudioMute",
            "deviceData",
            "serialNumber",
            "engineVersion",
            "saveFile",
            "saveIcon",
            "updateRegistry",
            "showEditor",
            "keySent",
            "runCode",
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
            "debugCommand",
            "setTheme",
            "setDisplay",
            "setOverscan",
            "setLocale",
            "setDeviceInfo",
            "setCustomKeys",
            "setAudioMute",
            "toggleStatusBar",
            "serverStatus",
            "copyScreenshot",
            "saveScreenshot",
            "fileSelected",
            "openEditor",
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        } else {
            console.warn(`api.receive() - invalid channel: ${channel}`);
        }
    }
});

ipcRenderer.on("refreshMenu", () => {
    if (titleBar) {
        titleBar.refreshMenu();
        if (!isMacOS) {
            titleBar.updateTitleAlignment("center");
        }
    }
});

ipcRenderer.on("preferencesUpdated", (e, preferences) => {
    onPreferencesUpdatedHandler(preferences);
});
