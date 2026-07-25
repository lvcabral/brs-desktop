/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import "../../../src/helpers/hash";

describe("String.prototype.hashCode", () => {
    it("installs itself on the String prototype", () => {
        expect(typeof "".hashCode).toBe("function");
    });

    it("is stable across calls", () => {
        const input = "/Users/test/Documents/channel.zip";
        expect(input.hashCode()).toBe(input.hashCode());
    });

    it("returns a decimal string for non-empty input", () => {
        const hash = "dev.zip".hashCode();
        expect(typeof hash).toBe("string");
        expect(hash).toMatch(/^\d+$/);
    });

    it("distinguishes different inputs", () => {
        expect("a.zip".hashCode()).not.toBe("b.zip".hashCode());
        expect("/tmp/one.zip".hashCode()).not.toBe("/tmp/two.zip".hashCode());
    });

    it("is case sensitive", () => {
        expect("Channel".hashCode()).not.toBe("channel".hashCode());
    });

    it("handles non-ASCII input", () => {
        expect("café.zip".hashCode()).toMatch(/^\d+$/);
        expect("日本語.zip".hashCode()).toMatch(/^\d+$/);
    });

    // Characterization: the empty-string early return yields the *number* 0, while every
    // other input goes through Math.abs(hash).toString() and yields a string. Callers use
    // the result to build filenames (see genAppRegistry in src/server/ecp.js), where the
    // implicit coercion hides the inconsistency.
    it("returns the number 0 for an empty string, not the string \"0\"", () => {
        expect("".hashCode()).toBe(0);
        expect(typeof "".hashCode()).toBe("number");
    });

    it("never returns a negative value", () => {
        // hash is coerced to a signed 32-bit int internally, so Math.abs is load-bearing.
        const samples = ["z".repeat(50), "\u{1F600}", "////", "dev", String(Number.MAX_SAFE_INTEGER)];
        for (const sample of samples) {
            expect(Number(sample.hashCode())).toBeGreaterThanOrEqual(0);
        }
    });
});
