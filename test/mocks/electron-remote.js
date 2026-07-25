/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `@electron/remote`, which the preload uses to reach main-process globals.
 */
import { vi } from "vitest";
import { app, BrowserWindow, createFakeWindow } from "./electron.js";

export const getGlobal = vi.fn((name) => globalThis[name]);
export const getCurrentWindow = vi.fn(() => BrowserWindow.fromId(1) ?? createFakeWindow(1));
export const getCurrentWebContents = vi.fn(() => getCurrentWindow().webContents);

export { app, BrowserWindow };

export default { app, BrowserWindow, getGlobal, getCurrentWindow, getCurrentWebContents };
