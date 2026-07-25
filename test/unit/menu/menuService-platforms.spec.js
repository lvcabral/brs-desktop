/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../../../src/helpers/hash";

/**
 * rebuildMenu() takes two quite different paths. On macOS, and whenever it is called with
 * `template`, it rewrites the raw menu template array in place. Everywhere else it walks
 * the *built* application menu with getMenuItemById, chaining through a submenu.
 *
 * The rest of the menu suite runs on whatever platform the developer happens to be using,
 * so on a Mac the second path was never taken and a Windows/Linux crash went unnoticed
 * until CI ran the suite on those runners. These cases pin both paths on every platform.
 */
describe.each(["darwin", "win32", "linux"])("recent files menu on %s", (platform) => {
    let platformDescriptor;
    let electron;
    let menuService;
    let settings;

    beforeEach(async () => {
        platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
        // isMacOS is captured at module scope, so the platform must be set before import.
        Object.defineProperty(process, "platform", { value: platform, configurable: true });
        vi.resetModules();
        electron = await import("../../mocks/electron.js");
        settings = await import("../../../src/helpers/settings");
        menuService = await import("../../../src/menu/menuService");

        const win = electron.__registerWindow(electron.createFakeWindow(1));
        settings.getSettings(win);
        fs.rmSync(path.join(electron.app.getPath("userData"), "recent-files.json"), { force: true });
        menuService.createMenu();
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", platformDescriptor);
        vi.resetModules();
    });

    /**
     * Announce an opened app the way the renderer does
     * @param {object} currentApp - The app descriptor
     */
    function addRecentPackage(currentApp) {
        electron.ipcMain.emit("addRecentPackage", {}, currentApp);
    }

    it("records a recent package without throwing", () => {
        // The non-macOS path reaches the submenu through getMenuItemById, which only works
        // if a built MenuItem's submenu answers that call the way Electron's does.
        expect(() => addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" })).not.toThrow();
        expect(menuService.getRecentPackage(0)).toBe("/tmp/one.zip");
    });

    it("keeps the most recent package first across several opens", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        addRecentPackage({ id: "2", path: "/tmp/two.zip", title: "Two", version: "2.0.0" });
        expect(menuService.getRecentPackage(0)).toBe("/tmp/two.zip");
        expect(menuService.getRecentPackage(1)).toBe("/tmp/one.zip");
    });

    it("clears the store without throwing", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        expect(() => menuService.clearRecentFiles()).not.toThrow();
        expect(menuService.getAppList()).toEqual([]);
    });

    it("rebuilds a full store without running off the end of the menu", () => {
        for (let index = 0; index < 35; index++) {
            addRecentPackage({
                id: String(index),
                path: `/tmp/app${index}.zip`,
                title: `App ${index}`,
                version: "1.0.0",
            });
        }
        expect(menuService.getAppList()).toHaveLength(30);
    });

    it("pushes the refreshed app list to the renderer", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        expect(globalThis.sharedObject.deviceInfo.appList[0]).toMatchObject({
            id: "1",
            title: "One",
        });
    });
});
