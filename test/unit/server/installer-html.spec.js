/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    buildScreenshotHtml,
    buildInstallHtml,
    handlePostResponse,
} from "../../../src/server/installer";

/**
 * Build a stand-in for a Node ServerResponse
 * @returns {object} - The stub response with spies
 */
function fakeResponse() {
    return { writeHead: vi.fn(), end: vi.fn() };
}

describe("buildScreenshotHtml", () => {
    it("shows the captured image on success", () => {
        const html = buildScreenshotHtml(true);
        expect(html).toContain("Screenshot ok");
        expect(html).toContain("pkgs/dev.png?time=");
        expect(html).not.toContain("Screenshot failed");
    });

    it("cache-busts the image with a timestamp", () => {
        // Without the query string the browser would keep showing the previous capture.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-25T12:00:00Z"));
        try {
            expect(buildScreenshotHtml(true)).toContain(`pkgs/dev.png?time=${Date.now()}`);
        } finally {
            vi.useRealTimers();
        }
    });

    it("explains the failure when there is no image", () => {
        const html = buildScreenshotHtml(false);
        expect(html).toContain("Screenshot failed");
        expect(html).not.toContain("<img");
    });
});

describe("buildInstallHtml", () => {
    it("reports the number of bytes stored on success", () => {
        const html = buildInstallHtml(123456, null);
        expect(html).toContain("123456");
        expect(html.toLowerCase()).toContain("received");
    });

    it("reports the error instead when the upload failed", () => {
        const html = buildInstallHtml(0, "disk full");
        expect(html).toContain("disk full");
    });

    it("matches its snapshot in both states", () => {
        expect(buildInstallHtml(2048, null)).toMatchSnapshot();
        expect(buildInstallHtml(0, "EACCES")).toMatchSnapshot();
    });
});

describe("handlePostResponse", () => {
    let res;

    beforeEach(() => {
        res = fakeResponse();
    });

    it("confirms a delete", () => {
        handlePostResponse(res, "delete", 0, null);
        expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "text/plain" });
        expect(res.end).toHaveBeenCalledWith("File Deleted!");
    });

    it("answers 501 for an unrecognised submit action", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            handlePostResponse(res, "nonesuch", 0, null);
            expect(res.writeHead).toHaveBeenCalledWith(501);
            expect(res.end).toHaveBeenCalledWith(
                "Error 501: Not Implemented\nMethod not Implemented"
            );
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it("answers 501 when no action was submitted at all", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            handlePostResponse(res, "", 0, null);
            expect(res.writeHead).toHaveBeenCalledWith(501);
        } finally {
            warn.mockRestore();
        }
    });
});
