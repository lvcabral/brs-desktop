/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Global test setup, run once per spec file (the `forks` pool gives each file its own process).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach } from "vitest";
import { app, __resetElectronMock } from "../mocks/electron.js";
import { __resetNetworkMock } from "../mocks/network.js";
import { makeSharedObject } from "../fixtures/sharedObject.js";

// These two run at setup-module scope, not in a hook, because a spec file's static imports
// are evaluated before beforeAll fires — and several src/ modules do work at import time.
// src/helpers/about.js calls process.getSystemVersion() (Electron-only) as it loads, and
// src/menu/menuService.js resolves app.getPath("userData") to build recent-files.json.
process.getSystemVersion ??= () => "14.5.0";

// Point app.getPath("userData") at a throwaway directory so no test can write to the real
// profile, which holds recent-files.json and the app registry.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-desktop-test-"));
app.__setUserData(tmpDir);

beforeEach(() => {
    globalThis.sharedObject = makeSharedObject();
    __resetElectronMock();
    __resetNetworkMock();
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * The temp directory standing in for `app.getPath("userData")`
 * @returns {string} - The directory path
 */
export function getTestUserData() {
    return tmpDir;
}
