/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Character-to-remote-key mapping for the `press` command of the MicroDebugger shell.
// The character set matches a real Roku dev console; see PRESS_HELP in debugHelp.js.

export const PRESS_KEY_MAP = new Map([
    ["h", "home"],
    ["k", "back"],
    ["u", "up"],
    ["d", "down"],
    ["l", "left"],
    ["r", "right"],
    ["s", "select"],
    ["y", "instantreplay"],
    ["<", "rev"],
    ["b", "rev"],
    [">", "fwd"],
    ["f", "fwd"],
    ["i", "info"],
    ["=", "backspace"],
    ["p", "play"],
    ["v", "pause"],
    ["e", "enter"],
    ["a", "a"],
    ["c", "b"],
    ["o", "playonly"],
    ["t", "stop"],
    ["+", "channelup"],
    ["-", "channeldown"],
    ["\\", "volumemute"],
    ["#", "poweroff"],
    ["0", "lit_0"],
    ["1", "lit_1"],
    ["2", "lit_2"],
    ["3", "lit_3"],
    ["4", "lit_4"],
    ["5", "lit_5"],
    ["6", "lit_6"],
    ["7", "lit_7"],
    ["8", "lit_8"],
    ["9", "lit_9"],
]);

/**
 * Map one `press` character to a remote key name
 * @param {string} char - A single character from the press argument
 * @returns {string|undefined} - The remote key name, or undefined when unmapped
 */
export function getPressKey(char) {
    return PRESS_KEY_MAP.get(char.toLowerCase());
}
