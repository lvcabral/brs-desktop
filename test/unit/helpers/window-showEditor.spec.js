/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { showEditorWindow } from "../../../src/helpers/window";

// The fake window deliberately has no top-level getURL(), like a real BrowserWindow: the URL
// lives on webContents, so a handler reading window.getURL() throws here as it does in Electron.
describe("showEditorWindow", () => {
    it("brings back a minimized editor window, found by its webContents URL", () => {
        const editor = createFakeWindow(2);
        editor.webContents.getURL.mockReturnValue("app://brs/editor.html");
        editor.isMinimized.mockReturnValue(true);
        __registerWindow(editor);

        expect(showEditorWindow()).toBe(true);
        expect(editor.restore).toHaveBeenCalled();
        expect(editor.focus).toHaveBeenCalledWith({ steal: true });
    });

    it("does nothing when no editor window is open", () => {
        __registerWindow(createFakeWindow(1));
        expect(showEditorWindow()).toBe(false);
    });
});
