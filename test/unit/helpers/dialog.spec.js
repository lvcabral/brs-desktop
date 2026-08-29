/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dialog, __registerWindow, createFakeWindow } from "../../mocks/electron";
import { DIALOG_STATE_FILE } from "../../../src/constants";
import { getTestUserData } from "../../setup/global";
import { openChannelPackage, saveScreenshot, __resetDialogState } from "../../../src/helpers/dialog";

// The module under test imports `loadFile` from files.js, which registers ipcMain handlers at
// module-evaluation time. We don't want those side-effects here, so mock the module.
vi.mock("../../../src/helpers/files", () => ({
    loadFile: vi.fn(),
}));

describe("dialog — last-used folder persistence", () => {
    let fakeWindow;
    let stateFile;

    beforeEach(() => {
        fakeWindow = createFakeWindow(1);
        __registerWindow(fakeWindow);
        stateFile = path.join(getTestUserData(), DIALOG_STATE_FILE);
        // Remove any leftover state file from a previous test
        try {
            fs.unlinkSync(stateFile);
        } catch {
            // ignore
        }
        __resetDialogState();
        dialog.showOpenDialog.mockReset();
        dialog.showSaveDialog.mockReset();
    });

    describe("openChannelPackage", () => {
        it("passes no defaultPath when no state file exists", async () => {
            dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
            openChannelPackage();
            await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled());
            const opts = dialog.showOpenDialog.mock.calls[0][1];
            expect(opts.defaultPath).toBeUndefined();
        });

        it("saves the selected folder and passes it as defaultPath on the next call", async () => {
            // First call: user selects a file
            dialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ["/Users/test/channels/myapp.zip"],
            });
            openChannelPackage();
            // Wait for the promise chain to settle
            await vi.waitFor(() => expect(fs.existsSync(stateFile)).toBe(true));

            // Verify persisted state
            const persisted = JSON.parse(fs.readFileSync(stateFile, "utf8"));
            expect(persisted.openDir).toBe("/Users/test/channels");

            // Second call: should use the saved folder
            dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
            // Reset in-memory cache to prove disk persistence works
            __resetDialogState();
            openChannelPackage();
            await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalledTimes(2));
            const opts = dialog.showOpenDialog.mock.calls[1][1];
            expect(opts.defaultPath).toBe("/Users/test/channels");
        });

        it("does not persist state when the dialog is canceled", async () => {
            dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
            openChannelPackage();
            await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled());
            expect(fs.existsSync(stateFile)).toBe(false);
        });
    });

    describe("saveScreenshot", () => {
        it("passes no defaultPath when no state file exists", async () => {
            dialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
            saveScreenshot();
            await vi.waitFor(() => expect(dialog.showSaveDialog).toHaveBeenCalled());
            const opts = dialog.showSaveDialog.mock.calls[0][1];
            expect(opts.defaultPath).toBeUndefined();
        });

        it("saves the selected folder and passes it as defaultPath on the next call", async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: "/Users/test/screenshots/screen.png",
            });
            saveScreenshot();
            await vi.waitFor(() => expect(fs.existsSync(stateFile)).toBe(true));

            const persisted = JSON.parse(fs.readFileSync(stateFile, "utf8"));
            expect(persisted.saveDir).toBe("/Users/test/screenshots");

            // Second call
            dialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
            __resetDialogState();
            saveScreenshot();
            await vi.waitFor(() => expect(dialog.showSaveDialog).toHaveBeenCalledTimes(2));
            const opts = dialog.showSaveDialog.mock.calls[1][1];
            expect(opts.defaultPath).toBe("/Users/test/screenshots");
        });

        it("sends the filePath to the renderer via IPC", async () => {
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: "/Users/test/screenshots/screen.png",
            });
            saveScreenshot();
            await vi.waitFor(() =>
                expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
                    "saveScreenshot",
                    "/Users/test/screenshots/screen.png"
                )
            );
        });
    });

    describe("open and save use independent state", () => {
        it("tracks openDir and saveDir separately", async () => {
            // Open selects from one folder
            dialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ["/Users/test/apps/channel.zip"],
            });
            openChannelPackage();
            await vi.waitFor(() => expect(fs.existsSync(stateFile)).toBe(true));

            // Save selects from a different folder
            dialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: "/Users/test/pics/shot.png",
            });
            saveScreenshot();
            await vi.waitFor(() => {
                const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
                expect(state.saveDir).toBeDefined();
            });

            const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
            expect(state.openDir).toBe("/Users/test/apps");
            expect(state.saveDir).toBe("/Users/test/pics");
        });
    });
});
