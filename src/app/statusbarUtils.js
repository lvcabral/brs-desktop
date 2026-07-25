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
    if (bigPath.length <= maxLen) {
        return bigPath;
    }
    const splitter = bigPath.includes("/") ? "/" : "\\";
    const tokens = bigPath.split(splitter);
    const fileName = tokens.at(-1);

    // Nothing to elide between the drive and the filename, so shorten the name itself
    // rather than inventing separators the original path never had.
    if (tokens.length < 3) {
        return elide(fileName, maxLen);
    }

    const drive = bigPath.includes(":") ? tokens[0] : "";
    // Budget for the directories: the total, less the drive, the filename, the ellipsis
    // and the two separators around it. Clamped, because the filename alone can exceed it.
    const remLen = Math.max(0, maxLen - drive.length - fileName.length - 3);
    if (remLen === 0) {
        // No room for any directory context; keep the filename, elided if need be.
        return elide(fileName, maxLen);
    }

    const middle = tokens.slice(1, -1).join(splitter);
    const head = middle.substring(0, Math.ceil(remLen / 2));
    const tail = middle.substring(middle.length - Math.floor(remLen / 2));
    return `${drive}${splitter}${head}…${tail}${splitter}${fileName}`;
}

/**
 * Shorten a single name to fit, eliding its middle
 * @param {string} name - The name to shorten
 * @param {number} maxLen - The maximum length
 * @returns {string} - The name, no longer than maxLen
 */
function elide(name, maxLen) {
    if (name.length <= maxLen) {
        return name;
    }
    if (maxLen <= 1) {
        return name.substring(0, Math.max(0, maxLen));
    }
    // Keep the extension visible: it is the part that identifies the file type.
    const keep = maxLen - 1;
    const head = Math.ceil(keep / 2);
    const tail = Math.floor(keep / 2);
    return `${name.substring(0, head)}…${tail > 0 ? name.substring(name.length - tail) : ""}`;
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
