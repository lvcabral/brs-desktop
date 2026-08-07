/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The environment is "node", so there is no DOM: canvas and captureStream are stubbed here. That
// covers the contract between the engine's frame event and the captured track -- what gets copied,
// and when a frame is pushed -- which is the part that decides how promptly a viewer sees an
// update. The capture itself (the real captureStream, the WebRTC encode) genuinely cannot be
// tested without a browser.

const MIRROR_SIZES = {
    "480p": { width: 720, height: 540 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
};

let mirrorModule;
let mirrorCanvas; // the canvas the module created, so tests can read its dimensions
let buffer; // what brs.getDisplayBuffer() hands back
let drawnFrames; // one entry per copy into the mirror, recording the target dimensions
let requestedFrames; // one entry per track.requestFrame()

/**
 * Builds the fake display buffer the engine would expose. Its own dimensions are irrelevant to the
 * copy -- the mirror always draws into its own full size -- but width/height have to be positive
 * for the module to accept it as a frame.
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @returns {object} - The fake OffscreenCanvas
 */
function fakeBuffer(width = 1280, height = 720) {
    return { width, height };
}

beforeEach(async () => {
    drawnFrames = [];
    requestedFrames = [];
    buffer = fakeBuffer();
    mirrorCanvas = undefined;

    // The engine global, as brs.api.js injects it into the renderer.
    globalThis.brs = {
        getDisplayBuffer: () => buffer,
    };

    globalThis.document = {
        createElement: () => {
            mirrorCanvas = {
                width: 0,
                height: 0,
                getContext: () => ({
                    // Records the destination size, which is what proves the copy filled the
                    // mirror rather than the buffer's own dimensions.
                    drawImage: (_src, _x, _y, w, h) => drawnFrames.push({ width: w, height: h }),
                    fillRect: (_x, _y, w, h) => drawnFrames.push({ width: w, height: h, black: true }),
                }),
                captureStream: () => ({
                    getVideoTracks: () => [{ kind: "video", requestFrame: () => requestedFrames.push(true) }],
                }),
            };
            return mirrorCanvas;
        },
        getElementById: () => null,
    };

    // Imported fresh each time: the module keeps the canvas, the stream and the running flag in
    // module scope.
    vi.resetModules();
    mirrorModule = await import("../../../src/app/mirror.js");
    // The track only exists once the stream has been captured, which webrtc.js does before it
    // starts the mirror.
    mirrorModule.getMirrorStream();
});

afterEach(() => {
    mirrorModule.stopMirror();
    delete globalThis.brs;
    delete globalThis.document;
});

describe("mirror frame delivery", () => {
    it("copies the engine's buffer and pushes one frame per engine event", () => {
        mirrorModule.startMirror("720p");
        const pushedOnStart = requestedFrames.length;
        mirrorModule.onEngineFrame();
        expect(drawnFrames).toEqual([MIRROR_SIZES["720p"]]);
        expect(requestedFrames).toHaveLength(pushedOnStart + 1);
    });

    it("scales the buffer to the mirror rather than copying it at its own size", () => {
        // The buffer briefly disagrees with the mirror between a display-mode change and the
        // resize that follows it; the copy must still fill the mirror, or the picture would end up
        // cropped or letterboxed inside the frame.
        mirrorModule.startMirror("1080p");
        buffer = fakeBuffer(1280, 720);
        mirrorModule.onEngineFrame();
        expect(drawnFrames).toEqual([MIRROR_SIZES["1080p"]]);
    });

    it("pushes a frame on start, so a viewer joining an idle app has something to decode", () => {
        // The whole point: a settled app produces no engine frames at all, so without this the
        // viewer would sit on the "waiting" overlay indefinitely.
        mirrorModule.startMirror("720p");
        expect(requestedFrames.length).toBeGreaterThan(0);
    });

    it("pushes a frame when a second viewer joins an already-running mirror", () => {
        mirrorModule.startMirror("720p");
        requestedFrames = [];
        mirrorModule.startMirror("720p");
        expect(requestedFrames).toHaveLength(1);
    });

    it("keeps the encoder fed while the app is idle", () => {
        vi.useFakeTimers();
        try {
            mirrorModule.startMirror("720p");
            requestedFrames = [];
            // No engine frames at all in this stretch -- exactly the static-app case.
            vi.advanceTimersByTime(3000);
            expect(requestedFrames.length).toBeGreaterThanOrEqual(2);
            expect(drawnFrames).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops the keepalive once the last viewer leaves", () => {
        vi.useFakeTimers();
        try {
            mirrorModule.startMirror("720p");
            mirrorModule.stopMirror();
            requestedFrames = [];
            vi.advanceTimersByTime(5000);
            expect(requestedFrames).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("ignores engine frames before it starts and after it stops", () => {
        mirrorModule.onEngineFrame();
        expect(drawnFrames).toHaveLength(0);
        mirrorModule.startMirror("720p");
        mirrorModule.onEngineFrame();
        mirrorModule.stopMirror();
        mirrorModule.onEngineFrame();
        expect(drawnFrames).toHaveLength(1);
        expect(mirrorModule.isMirrorRunning()).toBe(false);
    });

    it("blanks the mirror on the engine's cleared event instead of copying the buffer", () => {
        // The engine leaves its buffer holding the last drawn image when the display is blanked, so
        // copying it here would leave the viewer looking at an app that has already exited.
        mirrorModule.startMirror("720p");
        mirrorModule.onEngineFrame();
        requestedFrames = [];
        drawnFrames = [];
        mirrorModule.onEngineCleared();
        expect(drawnFrames).toEqual([{ ...MIRROR_SIZES["720p"], black: true }]);
        expect(requestedFrames).toHaveLength(1);
    });

    it("ignores a cleared event when nobody is watching", () => {
        mirrorModule.onEngineCleared();
        expect(drawnFrames).toHaveLength(0);
    });

    it("survives an engine with no buffer to hand over", () => {
        // getDisplayBuffer() is null until the display module is initialized, and a renderer-side
        // engine call that throws must not take the notification chain down with it.
        mirrorModule.startMirror("720p");
        buffer = null;
        mirrorModule.onEngineFrame();
        buffer = fakeBuffer(0, 0);
        mirrorModule.onEngineFrame();
        globalThis.brs.getDisplayBuffer = () => {
            throw new Error("engine gone");
        };
        expect(() => mirrorModule.onEngineFrame()).not.toThrow();
        expect(drawnFrames).toHaveLength(0);
    });
});

describe("mirror sizing", () => {
    it("sizes the mirror from the display mode", () => {
        for (const [mode, size] of Object.entries(MIRROR_SIZES)) {
            mirrorModule.resizeMirror(mode);
            expect({ width: mirrorCanvas.width, height: mirrorCanvas.height }).toEqual(size);
        }
    });

    it("falls back to 720p for an unknown display mode", () => {
        mirrorModule.resizeMirror("4k");
        expect({ width: mirrorCanvas.width, height: mirrorCanvas.height }).toEqual(MIRROR_SIZES["720p"]);
    });

    it("keeps 480p at 4:3 so the picture is not stretched", () => {
        // The display buffer is at the mode's own aspect ratio, so a 16:9 mirror would distort SD.
        mirrorModule.resizeMirror("480p");
        expect(mirrorCanvas.width / mirrorCanvas.height).toBeCloseTo(4 / 3);
    });
});
