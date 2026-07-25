/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getSettings, setRemoteKeys } from "../../../src/helpers/settings";

const DEFAULTS = {
    keyBack: "Escape",
    keyHome: "Home",
    keyInfo: "Insert",
    keyReplay: "Backspace",
    keyPlayPause: "End",
    keyRev: "PageUp",
    keyFwd: "PageDown",
    keyMute: "F10",
};

describe("setRemoteKeys", () => {
    let win;
    let settings;

    beforeEach(() => {
        win = __registerWindow(createFakeWindow(1));
        settings = getSettings(win);
    });

    /**
     * Read the custom key map pushed to the renderer, if any
     * @returns {Map|undefined} - The map sent on the setCustomKeys channel
     */
    function sentCustomKeys() {
        return win.sentOn("setCustomKeys")[0]?.args[0];
    }

    it("pushes only the keys that differ from the defaults", () => {
        setRemoteKeys(DEFAULTS, { ...DEFAULTS, keyHome: "F1" });
        expect([...sentCustomKeys().entries()]).toEqual([["F1", "home"]]);
    });

    it("sends nothing when every key is at its default", () => {
        setRemoteKeys(DEFAULTS, { ...DEFAULTS });
        expect(win.sentOn("setCustomKeys")).toHaveLength(0);
    });

    it("restores the default for a cleared key", () => {
        setRemoteKeys(DEFAULTS, { ...DEFAULTS, keyMute: "" });
        expect(settings.value("remote.keyMute")).toBe("F10");
    });

    // A settings file written by an older build, or edited by hand, can be missing a remote
    // key entirely. Only `=== ""` was guarded, so a nullish value reached convertKey, which
    // calls .replaceAll on it — an exception thrown inside the settings-save IPC handler.
    it.each([
        ["undefined", undefined],
        ["null", null],
    ])("restores the default for a %s key instead of throwing", (_label, value) => {
        expect(() => setRemoteKeys(DEFAULTS, { ...DEFAULTS, keyInfo: value })).not.toThrow();
        expect(settings.value("remote.keyInfo")).toBe("Insert");
    });

    it("survives a settings object missing every remote key", () => {
        expect(() => setRemoteKeys(DEFAULTS, {})).not.toThrow();
        expect(settings.value("remote.keyBack")).toBe("Escape");
        expect(settings.value("remote.keyMute")).toBe("F10");
    });
});
