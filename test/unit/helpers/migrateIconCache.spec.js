/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getTestUserData } from "../../setup/global.js";
import { migrateIconCache } from "../../../src/helpers/files";
import { ICONS_DIR } from "../../../src/constants";

function iconsDir() {
    return path.join(getTestUserData(), ICONS_DIR);
}

describe("migrateIconCache", () => {
    it("moves a pre-2.5.0 icon into the icons subdirectory", () => {
        const legacyPath = path.join(getTestUserData(), "123456789.png");
        fs.writeFileSync(legacyPath, "icon-bytes");

        migrateIconCache();

        expect(fs.existsSync(legacyPath)).toBe(false);
        expect(fs.readFileSync(path.join(iconsDir(), "123456789.png"), "utf8")).toBe("icon-bytes");
    });

    it("is a no-op when there is nothing to migrate", () => {
        // Calling it twice in a row (as a fresh app start always does) must not error the second
        // time, once the first call already moved everything there was to move.
        expect(() => migrateIconCache()).not.toThrow();
        expect(() => migrateIconCache()).not.toThrow();
    });

    it("leaves unrelated userData files alone", () => {
        const settingsFile = path.join(getTestUserData(), "brs-settings.json");
        const screenshotFile = path.join(getTestUserData(), "dev.png");
        fs.writeFileSync(settingsFile, "{}");
        fs.writeFileSync(screenshotFile, "not an icon");

        migrateIconCache();

        expect(fs.existsSync(settingsFile)).toBe(true);
        expect(fs.existsSync(screenshotFile)).toBe(true);
    });

    it("prefers the already-migrated icon and clears the stale duplicate", () => {
        fs.mkdirSync(iconsDir(), { recursive: true });
        fs.writeFileSync(path.join(iconsDir(), "42.png"), "new-bytes");
        const legacyPath = path.join(getTestUserData(), "42.png");
        fs.writeFileSync(legacyPath, "stale-bytes");

        migrateIconCache();

        expect(fs.existsSync(legacyPath)).toBe(false);
        expect(fs.readFileSync(path.join(iconsDir(), "42.png"), "utf8")).toBe("new-bytes");
    });
});
