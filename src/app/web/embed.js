/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// The embeddable stream page: video only, no controls. All of the WebRTC work is in
// signaling.js, shared with the full viewer, so this is just the wiring to a <video> element.

(function () {
    "use strict";

    const video = document.getElementById("video");
    const statusEl = document.getElementById("status");

    window.brsSignaling.connect({
        onTrack: function (stream) {
            video.srcObject = stream;
            if (!stream) {
                // Dropped: show the status again, since the last decoded frame stays on screen.
                statusEl.hidden = false;
            }
        },
        onStatus: function (text) {
            statusEl.textContent = text;
        },
        onBusy: function (maxViewers) {
            statusEl.textContent = "Already streaming to " + maxViewers + " viewers";
        },
    });

    // Driven by the video element rather than by ontrack: ontrack fires as soon as the track is
    // negotiated, which is before any frame has been decoded, so hiding the status there would
    // uncover a black rectangle. "playing" is the first point at which there is a picture.
    video.addEventListener("playing", function () {
        statusEl.hidden = true;
    });
})();
