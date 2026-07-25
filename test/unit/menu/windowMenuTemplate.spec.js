/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { windowMenuTemplate } from "../../../src/menu/windowMenuTemplate";

describe("windowMenuTemplate", () => {
    it("matches its snapshot", () => {
        expect(windowMenuTemplate).toMatchSnapshot();
    });

    it("declares the window role", () => {
        expect(windowMenuTemplate.label).toBe("Window");
        expect(windowMenuTemplate.role).toBe("window");
    });

    it("delegates every item to a built-in Electron role", () => {
        // This template carries no click handlers on purpose; Electron's roles handle the
        // behavior. An item with neither a role nor a separator type would silently do nothing.
        for (const item of windowMenuTemplate.submenu) {
            expect(item.role ?? item.type).toBeDefined();
        }
        expect(windowMenuTemplate.submenu.map((item) => item.role ?? item.type)).toEqual([
            "minimize",
            "zoom",
            "separator",
            "front",
        ]);
    });

    it("binds Minimize to the platform-appropriate accelerator", () => {
        const minimize = windowMenuTemplate.submenu.find((item) => item.role === "minimize");
        expect(minimize.accelerator).toBe("CmdOrCtrl+M");
    });
});
