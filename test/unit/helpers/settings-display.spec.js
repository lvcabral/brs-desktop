/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getSettings } from "../../../src/helpers/settings";

describe("UI Transitions display setting", () => {
    let win;
    let settings;

    beforeEach(() => {
        // One window for the whole file: the settings module is a singleton whose save listener keeps
        // the window it was first created with, so a fresh window per test would never see the save.
        win = __registerWindow(win ?? createFakeWindow(1));
        settings = getSettings(win);
    });

    const displayFields = () => settings.getSectionByName("display").form.groups.flatMap((group) => group.fields);

    it("offers a disable-by-presence Options checkbox, left unchecked by default", () => {
        const options = displayFields().find((item) => item.key === "options").options;
        expect(options.map((option) => option.value)).toContain("disableUiTransitions");
        expect(settings.defaults.display.options).not.toContain("disableUiTransitions");
    });

    it("pushes the disabled flag to the device info and the renderer on save", () => {
        // A save also drives every network service; keep them off so no socket is bound here.
        for (const service of ["installer", "ecp", "telnet", "debug", "screen"]) {
            settings.value(`services.${service}`, []);
        }
        settings.value("display.options", ["disableUiTransitions"]);
        settings.emit("save", settings.preferences);
        expect(globalThis.sharedObject.deviceInfo.uiTransitions).toBe(false);
        expect(win.sentOn("setDeviceInfo").map((msg) => msg.args)).toContainEqual(["uiTransitions", false]);
    });
});
