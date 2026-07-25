/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { PRESS_KEY_MAP, getPressKey } from "../../../src/server/debugKeys";
import { PRESS_HELP } from "../../../src/server/debugHelp";

describe("getPressKey", () => {
    it.each([
        ["h", "home"],
        ["k", "back"],
        ["u", "up"],
        ["d", "down"],
        ["l", "left"],
        ["r", "right"],
        ["s", "select"],
        ["y", "instantreplay"],
        ["i", "info"],
        ["=", "backspace"],
        ["p", "play"],
        ["v", "pause"],
        ["e", "enter"],
        ["a", "a"],
        ["c", "b"],
        ["o", "playonly"],
        ["t", "stop"],
        ["+", "channelup"],
        ["-", "channeldown"],
        ["\\", "volumemute"],
        ["#", "poweroff"],
    ])("maps %s to %s", (char, expected) => {
        expect(getPressKey(char)).toBe(expected);
    });

    it("maps both aliases for transport controls", () => {
        // A real Roku dev console accepts either the letter or the arrow-like character.
        expect(getPressKey("b")).toBe("rev");
        expect(getPressKey("<")).toBe("rev");
        expect(getPressKey("f")).toBe("fwd");
        expect(getPressKey(">")).toBe("fwd");
    });

    it("maps every digit to its literal key", () => {
        for (let digit = 0; digit <= 9; digit++) {
            expect(getPressKey(String(digit))).toBe(`lit_${digit}`);
        }
    });

    it("is case insensitive", () => {
        expect(getPressKey("H")).toBe("home");
        expect(getPressKey("S")).toBe("select");
        expect(getPressKey("Y")).toBe("instantreplay");
    });

    it("returns undefined for unmapped characters", () => {
        // debug.js relies on this: unmapped characters are skipped rather than queued.
        for (const char of ["z", "q", "!", " ", "@"]) {
            expect(getPressKey(char)).toBeUndefined();
        }
    });
});

describe("PRESS_KEY_MAP", () => {
    it("holds one entry per documented character", () => {
        expect(PRESS_KEY_MAP.size).toBe(35);
    });

    it("matches its snapshot", () => {
        expect([...PRESS_KEY_MAP.entries()]).toMatchSnapshot();
    });

    it("documents every mapped character in the press help text", () => {
        // The `press` command with no argument prints PRESS_HELP; a character that works
        // but is not listed there is undiscoverable.
        for (const char of PRESS_KEY_MAP.keys()) {
            if (/[0-9]/.test(char)) {
                expect(PRESS_HELP).toContain("0-9");
            } else {
                expect(PRESS_HELP).toContain(char);
            }
        }
    });
});
