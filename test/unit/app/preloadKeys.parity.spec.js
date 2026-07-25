/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { convertKey, convertChar } from "../../../src/helpers/keyCodes";
import { convertSettingsKey, convertSettingsChar } from "../../../src/app/preloadKeys";

/**
 * The key conversion logic exists twice: once in the main process (helpers/keyCodes.js,
 * which feeds custom key bindings to the renderer via setCustomKeys) and once in the
 * preload (app/preloadKeys.js, which matches real KeyboardEvents against them). They
 * cannot share a module because the preload is copied unbundled rather than webpacked.
 *
 * When the two disagree, a custom key binding is stored in one format and matched in
 * another, so it silently never fires. This spec is the standing guard.
 */

const SHARED_KEYS = [
    "Home", "Enter", "Escape", "Backspace", "Tab", "Space", "Delete",
    "Left", "Right", "Up", "Down",
    "A", "M", "Z", "0", "5", "9",
    "Shift+A", "Control+Left", "Alt+Down", "Meta+M",
    "Page Up", "Page Down",
    "`", "-", "=", "[", "]", ";", ",", ".", "\\", "/",
];

describe("convertKey / convertSettingsKey parity", () => {
    it.each(SHARED_KEYS)("agrees on %s", (key) => {
        expect(convertKey(key)).toBe(convertSettingsKey(key));
    });

    it("agrees on every uppercase letter", () => {
        for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
            expect(convertKey(letter)).toBe(convertSettingsKey(letter));
        }
    });

    it("agrees on every digit", () => {
        for (let digit = 0; digit <= 9; digit++) {
            expect(convertKey(String(digit))).toBe(convertSettingsKey(String(digit)));
        }
    });
});

describe("previously divergent cases", () => {
    // These two used to disagree: the main process produced "Keya" and "quote" while the
    // preload produced "KeyA" and "Quote". Since the preload does the actual matching, a
    // binding stored in the main-process format silently never fired.
    it("agrees on lowercase letters", () => {
        for (const letter of "abcdefghijklmnopqrstuvwxyz") {
            expect(convertChar(letter)).toBe(convertSettingsChar(letter));
            expect(convertChar(letter)).toBe(`Key${letter.toUpperCase()}`);
        }
    });

    it("agrees on the apostrophe", () => {
        expect(convertChar("'")).toBe(convertSettingsChar("'"));
        expect(convertChar("'")).toBe("Quote");
    });

    it("agrees on lowercase modifier combinations", () => {
        expect(convertKey("Shift+a")).toBe(convertSettingsKey("Shift+a"));
        expect(convertKey("Shift+a")).toBe("Shift+KeyA");
    });
});

describe("remaining intentional difference", () => {
    // Only the preload guards against an empty preference, because only it has a sensible
    // default to fall back to: Home is the key it is resolving in the first place.
    it("only the preload defaults an empty key to Home", () => {
        expect(convertSettingsKey(null)).toBe("Home");
        expect(() => convertKey(null)).toThrow();
    });
});
