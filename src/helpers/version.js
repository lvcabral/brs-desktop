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
/**
 * Split a version into numeric segments, ignoring any suffix on each one
 * @param {string} version - The version string, with or without a leading "v"
 * @returns {number[]} - The numeric segments
 */
function toSegments(version) {
    // parseInt rather than Number so a pre-release suffix reads as its release number:
    // Number("1-beta") is NaN, which the `|| 0` below would collapse to zero, making
    // 2.3.1-beta compare equal to 2.3.0.
    return version
        .replace("v", "")
        .split(".")
        .map((segment) => Number.parseInt(segment, 10));
}

export function compareVersions(current, latest) {
    const currentParts = toSegments(current);
    const latestParts = toSegments(latest);

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
