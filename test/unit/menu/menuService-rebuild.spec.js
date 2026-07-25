/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Regression guard: rebuildMenu() reads `nativeTheme.shouldUseDarkColors` when the user
 * theme is "system", but menuService.js used not to import `nativeTheme` from electron.
 * On macOS that threw a ReferenceError partway through the rebuild — after the application
 * menu had been swapped in, but before the checkMenuItem() calls and the trailing
 * "refreshMenu" push, leaving the menu visibly out of sync with the app state.
 */
describe("rebuildMenu with the system theme on macOS", () => {
    let platform;
    let menuService;
    let settings;
    let electron;
    let win;

    beforeEach(async () => {
        platform = Object.getOwnPropertyDescriptor(process, "platform");
        // isMacOS is captured at module scope, so it has to be stubbed before the import.
        Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

        // Everything below must come from the same post-reset module graph. A statically
        // imported helper would hold the pre-reset electron mock, with its own window
        // registry, and BrowserWindow.fromId(1) inside menuService would return null.
        vi.resetModules();
        electron = await import("../../mocks/electron.js");
        settings = await import("../../../src/helpers/settings");
        menuService = await import("../../../src/menu/menuService");

        win = electron.__registerWindow(electron.createFakeWindow(1));
        settings.getSettings(win);
        // The first build populates app.applicationMenu, which the macOS branch reads.
        menuService.createMenu();
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", platform);
        vi.resetModules();
    });

    it("resolves the system theme without throwing", () => {
        globalThis.sharedObject.theme = "system";
        expect(() => menuService.createMenu()).not.toThrow();
    });

    it.each([
        [true, "theme-dark"],
        [false, "theme-light"],
    ])("resolves system to %s -> checks %s", (shouldUseDarkColors, expectedId) => {
        electron.nativeTheme.shouldUseDarkColors = shouldUseDarkColors;
        globalThis.sharedObject.theme = "system";
        menuService.createMenu();

        expect(electron.app.applicationMenu.getMenuItemById(expectedId).checked).toBe(true);
    });

    it("leaves an explicit theme untouched", () => {
        electron.nativeTheme.shouldUseDarkColors = true;
        globalThis.sharedObject.theme = "light";
        menuService.createMenu();

        // "light" must win over the OS preference; only "system" defers to nativeTheme.
        expect(electron.app.applicationMenu.getMenuItemById("theme-light").checked).toBe(true);
    });

    it("still pushes refreshMenu after resolving the theme", () => {
        win.sent.length = 0;
        globalThis.sharedObject.theme = "system";
        menuService.createMenu();

        // This send is the last statement in rebuildMenu(); before the fix the
        // ReferenceError aborted the function before reaching it.
        expect(win.sentOn("refreshMenu")).toHaveLength(1);
    });
});
