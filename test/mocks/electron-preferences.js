/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `@lvcabral/electron-preferences`.
 *
 * The real package destructures the electron namespace at module scope and opens a
 * BrowserWindow to render the preferences UI. This keeps the parts `src/` actually
 * relies on: dot-notation `value()` get/set, the `defaults` seed, and `on("save")`.
 */
import { EventEmitter } from "node:events";
import { vi } from "vitest";

/**
 * Read a dot-notation path out of an object
 * @param {object} target - The object to read from
 * @param {string} keyPath - Dot-separated path, e.g. "device.deviceModel"
 * @returns {*} - The value, or undefined when any segment is missing
 */
function getPath(target, keyPath) {
    return keyPath.split(".").reduce((node, key) => node?.[key], target);
}

/**
 * Write a dot-notation path into an object, creating intermediate objects
 * @param {object} target - The object to write into
 * @param {string} keyPath - Dot-separated path
 * @param {*} value - The value to store
 */
function setPath(target, keyPath, value) {
    const keys = keyPath.split(".");
    const last = keys.pop();
    const parent = keys.reduce((node, key) => (node[key] ??= {}), target);
    parent[last] = value;
}

export default class ElectronPreferences extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.preferences = structuredClone(options.defaults ?? {});
        this.show = vi.fn(() => null);
        this.close = vi.fn();
        this.broadcastSections = vi.fn();
        this.getSectionByName = vi.fn((name) => options.sections?.find((section) => section.id === name));
    }

    /**
     * The shipped defaults, cloned so a caller cannot mutate the schema. The save handler in
     * src/helpers/settings.js reads this to fall back on a default remote key mapping.
     * @returns {object} - The defaults passed to the constructor
     */
    get defaults() {
        return structuredClone(this.options.defaults ?? {});
    }

    /**
     * Get or set a preference by dot-notation key
     * @param {string} keyPath - Dot-separated path, e.g. "services.ecp"
     * @param {*} [value] - When provided, the value to store
     * @returns {*} - The stored value when reading; undefined when writing
     */
    value(keyPath, value) {
        if (value === undefined) {
            return getPath(this.preferences, keyPath);
        }
        setPath(this.preferences, keyPath, value);
        return undefined;
    }
}
