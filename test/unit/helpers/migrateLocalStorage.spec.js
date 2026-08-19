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
import { BrowserWindow, createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getTestUserData } from "../../setup/global.js";
import { migrateLocalStorage } from "../../../src/helpers/files";
import { LOCAL_STORAGE_MIGRATED_MARKER } from "../../../src/constants";

function markerFile() {
    return path.join(getTestUserData(), LOCAL_STORAGE_MIGRATED_MARKER);
}

// migrateLocalStorage() creates its own hidden BrowserWindow to read the legacy origin; the mock
// constructor registers it, so the most recently created window is that one.
function legacyWindow() {
    return BrowserWindow.getAllWindows().at(-1);
}

beforeEach(() => {
    fs.rmSync(markerFile(), { force: true });
});

describe("migrateLocalStorage", () => {
    it("replays legacy localStorage entries into the main window and writes the marker", async () => {
        const mainWindow = __registerWindow(createFakeWindow(1));
        const migration = migrateLocalStorage(mainWindow, "/fake/app/dir");
        // The hidden window is constructed synchronously, before the first await.
        legacyWindow().webContents.executeJavaScript.mockResolvedValueOnce(
            JSON.stringify([["codeId123", "@=My Code=@sub main()\nend sub"]])
        );

        await migration;

        expect(mainWindow.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
        const injected = mainWindow.webContents.executeJavaScript.mock.calls[0][0];
        expect(injected).toContain("codeId123");
        expect(injected).toContain("My Code");
        expect(fs.existsSync(markerFile())).toBe(true);
    });

    it("does not touch the main window when there is nothing to migrate", async () => {
        const mainWindow = __registerWindow(createFakeWindow(1));
        const migration = migrateLocalStorage(mainWindow, "/fake/app/dir");
        legacyWindow().webContents.executeJavaScript.mockResolvedValueOnce(JSON.stringify([]));

        await migration;

        expect(mainWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
        expect(fs.existsSync(markerFile())).toBe(true);
    });

    it("skips entirely once the marker file already exists", async () => {
        fs.writeFileSync(markerFile(), new Date().toISOString());
        const mainWindow = __registerWindow(createFakeWindow(1));
        const windowsBefore = BrowserWindow.getAllWindows().length;

        await migrateLocalStorage(mainWindow, "/fake/app/dir");

        expect(BrowserWindow.getAllWindows().length).toBe(windowsBefore);
        expect(mainWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
    });

    it("leaves the marker unwritten when the legacy window fails to load", async () => {
        const mainWindow = __registerWindow(createFakeWindow(1));
        const migration = migrateLocalStorage(mainWindow, "/fake/app/dir");
        legacyWindow().loadURL.mockRejectedValueOnce(new Error("no such file"));

        await migration;

        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it("destroys the hidden window even when the migration fails", async () => {
        const mainWindow = __registerWindow(createFakeWindow(1));
        const migration = migrateLocalStorage(mainWindow, "/fake/app/dir");
        const hidden = legacyWindow();
        hidden.loadURL.mockRejectedValueOnce(new Error("no such file"));

        await migration;

        expect(hidden.destroy).toHaveBeenCalledTimes(1);
    });
});
