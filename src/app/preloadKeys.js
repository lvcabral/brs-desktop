/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// CommonJS on purpose: this file is copied verbatim next to preload.js rather than bundled,
// and Electron loads preload scripts as CommonJS. Do not convert it to ESM.
//
// Key conversion here mirrors convertKey/convertChar in src/helpers/keyCodes.js. The two
// cannot share a module because preload.js is unbundled, so the parity is enforced by
// test/unit/app/preloadKeys.parity.spec.js instead.

// Channels the renderer may send to the main process. Every entry needs a matching
// ipcMain.on() handler; an unlisted channel is dropped with a console warning.
const SEND_CHANNELS = [
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
    "setPreference",
];

// Channels the renderer may listen on. Every entry needs a matching webContents.send()
// somewhere in the main process.
const RECEIVE_CHANNELS = [
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

/**
 * Convert a Settings key name to KeyboardEvent.code format
 * @param {string} keyCode - The stored key label
 * @returns {string} - The converted code; "Home" when nothing is stored
 */
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

/**
 * Convert a single character to its KeyboardEvent.code name
 * @param {string} keyChar - A one-character key label
 * @returns {string} - The converted code, or the character itself when unmapped
 */
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

/**
 * Check if a KeyboardEvent matches a converted key code.
 * Supports modifier+key combos (e.g. "Shift+KeyA")
 * @param {object} event - The keyboard event
 * @param {string} keyCode - The converted code to match against
 * @returns {boolean} - True when the event matches
 */
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

module.exports = {
    SEND_CHANNELS,
    RECEIVE_CHANNELS,
    convertSettingsKey,
    convertSettingsChar,
    matchesKey,
};
