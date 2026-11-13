/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Serialization helpers for the `deviceData` IPC, shared by the renderer (strip + stringify) and
// main (parse). brs-engine's `deviceData` carries binary buffers, which make Electron's structured
// clone throw, and Maps (`models`, `videoFormats`, `drmInfo`), which plain JSON turns into `{}`.
// Losing either silently empties things like the Roku Model dropdown in Settings. Electron-free so
// both processes can import it.

const MAP_TAG = "__brsMap__";

// Tag check rather than `instanceof SharedArrayBuffer`, which throws when the global is absent
// (a window that isn't cross-origin isolated).
const BUFFER_TAG = /^\[object (Shared)?ArrayBuffer\]$/;

/**
 * Returns a shallow copy of a record without its top-level `ArrayBuffer`/`SharedArrayBuffer`
 * values, filtered by type rather than by key so a buffer brs-engine adds later is covered too.
 * @param {object} record - The record to filter
 * @returns {object} - A copy holding every non-buffer entry
 */
export function stripBuffers(record) {
    return Object.fromEntries(
        Object.entries(record).filter(([, value]) => !BUFFER_TAG.test(Object.prototype.toString.call(value)))
    );
}

/**
 * `JSON.stringify` that encodes every Map, however deeply nested, as a tagged entries array.
 * @param {*} value - The value to serialize
 * @returns {string} - JSON text for `parseWithMaps()`
 */
export function stringifyWithMaps(value) {
    return JSON.stringify(value, (_, item) => (item instanceof Map ? { [MAP_TAG]: [...item] } : item));
}

/**
 * `JSON.parse` that turns the tagged entries arrays written by `stringifyWithMaps()` back into
 * Maps. Revivers run bottom-up, so nested Maps come back without any recursion here.
 * @param {string} text - JSON text from `stringifyWithMaps()`
 * @returns {*} - The parsed value with its Maps restored
 */
export function parseWithMaps(text) {
    return JSON.parse(text, (_, item) => (Array.isArray(item?.[MAP_TAG]) ? new Map(item[MAP_TAG]) : item));
}
