/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `electron-prompt`, imported by `src/menu/fileMenuTemplate.js`.
 *
 * The real package resolves Electron's main-process exports through `@electron/remote` at
 * module load and throws outside a real Electron runtime. It opens a modal input dialog,
 * so there is nothing to exercise headlessly either.
 */
import { vi } from "vitest";

let nextResult = null;

/**
 * Queue what the next prompt should resolve with
 * @param {string|null} value - The value the user would have typed, or null for cancel
 */
export function __setPromptResult(value) {
    nextResult = value;
}

const prompt = vi.fn(() => Promise.resolve(nextResult));

export default prompt;
