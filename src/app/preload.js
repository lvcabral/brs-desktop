/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { contextBridge, ipcRenderer, shell } = require("electron");
const { getCurrentWebContents, getGlobal } = require("@electron/remote");
const customTitlebar = require("custom-electron-titlebar");
const Mousetrap = require("mousetrap");
const path = require("node:path");
const isMacOS = process.platform === "darwin";

let onPreferencesUpdatedHandler = () => {};
let titleBar;
let titleBarConfig;
let titleColor;

globalThis.addEventListener("DOMContentLoaded", () => {
    // Detect Clipboard Copy to create Screenshot
    Mousetrap.bind(["command+c", "ctrl+c"], function () {
        getCurrentWebContents().send("copyScreenshot");
        return false;
    });
    // Only apply keyboard interceptions in the main simulator window (which has the #display canvas)
    if (document.getElementById("display")) {
        // Intercept Cmd+V / Ctrl+V in capture phase to prevent "v" from reaching brs-engine
        document.addEventListener("keydown", function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "v") {
                e.preventDefault();
                e.stopImmediatePropagation();
                const { clipboard } = require("electron");
                const text = clipboard.readText();
                if (text && text.length > 0) {
                    getCurrentWebContents().send("pasteText", text);
                }
            }
        }, true); // capture phase fires before brs-engine's bubbling-phase handler

        // Intercept the Home remote key to act as "Close App"
        let homeKeyCode = convertSettingsKey(
            ipcRenderer.sendSync("getPreferences")?.remote?.keyHome ?? "Home"
        );
        document.addEventListener("keydown", function (e) {
            if (matchesKey(e, homeKeyCode)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                getCurrentWebContents().send("closeChannel", "EXIT_USER_NAV");
            }
        }, true); // capture phase fires before brs-engine's bubbling-phase handler

        // Update the Home key binding when preferences change
        ipcRenderer.on("preferencesUpdated", (_, preferences) => {
            if (preferences?.remote?.keyHome) {
                homeKeyCode = convertSettingsKey(preferences.remote.keyHome);
            }
        });
    }
});

// Convert a Settings key name to KeyboardEvent.code format
// Mirrors the convertKey/convertChar logic from settings.js
function convertSettingsKey(keyCode) {
    if (!keyCode) {
        return "Home";
    }
    const arrows = new Set(["Left", "Right", "Up", "Down"]);
    let newCode = keyCode.replaceAll(" ", "");
    if (keyCode.includes("+")) {
        const parts = keyCode.split("+");
        const leftKey = parts[0];
        const rightKey = parts[1];
        if (rightKey.length === 1) {
            newCode = `${leftKey}+${convertSettingsChar(rightKey)}`;
        } else if (arrows.has(rightKey)) {
            newCode = `${leftKey}+Arrow${rightKey}`;
        }
    } else if (keyCode.length === 1) {
        newCode = convertSettingsChar(keyCode);
    } else if (arrows.has(keyCode)) {
        newCode = `Arrow${keyCode}`;
    }
    return newCode;
}

function convertSettingsChar(keyChar) {
    if (/^\d$/.test(keyChar)) {
        return `Digit${keyChar}`;
    } else if (/^[a-zA-Z]$/.test(keyChar)) {
        return `Key${keyChar.toUpperCase()}`;
    }
    const keyMap = {
        "`": "Backquote", "-": "Minus", "=": "Equal",
        "[": "BracketLeft", "]": "BracketRight", ";": "Semicolon",
        "'": "Quote", ",": "Comma", ".": "Period",
        "\\": "Backslash", "/": "Slash",
    };
    return keyMap[keyChar] ?? keyChar;
}

// Check if a KeyboardEvent matches a converted key code
// Supports modifier+key combos (e.g. "Shift+KeyA")
function matchesKey(event, keyCode) {
    if (keyCode.includes("+")) {
        const parts = keyCode.split("+");
        const modifier = parts[0].toLowerCase();
        const code = parts[1];
        const hasModifier =
            (modifier === "shift" && event.shiftKey) ||
            (modifier === "control" && event.ctrlKey) ||
            (modifier === "alt" && event.altKey) ||
            (modifier === "meta" && event.metaKey) ||
            (modifier === "shiftleft" && event.shiftKey) ||
            (modifier === "shiftright" && event.shiftKey) ||
            (modifier === "controlleft" && event.ctrlKey) ||
            (modifier === "controlright" && event.ctrlKey);
        return hasModifier && event.code === code;
    }
    return event.code === keyCode && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
}

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
            shadow: true,
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
    processPlatform: () => {
        return process.platform;
    },
    send: (channel, data) => {
        // whitelist channels
        let validChannels = [
            "telnet",
            "addRecentPackage",
            "openConsole",
            "debugStarted",
            "setAudioMute",
            "setCaptionMode",
            "deviceData",
            "serialNumber",
            "engineVersion",
            "saveFile",
            "saveIcon",
            "updateRegistry",
            "showEditor",
            "contextMenu",
            "keySent",
            "runCode",
            "runFile",
            "runUrl",
            "currentApp",
            "reset",
            "openAppPackage",
            "closeSimulator",
            "externalVolumeReady",
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
            "postInputParams",
            "closeChannel",
            "debugCommand",
            "setTheme",
            "setDisplay",
            "setOverscan",
            "setDeviceInfo",
            "setCaptionStyle",
            "setCustomKeys",
            "setAudioMute",
            "setPerfStats",
            "setHomeScreenMode",
            "toggleStatusBar",
            "serverStatus",
            "copyScreenshot",
            "saveScreenshot",
            "pasteText",
            "executeFile",
            "openEditor",
            "editorUndo",
            "editorRedo",
            "mountExternalVolume",
            "unmountExternalVolume",
            "showToast",
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        } else {
            console.warn(`api.receive() - invalid channel: ${channel}`);
        }
    },
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
