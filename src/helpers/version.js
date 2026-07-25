/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compare two dotted version strings, ignoring a leading "v"
 * @param {string} current - The running version
 * @param {string} latest - The version to compare against
 * @returns {number} - 1 when latest is newer, -1 when current is newer, 0 when equal
 */
export function compareVersions(current, latest) {
    const currentParts = current.replace("v", "").split(".").map(Number);
    const latestParts = latest.replace("v", "").split(".").map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;

        if (latestPart > currentPart) {
            return 1; // Latest is newer
        } else if (latestPart < currentPart) {
            return -1; // Current is newer
        }
    }
    return 0; // Same version
}
