/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Conversion from the key labels stored in the remote-control preferences to the
// KeyboardEvent.code names the renderer matches against.
//
// `src/app/preload.js` carries a parallel implementation (convertSettingsKey /
// convertSettingsChar) because it is copied unbundled and cannot import from here.
// The two must agree; test/unit/app/preloadKeys.parity.spec.js is the guard.

/**
 * Convert a stored key label to a KeyboardEvent.code name
 * @param {string} keyCode - The key label, e.g. "A", "Left" or "Shift+A"
 * @returns {string} - The converted code, e.g. "KeyA", "ArrowLeft" or "Shift+KeyA"
 */
export function convertKey(keyCode) {
    const arrows = new Set(["Left", "Right", "Up", "Down"]);
    // The last segment is the key; everything before it is a modifier. Reading only the
    // first two segments would leave the key of a three-part chord unconverted, and the
    // renderer would never match the binding.
    const parts = keyCode.replaceAll(" ", "").split("+");
    const key = parts.at(-1);
    let converted = key;
    if (key.length === 1) {
        converted = convertChar(key);
    } else if (arrows.has(key)) {
        converted = `Arrow${key}`;
    }
    return [...parts.slice(0, -1), converted].join("+");
}

/**
 * Convert a single character to its KeyboardEvent.code name
 * @param {string} keyChar - A one-character key label
 * @returns {string} - The converted code, or the character itself when unmapped
 */
export function convertChar(keyChar) {
    if (isNumber(keyChar)) {
        return `Digit${keyChar}`;
    } else if (isLetter(keyChar)) {
        // KeyboardEvent.code names are always uppercase ("KeyA"), so a lowercase
        // preference has to be normalised or the renderer will never match it.
        return `Key${keyChar.toUpperCase()}`;
    } else {
        const keyMap = new Map([
            ["`", "Backquote"],
            ["-", "Minus"],
            ["=", "Equal"],
            ["[", "BracketLeft"],
            ["]", "BracketRight"],
            [";", "Semicolon"],
            ["'", "Quote"],
            [",", "Comma"],
            [".", "Period"],
            ["\\", "Backslash"],
            ["/", "Slash"],
        ]);
        return keyMap.get(keyChar) ?? keyChar;
    }
}

/**
 * Check whether a string is a single digit
 * @param {string} str - The string to check
 * @returns {boolean} - True when the string is one digit
 */
export function isNumber(str) {
    return str.length === 1 && /\d/.test(str);
}

/**
 * Check whether a string is a single letter
 * @param {string} str - The string to check
 * @returns {boolean} - True when the string is one letter
 */
export function isLetter(str) {
    return str.length === 1 && /[a-z]/i.test(str);
}
