/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `@electron/remote/main`, whose `initialize()`/`enable()` are pure
 * side effects on the real Electron runtime and have nothing to assert in tests.
 */
import { vi } from "vitest";

export const initialize = vi.fn();
export const enable = vi.fn();

export default { initialize, enable };
