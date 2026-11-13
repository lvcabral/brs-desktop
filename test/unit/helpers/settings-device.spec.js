/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach } from "vitest";
import { ipcMain } from "electron";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getSettings, setDeviceInfo } from "../../../src/helpers/settings";
import { stringifyWithMaps } from "../../../src/helpers/mapJson";
import { makeEngineDeviceInfo } from "../../fixtures/sharedObject";

describe("device identifier settings", () => {
    let win;
    let settings;

    beforeEach(() => {
        win = __registerWindow(createFakeWindow(1));
        settings = getSettings(win);
    });

    const deviceFields = () => settings.getSectionByName("device").form.groups.flatMap((group) => group.fields);

    it("binds a text field to every identifier the engine reads from deviceInfo", () => {
        const textKeys = deviceFields()
            .filter((field) => field.type === "text")
            .map((field) => field.key);
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

    describe("deviceData IPC from the renderer", () => {
        const { models } = makeEngineDeviceInfo();
        const modelOptions = () => deviceFields().find((field) => field.key === "deviceModel").options;

        it.each([
            ["structured clone", structuredClone],
            ["the JSON fallback", stringifyWithMaps],
        ])("fills the Roku Model dropdown when deviceData arrives via %s", (_, encode) => {
            delete globalThis.sharedObject.deviceInfo.models;
            ipcMain.emit("deviceData", {}, encode({ models }));
            expect(globalThis.sharedObject.deviceInfo.models).toBeInstanceOf(Map);
            expect(modelOptions()).toEqual([
                { label: "Roku 3 - 4200X", value: "4200X" },
                { label: "Roku TV - 8000X", value: "8000X" },
            ]);
        });

        it("refuses a models value that isn't a Map, so a later delivery can still fill it", () => {
            delete globalThis.sharedObject.deviceInfo.models;
            ipcMain.emit("deviceData", {}, JSON.parse(JSON.stringify({ models })));
            expect("models" in globalThis.sharedObject.deviceInfo).toBe(false);

            ipcMain.emit("deviceData", {}, { models });
            expect(globalThis.sharedObject.deviceInfo.models).toBeInstanceOf(Map);
            expect(modelOptions()).toHaveLength(2);
        });
    });
});
