/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { shortenPath, getUIType } from "../../../src/app/statusbarUtils";

describe("getUIType", () => {
    it.each([
        ["480p", "SD"],
        ["720p", "HD"],
        ["1080p", "FHD"],
    ])("maps %s to %s", (resolution, expected) => {
        expect(getUIType(resolution)).toBe(expected);
    });

    it("falls back to HD for anything unrecognised", () => {
        expect(getUIType("4K")).toBe("HD");
        expect(getUIType("")).toBe("HD");
        expect(getUIType(undefined)).toBe("HD");
    });
});

describe("shortenPath", () => {
    it("returns short paths untouched", () => {
        const short = "/tmp/app.zip";
        expect(shortenPath(short, 40)).toBe(short);
        // Exactly at the limit is still untouched; only strictly longer is shortened.
        expect(shortenPath("/tmp/abc.zip", 12)).toBe("/tmp/abc.zip");
    });

    it("elides the middle of a long POSIX path", () => {
        const long = "/Users/test/Documents/Projects/BrightScript/channels/mychannel.zip";
        const result = shortenPath(long, 40);
        expect(result).toContain("…");
        // The filename is the part the user actually needs to recognise.
        expect(result.endsWith("mychannel.zip")).toBe(true);
        expect(result.length).toBeLessThan(long.length);
    });

    it("keeps the drive letter on a Windows path", () => {
        const long = String.raw`C:\Users\test\Documents\Projects\BrightScript\mychannel.zip`;
        const result = shortenPath(long, 40);
        expect(result.startsWith("C:\\")).toBe(true);
        expect(result.endsWith("mychannel.zip")).toBe(true);
        expect(result).toContain("…");
    });

    it("splits on the separator the path actually uses", () => {
        const posix = shortenPath("/a/bbbbbbbbbb/cccccccccc/dddddddddd/file.zip", 25);
        expect(posix).not.toContain("\\");
        const windows = shortenPath(String.raw`D:\a\bbbbbbbbbb\cccccccccc\dddddddddd\file.zip`, 25);
        expect(windows).not.toContain("/");
    });

    it("never exceeds maxLen, even when the filename alone is longer", () => {
        // remLen used to go negative here, handing substring() inverted arguments and
        // producing a result longer than the budget it was asked to fit.
        const path = "/Users/test/Documents/a-very-long-channel-filename-indeed.zip";
        const maxLen = 30;
        const result = shortenPath(path, maxLen);
        expect(result.length).toBeLessThanOrEqual(maxLen);
        expect(result).toMatchSnapshot();
    });

    it("never exceeds maxLen across a range of budgets", () => {
        const paths = [
            "/Users/test/Documents/Projects/BrightScript/channels/mychannel.zip",
            "/Users/test/Documents/a-very-long-channel-filename-indeed.zip",
            String.raw`C:\Users\test\Documents\Projects\a-long-name.zip`,
            "averyveryverylongfilenamewithnoslashes.zip",
        ];
        for (const path of paths) {
            for (let maxLen = 8; maxLen <= 60; maxLen++) {
                expect(shortenPath(path, maxLen).length).toBeLessThanOrEqual(maxLen);
            }
        }
    });

    it("leaves a bare filename alone rather than injecting separators", () => {
        // There is no directory to elide, so the old code inserted backslashes into a
        // name that never contained any.
        const bare = "averyveryverylongfilenamewithnoslashes.zip";
        const result = shortenPath(bare, 20);
        expect(result).not.toContain("\\");
        expect(result.length).toBeLessThanOrEqual(20);
        expect(result).toMatchSnapshot();
    });
});
