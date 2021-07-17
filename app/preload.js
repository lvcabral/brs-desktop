const { contextBridge, ipcRenderer, remote, shell } = require("electron");
const customTitlebar = require("custom-electron-titlebar");
const Mousetrap = require("mousetrap");
const path = require("path");

const mainWindow = remote.getCurrentWindow();
const appMenu = remote.Menu.getApplicationMenu();

let onPreferencesChangedHandler = (preferences) => { };
let titleBar;
let titleBarConfig;
let titleColor;

window.addEventListener('DOMContentLoaded', () => {
    // Detect Clipboard Copy to create Screenshot
    Mousetrap.bind(["command+c", "ctrl+c"], function () {
        mainWindow.webContents.send("copyScreenshot");
        return false;
    });
});

contextBridge.exposeInMainWorld("api", {
    showPreferences: () => {
        ipcRenderer.send('showPreferences');
    },
    getPreferences: () => {
        return ipcRenderer.sendSync('getPreferences');
    },
    onPreferencesChanged: (handler) => {
        onPreferencesChangedHandler = handler;
    },
    isStatusEnabled: () => {
        return appMenu.getMenuItemById("status-bar").checked;
    },
    getDeviceInfo: () => {
        return remote.getGlobal("sharedObject").deviceInfo;
    },
    getTheme: () => {
        return remote.getGlobal("sharedObject").theme;
    },
    setBackgroundColor: (color) => {
        mainWindow.setBackgroundColor(color);
        remote.getGlobal("sharedObject").backgroundColor = color;
    },
    openExternal: (url) => {
        shell.openExternal(url);
    },
    pathParse: (fullPath) => {
        return path.parse(fullPath);
    },
    isFullScreen: () => {
        return mainWindow.isFullScreen();
    },
    toggleFullScreen: () => {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    },
    createNewTitleBar: (mnColor, bgColor, itColor) => {
        titleColor = mnColor;
        titleBarConfig = {
            backgroundColor: customTitlebar.Color.fromHex(bgColor),
            itemBackgroundColor: customTitlebar.Color.fromHex(itColor),
            icon: "./images/icon512x512.png",
            shadow: true
        };
        titleBar = new customTitlebar.Titlebar(titleBarConfig);
        titleBar.titlebar.style.color = titleColor;
    },
    updateTitle: (title) => {
        titleBar.updateTitle(title);
    },
    updateTitlebarColor: (mnColor, bgColor, itColor) => {
        titleColor = mnColor;
        titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(bgColor);
        titleBar.updateBackground(titleBarConfig.backgroundColor);
        titleBar.updateItemBGColor(customTitlebar.Color.fromHex(itColor));
        titleBar.titlebar.style.color = titleColor;
    },
    titleBarRedraw: (fullScreen) => {
        if (fullScreen) {
            titleBar.titlebar.style.display = "none";
            titleBar.container.style.top = "0px";   
        } else {
            titleBar.titlebar.style.display = "";
            titleBar.container.style.top = "30px";    
        }
    },
    enableMenuItem: (id, enable) => {
        ipcRenderer.send("enableMenuItem", id, enable);
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
            "clientException",
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

ipcRenderer.on("preferencesUpdated", (e, preferences) => {
    onPreferencesChangedHandler(preferences);
});
