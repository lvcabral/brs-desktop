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
        const long = "C:\\Users\\test\\Documents\\Projects\\BrightScript\\mychannel.zip";
        const result = shortenPath(long, 40);
        expect(result.startsWith("C:\\")).toBe(true);
        expect(result.endsWith("mychannel.zip")).toBe(true);
        expect(result).toContain("…");
    });

    it("splits on the separator the path actually uses", () => {
        const posix = shortenPath("/a/bbbbbbbbbb/cccccccccc/dddddddddd/file.zip", 25);
        expect(posix).not.toContain("\\");
        const windows = shortenPath("D:\\a\\bbbbbbbbbb\\cccccccccc\\dddddddddd\\file.zip", 25);
        expect(windows).not.toContain("/");
    });

    // Characterization: when the filename alone nearly fills maxLen, remLen goes negative.
    // substring() then receives inverted or negative arguments, and the result can come
    // back *longer* than maxLen. The status bar is cosmetic so this is pinned, not fixed —
    // the right behaviour (truncate the filename? show only the basename?) is a UI decision.
    it("can exceed maxLen when the filename is longer than the budget", () => {
        const path = "/Users/test/Documents/a-very-long-channel-filename-indeed.zip";
        const maxLen = 30;
        const result = shortenPath(path, maxLen);
        expect(result.length).toBeGreaterThan(maxLen);
        expect(result).toMatchSnapshot();
    });

    it("handles a path with no directory component", () => {
        expect(shortenPath("averyveryverylongfilenamewithnoslashes.zip", 10)).toMatchSnapshot();
    });
});
