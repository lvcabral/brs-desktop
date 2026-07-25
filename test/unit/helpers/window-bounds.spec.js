/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, afterEach } from "vitest";
import { screen } from "../../mocks/electron.js";
import { windowWithinBounds, ensureVisibleOnSomeDisplay } from "../../../src/helpers/window";

const PRIMARY = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
};

// A monitor arranged to the left of the primary, which is where negative coordinates
// come from — and the case that strands a window when that monitor is unplugged.
const LEFT_OF_PRIMARY = {
    id: 2,
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
};

const DEFAULT_SIZE = { width: 1280, height: 770 };

describe("windowWithinBounds", () => {
    it("accepts a window fully inside the display", () => {
        expect(windowWithinBounds({ x: 100, y: 100, width: 800, height: 600 }, PRIMARY.bounds)).toBe(true);
    });

    it("accepts a window flush against the edges", () => {
        expect(windowWithinBounds({ x: 0, y: 0, width: 1920, height: 1080 }, PRIMARY.bounds)).toBe(true);
    });

    it.each([
        ["off the left edge", { x: -1, y: 100, width: 800, height: 600 }],
        ["off the top edge", { x: 100, y: -1, width: 800, height: 600 }],
        ["off the right edge", { x: 1200, y: 100, width: 800, height: 600 }],
        ["off the bottom edge", { x: 100, y: 600, width: 800, height: 600 }],
    ])("rejects a window %s", (_label, windowState) => {
        expect(windowWithinBounds(windowState, PRIMARY.bounds)).toBe(false);
    });

    it("handles a display at a negative origin", () => {
        expect(windowWithinBounds({ x: -1800, y: 50, width: 800, height: 600 }, LEFT_OF_PRIMARY.bounds)).toBe(true);
        expect(windowWithinBounds({ x: -1800, y: 50, width: 800, height: 600 }, PRIMARY.bounds)).toBe(false);
    });

    it("accepts a zero-size window inside the display", () => {
        expect(windowWithinBounds({ x: 10, y: 10, width: 0, height: 0 }, PRIMARY.bounds)).toBe(true);
    });
});

describe("ensureVisibleOnSomeDisplay", () => {
    afterEach(() => {
        screen.__setDisplays([PRIMARY]);
    });

    it("leaves a visible window untouched", () => {
        screen.__setDisplays([PRIMARY]);
        const state = { x: 100, y: 100, width: 1280, height: 770 };
        expect(ensureVisibleOnSomeDisplay(state, DEFAULT_SIZE)).toBe(state);
    });

    it("recentres a window that is off every display", () => {
        screen.__setDisplays([PRIMARY]);
        const stranded = { x: 5000, y: 5000, width: 1280, height: 770 };
        expect(ensureVisibleOnSomeDisplay(stranded, DEFAULT_SIZE)).toEqual({
            width: 1280,
            height: 770,
            x: (1920 - 1280) / 2,
            y: (1080 - 770) / 2,
        });
    });

    it("keeps a window that is visible on a secondary display", () => {
        screen.__setDisplays([PRIMARY, LEFT_OF_PRIMARY]);
        const onSecondary = { x: -1800, y: 50, width: 800, height: 600 };
        expect(ensureVisibleOnSomeDisplay(onSecondary, DEFAULT_SIZE)).toBe(onSecondary);
    });

    it("rescues a window stranded by a disconnected monitor", () => {
        // Saved while the left-hand monitor was attached; that display is now gone.
        screen.__setDisplays([PRIMARY]);
        const stranded = { x: -1800, y: 50, width: 800, height: 600 };
        const rescued = ensureVisibleOnSomeDisplay(stranded, DEFAULT_SIZE);
        expect(rescued.x).toBeGreaterThanOrEqual(0);
        expect(rescued.y).toBeGreaterThanOrEqual(0);
        expect(windowWithinBounds(rescued, PRIMARY.bounds)).toBe(true);
    });

    it("returns the default size when it recentres", () => {
        screen.__setDisplays([PRIMARY]);
        const rescued = ensureVisibleOnSomeDisplay({ x: 9999, y: 9999, width: 300, height: 200 }, DEFAULT_SIZE);
        expect(rescued.width).toBe(DEFAULT_SIZE.width);
        expect(rescued.height).toBe(DEFAULT_SIZE.height);
    });
});
