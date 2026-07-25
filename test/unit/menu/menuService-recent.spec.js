/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { app, ipcMain, createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { fileMenuTemplate, maxMenuFiles } from "../../../src/menu/fileMenuTemplate";
import { getSettings } from "../../../src/helpers/settings";
import {
    createMenu,
    restoreRecentFiles,
    getRecentPackage,
    getAppList,
    clearRecentFiles,
} from "../../../src/menu/menuService";
import "../../../src/helpers/hash";

const RECENT_FILES_JSON = () => path.join(app.getPath("userData"), "recent-files.json");

/**
 * Seed the on-disk recent-files store and reload it
 * @param {object} contents - The JSON to write
 */
function seedRecentFiles(contents) {
    fs.writeFileSync(RECENT_FILES_JSON(), JSON.stringify(contents));
    restoreRecentFiles();
}

/**
 * Announce an opened app the way the renderer does
 * @param {object} currentApp - The app descriptor
 */
function addRecentPackage(currentApp) {
    ipcMain.emit("addRecentPackage", {}, currentApp);
}

/**
 * Start from an empty store with a built menu, which the addRecentPackage handler needs:
 * it calls rebuildMenu(), which reads both the menu template and the preferences store.
 */
function setupMenu() {
    fs.rmSync(RECENT_FILES_JSON(), { force: true });
    const win = __registerWindow(createFakeWindow(1));
    getSettings(win);
    createMenu();
}

describe("restoreRecentFiles", () => {
    beforeEach(() => {
        setupMenu();
    });

    it("starts empty when there is no store yet", () => {
        restoreRecentFiles();
        expect(getAppList()).toEqual([]);
    });

    it("survives a corrupt store rather than throwing", () => {
        fs.writeFileSync(RECENT_FILES_JSON(), "{ not json");
        expect(() => restoreRecentFiles()).not.toThrow();
        expect(getAppList()).toEqual([]);
    });

    it("back-fills ids, names and versions from a legacy store", () => {
        // Older builds stored only the zip paths.
        seedRecentFiles({ zip: ["/tmp/one.zip", "/tmp/two.zip"] });
        const apps = getAppList();
        expect(apps).toHaveLength(2);
        expect(apps[0].id).toBe("/tmp/one.zip".hashCode());
        expect(apps.map((entry) => entry.title)).toEqual(["No Title", "No Title"]);
        expect(apps.map((entry) => entry.version)).toEqual(["v0.0.0", "v0.0.0"]);
    });

    it("leaves a complete store untouched", () => {
        seedRecentFiles({
            ids: ["abc"],
            zip: ["/tmp/one.zip"],
            names: ["My App"],
            versions: ["1.2.3"],
        });
        expect(getAppList()[0]).toMatchObject({ id: "abc", title: "My App", version: "1.2.3" });
    });
});

describe("getAppList", () => {
    beforeEach(() => {
        setupMenu();
    });

    it("builds an icon URL from the hashed package path", () => {
        seedRecentFiles({ ids: ["abc"], zip: ["/tmp/one.zip"], names: ["A"], versions: ["1.0.0"] });
        const [entry] = getAppList();
        const expected = path.join(app.getPath("userData"), `${"/tmp/one.zip".hashCode()}.png`);
        expect(entry.icon).toBe(`file://${expected}`);
    });
});

describe("addRecentPackage", () => {
    beforeEach(() => {
        setupMenu();
    });

    it("puts the most recent package first", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        addRecentPackage({ id: "2", path: "/tmp/two.zip", title: "Two", version: "2.0.0" });
        expect(getRecentPackage(0)).toBe("/tmp/two.zip");
        expect(getRecentPackage(1)).toBe("/tmp/one.zip");
    });

    it("moves a repeat entry to the front instead of duplicating it", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        addRecentPackage({ id: "2", path: "/tmp/two.zip", title: "Two", version: "2.0.0" });
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.1" });

        const apps = getAppList();
        expect(apps).toHaveLength(2);
        expect(apps[0].path).toBe("/tmp/one.zip");
        // The re-opened entry carries its newer metadata.
        expect(apps[0].version).toBe("1.0.1");
    });

    it("keeps the four parallel arrays the same length", () => {
        for (let index = 0; index < 5; index++) {
            addRecentPackage({
                id: String(index),
                path: `/tmp/app${index}.zip`,
                title: `App ${index}`,
                version: "1.0.0",
            });
        }
        const stored = JSON.parse(fs.readFileSync(RECENT_FILES_JSON(), "utf8"));
        const lengths = [stored.ids, stored.zip, stored.names, stored.versions].map((a) => a.length);
        expect(new Set(lengths).size).toBe(1);
        expect(lengths[0]).toBe(5);
    });

    it("caps the store at 30 entries", () => {
        for (let index = 0; index < 35; index++) {
            addRecentPackage({
                id: String(index),
                path: `/tmp/app${index}.zip`,
                title: `App ${index}`,
                version: "1.0.0",
            });
        }
        const stored = JSON.parse(fs.readFileSync(RECENT_FILES_JSON(), "utf8"));
        expect(stored.zip).toHaveLength(30);
        // The oldest entries are the ones dropped.
        expect(stored.zip[0]).toBe("/tmp/app34.zip");
        expect(stored.zip).not.toContain("/tmp/app0.zip");
    });

    it("normalises the sideloaded dev package id", () => {
        // A package at userData/dev.zip is always id "dev"; anything else gets a hashed id,
        // so the two directions have to be corrected in both directions.
        const devPath = path.join(app.getPath("userData"), "dev.zip");
        addRecentPackage({ id: "somehash", path: devPath, title: "Dev", version: "1.0.0" });
        expect(getAppList()[0].id).toBe("dev");

        addRecentPackage({ id: "dev", path: "/tmp/other.zip", title: "Other", version: "1.0.0" });
        expect(getAppList()[0].id).toBe("/tmp/other.zip".hashCode());
    });

    it("pushes the refreshed app list to the renderer", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        expect(globalThis.sharedObject.deviceInfo.appList[0]).toMatchObject({
            id: "1",
            title: "One",
        });
    });
});

