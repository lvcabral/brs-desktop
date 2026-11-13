/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { stripBuffers, stringifyWithMaps, parseWithMaps } from "../../../src/helpers/mapJson";
import { makeEngineDeviceInfo } from "../../fixtures/sharedObject";

const { models } = makeEngineDeviceInfo();

describe("stringifyWithMaps / parseWithMaps", () => {
    it("round-trips top-level and nested Maps", () => {
        const source = {
            deviceModel: "4200X",
            models,
            drmInfo: new Map([["Widevine", { multikey: true, levels: new Map([["L3", 1]]) }]]),
            list: [new Map([["a", 1]])],
        };
        const parsed = parseWithMaps(stringifyWithMaps(source));
        expect(parsed).toEqual(source);
        expect(parsed.models).toBeInstanceOf(Map);
        expect(parsed.drmInfo.get("Widevine").levels).toBeInstanceOf(Map);
        expect(parsed.list[0]).toBeInstanceOf(Map);
    });

    it("drops what JSON can't represent, as JSON.stringify would", () => {
        expect(parseWithMaps(stringifyWithMaps({ fn: () => 1, missing: undefined, kept: 1 }))).toEqual({ kept: 1 });
    });
});

describe("stripBuffers", () => {
    it("drops ArrayBuffer and SharedArrayBuffer values whatever their key, leaving the source intact", () => {
        const source = {
            deviceModel: "4200X",
            models,
            assets: new ArrayBuffer(8),
            registryBuffer: new SharedArrayBuffer(8),
            someFutureBuffer: new SharedArrayBuffer(4),
        };
        const stripped = stripBuffers(source);
        expect(Object.keys(stripped)).toEqual(["deviceModel", "models"]);
        expect(stripped.models).toBe(models);
        expect(source.registryBuffer).toBeInstanceOf(SharedArrayBuffer);
    });
});
