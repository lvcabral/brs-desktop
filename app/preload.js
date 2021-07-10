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
    createNewTitleBar: (mnColor, bgColor) => {
        titleColor = mnColor;
        titleBarConfig = {
            backgroundColor: customTitlebar.Color.fromHex(bgColor),
            icon: "./images/icon512x512.png",
            shadow: true
        };
        titleBar = new customTitlebar.Titlebar(titleBarConfig);
        titleBar.titlebar.style.color = titleColor;
        // Fix text color after focus change
        titleBar.onBlur = titleBar.onFocus = function() {
            titleBar.titlebar.style.color = titleColor;
        };
    },
    updateTitle: (title) => {
        titleBar.updateTitle(title);
    },
    updateTitlebarColor: (mnColor, bgColor) => {
        titleColor = mnColor;
        titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(bgColor);
        titleBar.updateBackground(titleBarConfig.backgroundColor);
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
    checkMenuItem: (id, enable) => {
        ipcRenderer.send("checkMenuItem", id, enable);
    },
    enableMenuItem: (id, enable) => {
        ipcRenderer.send("enableMenuItem", id, enable);
    },
    send: (channel, data) => {
        // whitelist channels
        let validChannels = [
            "telnet", 
            "ECPEnabled", 
            "telnetEnabled", 
            "installerEnabled", 
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
            "updateMenu",
            "setTheme",
            "setDisplay",
            "setOverscan",
            "setLocale",
            "setPassword",
            "toggleStatusBar",
            "toggleECP",
            "toggleTelnet",
            "toggleInstaller",
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

ipcRenderer.on('preferencesUpdated', (e, preferences) => {
    onPreferencesChangedHandler(preferences);
});
