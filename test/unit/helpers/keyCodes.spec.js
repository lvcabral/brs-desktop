/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { convertKey, convertChar, isNumber, isLetter } from "../../../src/helpers/keyCodes";

describe("convertChar", () => {
    it("maps digits to Digit codes", () => {
        for (let digit = 0; digit <= 9; digit++) {
            expect(convertChar(String(digit))).toBe(`Digit${digit}`);
        }
    });

    it("maps uppercase letters to Key codes", () => {
        expect(convertChar("A")).toBe("KeyA");
        expect(convertChar("Z")).toBe("KeyZ");
    });

    it.each([
        ["`", "Backquote"],
        ["-", "Minus"],
        ["=", "Equal"],
        ["[", "BracketLeft"],
        ["]", "BracketRight"],
        [";", "Semicolon"],
        [",", "Comma"],
        [".", "Period"],
        ["\\", "Backslash"],
        ["/", "Slash"],
    ])("maps %s to %s", (char, expected) => {
        expect(convertChar(char)).toBe(expected);
    });

    it("passes unmapped characters through unchanged", () => {
        expect(convertChar("!")).toBe("!");
        expect(convertChar("€")).toBe("€");
    });

    // Regression guards. These two used to yield "Keya" and "quote", neither of which is a
    // valid KeyboardEvent.code, so a custom key binding stored in lowercase silently never
    // fired. The preload half always produced the correct casing; see
    // test/unit/app/preloadKeys.parity.spec.js, which enforces that the two agree.
    it("uppercases a lowercase letter", () => {
        expect(convertChar("a")).toBe("KeyA");
        expect(convertChar("z")).toBe("KeyZ");
    });

    it("maps the apostrophe to the correctly cased Quote", () => {
        expect(convertChar("'")).toBe("Quote");
    });
});

describe("convertKey", () => {
    it("converts a bare single character", () => {
        expect(convertKey("A")).toBe("KeyA");
        expect(convertKey("5")).toBe("Digit5");
        expect(convertKey(".")).toBe("Period");
    });

    it.each([
        ["Left", "ArrowLeft"],
        ["Right", "ArrowRight"],
        ["Up", "ArrowUp"],
        ["Down", "ArrowDown"],
    ])("expands the %s arrow", (key, expected) => {
        expect(convertKey(key)).toBe(expected);
    });

    it("converts the right-hand side of a modifier combination", () => {
        expect(convertKey("Shift+A")).toBe("Shift+KeyA");
        expect(convertKey("Control+5")).toBe("Control+Digit5");
        expect(convertKey("Alt+Left")).toBe("Alt+ArrowLeft");
        expect(convertKey("Meta+Down")).toBe("Meta+ArrowDown");
    });

    it("strips spaces from multi-character keys", () => {
        expect(convertKey("Page Up")).toBe("PageUp");
        expect(convertKey("Page Down")).toBe("PageDown");
    });

    it("leaves named keys that need no conversion alone", () => {
        expect(convertKey("Home")).toBe("Home");
        expect(convertKey("Enter")).toBe("Enter");
        expect(convertKey("Escape")).toBe("Escape");
        expect(convertKey("Backspace")).toBe("Backspace");
    });

    it("leaves a combination with a multi-character right side alone", () => {
        // Only single characters and the four arrows are rewritten.
        expect(convertKey("Shift+Enter")).toBe("Shift+Enter");
        expect(convertKey("Control+Home")).toBe("Control+Home");
    });

    // Characterization: only the first two segments are inspected. A three-part chord has
    // a multi-character second segment, so no branch matches and the whole string passes
    // through with spaces stripped — the trailing "+A" is never converted to "+KeyA".
    it("leaves a three-part combination unconverted", () => {
        expect(convertKey("Control+Shift+A")).toBe("Control+Shift+A");
        expect(convertKey("Control + Shift + A")).toBe("Control+Shift+A");
    });
});

describe("isNumber / isLetter", () => {
    it("recognises single digits", () => {
        expect(isNumber("0")).toBe(true);
        expect(isNumber("9")).toBe(true);
        expect(isNumber("a")).toBe(false);
        expect(isNumber("12")).toBe(false);
        expect(isNumber("")).toBe(false);
    });

    it("recognises single letters in either case", () => {
        expect(isLetter("a")).toBe(true);
        expect(isLetter("Z")).toBe(true);
        expect(isLetter("1")).toBe(false);
        expect(isLetter("ab")).toBe(false);
        expect(isLetter("")).toBe(false);
    });
});
