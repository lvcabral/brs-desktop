/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `electron-about-window`, imported by `src/helpers/about.js`.
 * The real package opens a BrowserWindow; there is nothing to assert headlessly.
 */
import { vi } from "vitest";

const openAboutWindow = vi.fn(() => null);

export default openAboutWindow;
