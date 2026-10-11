/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getSettings, setDeviceInfo } from "../../../src/helpers/settings";

describe("device identifier settings", () => {
    let win;
    let settings;

    beforeEach(() => {
        win = __registerWindow(createFakeWindow(1));
        settings = getSettings(win);
    });

    it("binds a text field to every identifier the engine reads from deviceInfo", () => {
        const fields = settings.getSectionByName("device").form.groups.flatMap((group) => group.fields);
        const textKeys = fields.filter((field) => field.type === "text").map((field) => field.key);
        expect(textKeys).toEqual(expect.arrayContaining(["clientId", "RIDA", "customerId", "developerId"]));
    });

    it("seeds the customerId default from the startup device info", () => {
        expect(settings.defaults.device.customerId).toBe(globalThis.sharedObject.deviceInfo.customerId);
    });

    it("pushes an edited customerId to the device info and the renderer", () => {
        const customerId = "fedcba9876543210fedcba9876543210";
        settings.value("device.customerId", customerId);
        setDeviceInfo("device", "customerId", true);
        expect(globalThis.sharedObject.deviceInfo.customerId).toBe(customerId);
        expect(win.sentOn("setDeviceInfo").map((msg) => msg.args)).toContainEqual(["customerId", customerId]);
    });
});
