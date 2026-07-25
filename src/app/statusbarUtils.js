/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Pure formatting helpers for the status bar. They live apart from statusbar.js because
// that module resolves DOM elements at import time and cannot be loaded outside a browser.

/**
 * Shorten a path to fit the status bar, eliding the middle
 * (based on code by https://stackoverflow.com/users/2149492/johnpan)
 * @param {string} bigPath - The full path
 * @param {number} maxLen - The maximum length to aim for
 * @returns {string} - The shortened path, or the original when it already fits
 */
export function shortenPath(bigPath, maxLen) {
    let path = bigPath;
    if (path.length > maxLen) {
        const splitter = bigPath.includes("/") ? "/" : "\\";
        const tokens = bigPath.split(splitter);
        const drive = bigPath.includes(":") ? tokens[0] : "";
        const fileName = tokens.at(-1);
        const len = drive.length + fileName.length;
        const remLen = maxLen - len - 3; // remove the current length and also space for ellipsis char and 2 slashes
        //remove first and last elements from the array
        tokens.splice(0, 1);
        tokens.splice(-1, 1);
        //recreate our path
        path = tokens.join(splitter);
        //rebuild the path from beginning and end
        const pathA = path.substring(0, Math.ceil(remLen / 2));
        const pathB = path.substring(path.length - Math.floor(remLen / 2));
        path = `${drive}${splitter}${pathA}…${pathB}${splitter}${fileName}`;
    }
    return path;
}

/**
 * Map a display resolution to the Roku UI type shown in the status bar
 * @param {string} resolution - The display mode, e.g. "720p"
 * @returns {string} - "SD", "HD" or "FHD"
 */
export function getUIType(resolution) {
    if (resolution === "480p") {
        return "SD";
    } else if (resolution === "1080p") {
        return "FHD";
    }
    return "HD";
}
