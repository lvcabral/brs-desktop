/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// A fixed-size mirror of the simulator display, used as the frame source for the Remote
// Screen WebRTC stream.
//
// Driven by the engine's "framePainted" event (brs.setFrameNotify) rather than sampled on a timer. The
// engine repaints only when the running app draws something, so a settled app can post nothing for
// seconds while a busy one posts at 60fps; polling was both late on the first and wasteful on the
// second. The event fires after the repaint, so whatever is copied here is a complete frame.
//
// Copied from brs.getDisplayBuffer(), not from #display. The visible canvas is sized to the window
// (CSS size x devicePixelRatio) and can be far smaller than the frame, which would stream an
// upscaled, blurry picture; it may also carry overscan guidelines drawn on top. The buffer is always
// at the native resolution of the display mode and has neither problem. A canvas of our own is still
// required because an OffscreenCanvas has no captureStream(), and keeping it at a size derived from
// the display mode keeps the track dimensions stable for the whole session, so only a deliberate
// display-mode change disturbs the stream.

// How often a frame is pushed with nothing new to show. The encoder needs to be fed even while the
// app is idle, or a viewer that connects during a static stretch has nothing to decode and sits on
// the "waiting" overlay until the app happens to redraw.
const KEEPALIVE_MS = 1000;

// Mirrors the engine's own getDisplayModeDims(), which is internal and not re-exported, so the
// values are duplicated here. 480p is 4:3, not 16:9 -- sizing it 1280x720 would stretch the
// picture, because the display buffer is at the mode's own aspect ratio (4/3 for 480p) and the
// mirror has to keep that ratio for a plain drawImage to be undistorted.
const MIRROR_SIZES = {
    "480p": { width: 720, height: 540 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
};
const DEFAULT_SIZE = MIRROR_SIZES["720p"];

let mirror;
let mirrorCtx;
let stream;
let captureTrack;
let keepaliveHandle;
let running = false;

/**
 * Creates the mirror canvas on first use. It never joins the document -- it only has to be
 * paintable, and captureStream() does not require an attached element.
 * @returns {HTMLCanvasElement} - The mirror canvas
 */
function ensureMirror() {
    if (!mirror) {
        mirror = document.createElement("canvas");
        mirror.width = DEFAULT_SIZE.width;
        mirror.height = DEFAULT_SIZE.height;
        mirrorCtx = mirror.getContext("2d", { alpha: false });
    }
    return mirror;
}

/**
 * Resizes the mirror to match a display mode. Changing the canvas size mid-session forces the
 * peer connections to renegotiate, which is why this is driven only by display-mode changes
 * and not by window resizes.
 * @param {string} displayMode - "480p", "720p" or "1080p"
 */
export function resizeMirror(displayMode) {
    const size = MIRROR_SIZES[displayMode] ?? DEFAULT_SIZE;
    const canvas = ensureMirror();
    if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width;
        canvas.height = size.height;
    }
}

/**
 * Returns the shared MediaStream, creating it on first call. One stream is reused across every
 * viewer: WebRTC allows the same track on multiple senders, so N viewers cost N encodes but
 * only one capture.
 *
 * Captured at frame rate 0, which puts the track under our control: it emits a frame only when
 * requestFrame() is called. Letting the browser sample on its own clock instead would add up to a
 * frame interval of latency to every update, which is the delay the engine's frame event exists to
 * remove.
 * @returns {MediaStream} - The captured stream
 */
export function getMirrorStream() {
    ensureMirror();
    if (!stream) {
        stream = mirror.captureStream(0);
        [captureTrack] = stream.getVideoTracks();
    }
    return stream;
}

/**
 * Copies the engine's display buffer into the mirror and pushes it to the stream.
 * Called on every engine "framePainted" event while at least one viewer is connected.
 */
export function onEngineFrame() {
    if (!running) {
        return;
    }
    // Tolerant by design: this runs from an engine callback in the renderer, where a throwing
    // engine call would take the whole notification chain with it. getDisplayBuffer() is also
    // null until the display module is initialized.
    let source;
    try {
        source = brs.getDisplayBuffer();
    } catch {
        return;
    }
    if (!(source?.width > 0 && source?.height > 0)) {
        return;
    }
    // A 1:1 blit in the normal case: the mirror is sized from the display mode and the buffer is at
    // that same native resolution. It is scaled rather than copied verbatim only in the moment
    // between a display-mode change and the mirror being resized to match.
    mirrorCtx.drawImage(source, 0, 0, mirror.width, mirror.height);
    pushFrame();
}

/**
 * Blanks the mirror and pushes the result. Called on the engine's "frameCleared" event, which is raised
 * when the display goes black, most visibly when an app exits.
 *
 * Deliberately not served from the buffer: the engine never clears bufferCanvas, so it still holds
 * the last drawn frame. Copying it here would leave the viewer on the app's final image after it had
 * quit, which is the one case a frame event cannot express.
 */
export function onEngineCleared() {
    if (!running) {
        return;
    }
    mirrorCtx.fillStyle = "black";
    mirrorCtx.fillRect(0, 0, mirror.width, mirror.height);
    pushFrame();
}

/**
 * Emits whatever the mirror currently holds as a stream frame.
 */
function pushFrame() {
    // requestFrame is Chromium-only, and this only ever runs under Electron. Guarded anyway so a
    // track that somehow lacks it degrades to a still picture instead of throwing on every frame.
    captureTrack?.requestFrame?.();
}

/**
 * Starts mirroring. Idempotent, so every viewer that joins can call it.
 * @param {string} [displayMode] - Sizes the mirror before the first frame
 */
export function startMirror(displayMode) {
    ensureMirror();
    if (displayMode) {
        resizeMirror(displayMode);
    }
    if (running) {
        // Still push one frame: a viewer joining an already-running stream needs something to
        // decode now, and the app it is watching may not redraw for a long time.
        pushFrame();
        return;
    }
    running = true;
    pushFrame();
    keepaliveHandle = setInterval(pushFrame, KEEPALIVE_MS);
}

/**
 * Stops mirroring. Called when the last viewer leaves -- left running, every engine frame would
 * still pay for a full-resolution blit with nobody watching.
 */
export function stopMirror() {
    running = false;
    if (keepaliveHandle !== undefined) {
        clearInterval(keepaliveHandle);
        keepaliveHandle = undefined;
    }
}

/**
 * Whether frames are currently being mirrored.
 * @returns {boolean} - True while mirroring is active
 */
export function isMirrorRunning() {
    return running;
}
