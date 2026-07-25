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

    it("returns a string for the empty string, like every other input", () => {
        // The early return used to yield the number 0 while every other input went
        // through Math.abs(hash).toString(). Callers build filenames from the result,
        // so implicit coercion hid the inconsistency rather than removing it.
        expect("".hashCode()).toBe("0");
        expect(typeof "".hashCode()).toBe("string");
    });

    it("returns a string for every input", () => {
        for (const sample of ["", "a", "/tmp/x.zip", "\u{1F600}"]) {
            expect(typeof sample.hashCode()).toBe("string");
        }
    });

    it("never returns a negative value", () => {
        // hash is coerced to a signed 32-bit int internally, so Math.abs is load-bearing.
        const samples = ["z".repeat(50), "\u{1F600}", "////", "dev", String(Number.MAX_SAFE_INTEGER)];
        for (const sample of samples) {
            expect(Number(sample.hashCode())).toBeGreaterThanOrEqual(0);
        }
    });
});