describe("clearRecentFiles", () => {
    beforeEach(() => {
        setupMenu();
    });

    it("empties the store", () => {
        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        clearRecentFiles();
        expect(getAppList()).toEqual([]);
        expect(globalThis.sharedObject.deviceInfo.appList).toEqual([]);
    });
});

describe("recent-file menu", () => {
    beforeEach(() => {
        setupMenu();
    });

    /**
     * The generated "Open Recent" submenu from the live template
     * @returns {object[]} - The submenu items
     */
    function recentSubmenu() {
        return fileMenuTemplate.submenu.find((item) => item.id === "file-open-recent").submenu;
    }

    it("generates one entry per menu slot plus the placeholder controls", () => {
        const ids = recentSubmenu().map((item) => item.id ?? item.type);
        for (let index = 0; index < maxMenuFiles; index++) {
            expect(ids).toContain(`zip-${index}`);
        }
        expect(ids).toContain("zip-empty");
        expect(ids).toContain("file-clear");
    });

    it("shows the placeholder only while the store is empty", () => {
        const placeholder = () => recentSubmenu().find((item) => item.id === "zip-empty");
        const clear = () => recentSubmenu().find((item) => item.id === "file-clear");
        expect(placeholder().visible).toBe(true);
        expect(clear().enabled).toBe(false);

        addRecentPackage({ id: "1", path: "/tmp/one.zip", title: "One", version: "1.0.0" });
        expect(placeholder().visible).toBe(false);
        expect(clear().enabled).toBe(true);
    });

    it("shows at most maxMenuFiles entries however many are stored", () => {
        // The store keeps more than the menu displays, so rebuilding with a full store
        // must not run off the end of the generated submenu.
        for (let index = 0; index < maxMenuFiles + 10; index++) {
            addRecentPackage({
                id: String(index),
                path: `/tmp/app${index}.zip`,
                title: `App ${index}`,
                version: "1.0.0",
            });
        }
        const visible = recentSubmenu().filter((item) => item.id?.startsWith("zip-") && item.visible);
        expect(visible).toHaveLength(maxMenuFiles);
    });
});
