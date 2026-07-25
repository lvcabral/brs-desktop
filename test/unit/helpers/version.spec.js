/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { compareVersions } from "../../../src/helpers/version";

describe("compareVersions", () => {
    it("reports 0 for identical versions", () => {
        expect(compareVersions("2.3.0", "2.3.0")).toBe(0);
        expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
    });

    it("reports 1 when the latest release is newer", () => {
        expect(compareVersions("2.3.0", "2.3.1")).toBe(1);
        expect(compareVersions("2.3.0", "2.4.0")).toBe(1);
        expect(compareVersions("2.3.0", "3.0.0")).toBe(1);
    });

    it("reports -1 when the running build is ahead of the release", () => {
        // Normal for a local dev build between releases.
        expect(compareVersions("2.4.0", "2.3.0")).toBe(-1);
        expect(compareVersions("3.0.0", "2.9.9")).toBe(-1);
    });

    it("compares segments numerically, not as strings", () => {
        // The bug this guards: "2.10.0" < "2.9.0" under string comparison.
        expect(compareVersions("2.9.0", "2.10.0")).toBe(1);
        expect(compareVersions("2.10.0", "2.9.0")).toBe(-1);
        expect(compareVersions("1.0.0", "1.0.10")).toBe(1);
    });

    it("ignores a leading v on either side", () => {
        expect(compareVersions("v2.3.0", "2.3.0")).toBe(0);
        expect(compareVersions("2.3.0", "v2.3.0")).toBe(0);
        expect(compareVersions("v2.3.0", "v2.3.1")).toBe(1);
    });

    it("treats missing trailing segments as zero", () => {
        expect(compareVersions("2.3", "2.3.0")).toBe(0);
        expect(compareVersions("2.3.0", "2.3")).toBe(0);
        expect(compareVersions("2", "2.0.1")).toBe(1);
    });

    it("prioritises the most significant differing segment", () => {
        expect(compareVersions("2.3.9", "3.0.0")).toBe(1);
        expect(compareVersions("3.0.0", "2.99.99")).toBe(-1);
    });

    it("reads the numeric prefix of a segment with a suffix", () => {
        // 2.3.1-beta is release 2.3.1 as far as ordering goes; the suffix is ignored rather
        // than collapsing the whole segment to zero.
        expect(compareVersions("2.3.0", "2.3.1-beta")).toBe(1);
        expect(compareVersions("2.3.1-beta", "2.3.0")).toBe(-1);
    });

    it("treats a pre-release of the same version as that version", () => {
        // Deliberate: the updater offers stable releases, so 2.3.0-alpha is not "newer"
        // than 2.3.0 and does not trigger a notification.
        expect(compareVersions("2.3.0-alpha", "2.3.0")).toBe(0);
        expect(compareVersions("2.3.0", "2.3.0-rc1")).toBe(0);
    });

    it("does not offer an unparseable version as an update", () => {
        // Guard, not a fix: an unparseable segment already falls back to zero, so a
        // malformed tag reads as older and never triggers a notification.
        expect(compareVersions("2.3.0", "garbage")).toBe(-1);
        expect(compareVersions("2.3.0", "")).toBe(-1);
    });
});
