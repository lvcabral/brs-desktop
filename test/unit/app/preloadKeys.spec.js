/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import {
    SEND_CHANNELS,
    RECEIVE_CHANNELS,
    convertSettingsKey,
    convertSettingsChar,
    matchesKey,
} from "../../../src/app/preloadKeys";

/**
 * Build a minimal KeyboardEvent-like object
 * @param {string} code - The KeyboardEvent.code value
 * @param {object} [modifiers] - Which modifier keys are held
 * @returns {object} - The stub event
 */
function keyEvent(code, modifiers = {}) {
    return {
        code,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        ...modifiers,
    };
}

describe("IPC channel whitelists", () => {
    it("matches their snapshots", () => {
        expect(SEND_CHANNELS).toMatchSnapshot();
        expect(RECEIVE_CHANNELS).toMatchSnapshot();
    });

    it("holds the expected number of channels", () => {
        expect(SEND_CHANNELS).toHaveLength(28);
        expect(RECEIVE_CHANNELS).toHaveLength(34);
    });

    it("has no duplicates in either direction", () => {
        expect(new Set(SEND_CHANNELS).size).toBe(SEND_CHANNELS.length);
        expect(new Set(RECEIVE_CHANNELS).size).toBe(RECEIVE_CHANNELS.length);
    });

    it("names every channel in lowerCamelCase", () => {
        for (const channel of [...SEND_CHANNELS, ...RECEIVE_CHANNELS]) {
            expect(channel).toMatch(/^[a-z][A-Za-z]*$/);
        }
    });

    it("allows setAudioMute in both directions", () => {
        // Mute is the one piece of state either side can originate.
        expect(SEND_CHANNELS).toContain("setAudioMute");
        expect(RECEIVE_CHANNELS).toContain("setAudioMute");
    });

    it("allows rtcSignal in both directions", () => {
        // WebRTC signaling is a relay: offers and candidates travel out from the renderer,
        // answers and candidates come back, so the one channel has to be listed twice.
        expect(SEND_CHANNELS).toContain("rtcSignal");
        expect(RECEIVE_CHANNELS).toContain("rtcSignal");
    });
});

describe("convertSettingsChar", () => {
    it("maps digits to Digit codes", () => {
        for (let digit = 0; digit <= 9; digit++) {
            expect(convertSettingsChar(String(digit))).toBe(`Digit${digit}`);
        }
    });

    it("uppercases letters so the code is a valid KeyboardEvent.code", () => {
        expect(convertSettingsChar("a")).toBe("KeyA");
        expect(convertSettingsChar("A")).toBe("KeyA");
        expect(convertSettingsChar("z")).toBe("KeyZ");
    });

    it.each([
        ["`", "Backquote"],
        ["-", "Minus"],
        ["=", "Equal"],
        ["[", "BracketLeft"],
        ["]", "BracketRight"],
        [";", "Semicolon"],
        ["'", "Quote"],
        [",", "Comma"],
        [".", "Period"],
        ["\\", "Backslash"],
        ["/", "Slash"],
    ])("maps %s to %s", (char, expected) => {
        expect(convertSettingsChar(char)).toBe(expected);
    });

    it("passes unmapped characters through", () => {
        expect(convertSettingsChar("!")).toBe("!");
    });
});

describe("convertSettingsKey", () => {
    it("defaults to Home when nothing is stored", () => {
        // preload.js relies on this: the Home key binding must always resolve to something.
        expect(convertSettingsKey(null)).toBe("Home");
        expect(convertSettingsKey(undefined)).toBe("Home");
        expect(convertSettingsKey("")).toBe("Home");
    });

    it("converts bare characters and arrows", () => {
        expect(convertSettingsKey("a")).toBe("KeyA");
        expect(convertSettingsKey("7")).toBe("Digit7");
        expect(convertSettingsKey("Left")).toBe("ArrowLeft");
        expect(convertSettingsKey("Down")).toBe("ArrowDown");
    });

    it("converts the right-hand side of a modifier combination", () => {
        expect(convertSettingsKey("Shift+a")).toBe("Shift+KeyA");
        expect(convertSettingsKey("Control+Left")).toBe("Control+ArrowLeft");
    });

    it("strips spaces", () => {
        expect(convertSettingsKey("Page Up")).toBe("PageUp");
    });

    it("leaves named keys alone", () => {
        expect(convertSettingsKey("Home")).toBe("Home");
        expect(convertSettingsKey("Escape")).toBe("Escape");
    });
});

describe("matchesKey", () => {
    it("matches a bare key with no modifiers held", () => {
        expect(matchesKey(keyEvent("Home"), "Home")).toBe(true);
        expect(matchesKey(keyEvent("KeyA"), "KeyA")).toBe(true);
    });

    it("rejects a bare key when any modifier is held", () => {
        // Otherwise Ctrl+Home would also trigger the plain Home binding.
        for (const modifier of ["shiftKey", "ctrlKey", "altKey", "metaKey"]) {
            expect(matchesKey(keyEvent("Home", { [modifier]: true }), "Home")).toBe(false);
        }
    });

    it("rejects a different key", () => {
        expect(matchesKey(keyEvent("KeyB"), "KeyA")).toBe(false);
    });

    it.each([
        ["Shift+KeyA", "shiftKey"],
        ["Control+KeyA", "ctrlKey"],
        ["Alt+KeyA", "altKey"],
        ["Meta+KeyA", "metaKey"],
    ])("matches %s when the matching modifier is held", (keyCode, modifier) => {
        expect(matchesKey(keyEvent("KeyA", { [modifier]: true }), keyCode)).toBe(true);
        expect(matchesKey(keyEvent("KeyA"), keyCode)).toBe(false);
    });

    it.each(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"])(
        "accepts the sided modifier alias %s",
        (alias) => {
            const modifier = alias.startsWith("Shift") ? "shiftKey" : "ctrlKey";
            expect(matchesKey(keyEvent("KeyA", { [modifier]: true }), `${alias}+KeyA`)).toBe(true);
        }
    );

    it("matches a three-part chord", () => {
        const held = { shiftKey: true, ctrlKey: true };
        expect(matchesKey(keyEvent("KeyA", held), "Control+Shift+KeyA")).toBe(true);
        // ...and still rejects it when one of the named modifiers is missing.
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true }), "Control+Shift+KeyA")).toBe(false);
        expect(matchesKey(keyEvent("KeyA", { ...held, altKey: true }), "Control+Shift+KeyA")).toBe(false);
    });

    it("is case insensitive about the modifier name", () => {
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true }), "SHIFT+KeyA")).toBe(true);
    });

    it("rejects a combination when an unnamed modifier is also held", () => {
        // A binding names the modifiers it wants; anything else held means the user pressed
        // a different chord. The bare-key branch above has always enforced this.
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true, ctrlKey: true }), "Shift+KeyA")).toBe(false);
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true, altKey: true }), "Shift+KeyA")).toBe(false);
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true, metaKey: true }), "Shift+KeyA")).toBe(false);
        // The named modifier on its own still matches.
        expect(matchesKey(keyEvent("KeyA", { shiftKey: true }), "Shift+KeyA")).toBe(true);
    });
});
