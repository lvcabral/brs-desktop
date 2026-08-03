/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Viewer page for the Remote Screen service. Served as a plain script -- it is copied, not
// bundled, so no imports, no build step and nothing newer than the browsers on the LAN.
//
// Roles: the simulator is the offerer (it owns the media track), so this page only ever
// answers. Video arrives over WebRTC; remote buttons go to ECP on its own port; text goes to
// /paste on this port.

(function () {
    "use strict";

    // How long the copy button stays on its confirmation before reverting to "Copy".
    var COPY_FEEDBACK_MS = 1500;

    var video = document.getElementById("video");
    var statusEl = document.getElementById("status");
    var bannerEl = document.getElementById("banner");
    var overlay = document.getElementById("overlay");
    var textForm = document.getElementById("textForm");
    var textInput = document.getElementById("textInput");
    var streamLink = document.getElementById("streamLink");
    var copyButton = document.getElementById("copyUrl");

    var config = { ecpPort: 8060, ecpEnabled: false, displayMode: "720p", maxViewers: 4 };

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function showBanner(text) {
        bannerEl.textContent = text;
        bannerEl.hidden = false;
    }

    /**
     * Opens the signaling session. The protocol itself lives in signaling.js, shared with the
     * embed page; this only maps its callbacks onto this page's UI.
     */
    function connect() {
        window.brsSignaling.connect({
            onTrack: function (stream) {
                video.srcObject = stream;
                if (!stream) {
                    overlay.hidden = false;
                }
            },
            onStatus: setStatus,
            onBusy: function (maxViewers) {
                showBanner("The simulator is already streaming to " + maxViewers + " viewers. Try again later.");
            },
        });
    }

    /**
     * Presses a button on the simulator through ECP.
     *
     * mode "no-cors" with no body and no custom headers makes this a CORS-safelisted simple
     * request: the browser sends it and ECP acts on it, only the response is opaque. That is
     * deliberate -- adding Access-Control-Allow-Origin to ECP would let any web page the user
     * happens to visit drive the simulator, which is worse than not seeing the result here.
     * The cost is that a failed press is invisible, which is why /config reports ecpEnabled.
     * @param {string} key - A Roku key name, e.g. "home" or "select"
     */
    function press(key) {
        if (!config.ecpEnabled) {
            return;
        }
        var url = location.protocol + "//" + location.hostname + ":" + config.ecpPort + "/keypress/" + key;
        fetch(url, { method: "POST", mode: "no-cors" }).catch(function () {
            /* opaque by design: nothing to report */
        });
    }

    // Physical keyboard, mapped to match the simulator's own bindings (keysMap in brs.api.js)
    // so muscle memory carries over from the desktop window.
    var KEY_MAP = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Enter: "select",
        Escape: "back",
        Backspace: "instantreplay",
        End: "play",
        Home: "home",
    };

    function onKeyDown(event) {
        // Let the text field have the keyboard to itself.
        if (event.target === textInput) {
            return;
        }
        var key = KEY_MAP[event.key];
        if (key) {
            event.preventDefault();
            press(key);
        }
    }

    /**
     * Sends typed text to this service's own /paste route rather than through ECP. ECP's
     * keypress path cannot carry it: restana does not percent-decode path params, so
     * /keypress/lit_%20 arrives undecoded and the engine rejects it as a multi-character key.
     * @param {string} text - The text to type into the app
     */
    function sendText(text) {
        return fetch("/paste", { method: "POST", body: text }).then(function (res) {
            if (!res.ok) {
                setStatus(res.status === 413 ? "Text too long" : "Text rejected");
            }
        });
    }

    /**
     * Copies text to the clipboard, falling back to a hidden textarea and execCommand.
     *
     * The fallback is the path that actually runs most of the time here, not a legacy branch:
     * navigator.clipboard is only exposed in a secure context, and while http://localhost counts
     * as one, http://192.168.x.x does not -- which is exactly how this page is reached from
     * another machine, the case the button exists for. execCommand("copy") is deprecated but has
     * no secure-context requirement and is the only thing available there.
     * @param {string} text - The text to place on the clipboard
     * @returns {Promise<void>} - Resolves once the text is on the clipboard
     */
    function copyToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var scratch = document.createElement("textarea");
            scratch.value = text;
            // Off-screen rather than hidden: execCommand("copy") copies the *selection*, and
            // neither display:none nor a hidden attribute can hold one.
            scratch.setAttribute("readonly", "");
            scratch.style.position = "fixed";
            scratch.style.top = "-1000px";
            document.body.appendChild(scratch);
            scratch.select();
            // iOS Safari ignores select() on a readonly field and needs an explicit range.
            scratch.setSelectionRange(0, text.length);
            var copied = false;
            try {
                // NOSONAR - deprecated, but the only clipboard API available outside a secure
                // context, which is where this page is served from. See the note above.
                copied = document.execCommand("copy");
            } catch (err) {
                copied = false;
            }
            scratch.remove();
            if (copied) {
                resolve();
            } else {
                reject(new Error("copy rejected"));
            }
        });
    }

    /** Puts the copy button back to its resting label after its confirmation has been read. */
    function resetCopyLabel() {
        copyButton.textContent = "Copy";
    }

    /**
     * Builds the address to show and copy: the embed page, on an address another machine can use.
     *
     * Two things make this more than location.origin. The URL points at /embed rather than at
     * this page, because the point of copying it is to put the *stream* in another application --
     * pasting this page's URL would embed the whole viewer, remote and all. And the host comes
     * from /config when the service is reachable over the network, because the viewer is often
     * opened from the simulator's own status bar, where location.hostname is localhost and would
     * be useless to anyone else. When the service is restricted to this machine, /config reports
     * no LAN host and the page's own origin is the honest answer.
     * @returns {string} - The absolute URL of the embeddable stream
     */
    function embedUrl() {
        if (config.lanHost) {
            return "http://" + config.lanHost + ":" + (config.port || location.port) + "/embed";
        }
        return location.origin + "/embed";
    }

    /**
     * Shows the embed address and wires the copy button. Called after /config resolves, since
     * the address depends on what it reports.
     */
    function initStreamUrl() {
        var href = embedUrl();
        streamLink.textContent = href;
        streamLink.href = href;
        copyButton.addEventListener("click", function () {
            copyToClipboard(href)
                .then(function () {
                    copyButton.textContent = "Copied";
                })
                .catch(function () {
                    // Nothing the page can do about it, but silence would look like success.
                    copyButton.textContent = "Press Ctrl+C";
                })
                .finally(function () {
                    setTimeout(resetCopyLabel, COPY_FEEDBACK_MS);
                });
        });
    }

    /**
     * Downloads the current frame. Done entirely in the page: it captures at the streamed
     * resolution rather than the simulator's native one, which is the tradeoff for adding no
     * server route and no IPC.
     */
    function screenshot() {
        if (!video.videoWidth) {
            setStatus("No video to capture");
            return;
        }
        var canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        canvas.toBlob(function (blob) {
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.href = url;
            link.download = "screenshot.png";
            link.click();
            // Deferred: revoking in the same task as the click can cancel the download before
            // the browser has finished reading the blob (Firefox in particular).
            setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 0);
        }, "image/png");
    }

    // Wiring. Buttons use pointerdown so a press registers without waiting for the click that
    // follows a touch, which on mobile is delayed by up to ~300ms.
    document.querySelectorAll("[data-key]").forEach(function (button) {
        button.addEventListener("pointerdown", function (event) {
            event.preventDefault();
            press(event.currentTarget.dataset.key);
        });
    });
    // Driven by the video element rather than by ontrack: ontrack fires as soon as the track is
    // negotiated, which is before any frame has been decoded, so hiding the overlay there would
    // uncover a black rectangle. "playing" is the first point at which there is a picture.
    video.addEventListener("playing", function () {
        overlay.hidden = true;
        setStatus("Connected");
    });
    video.addEventListener("stalled", function () {
        setStatus("Stalled");
    });
    document.addEventListener("keydown", onKeyDown);
    textForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var text = textInput.value;
        if (text.length > 0) {
            sendText(text);
            textInput.value = "";
        }
    });
    document.getElementById("screenshot").addEventListener("click", screenshot);

    // The copy button's URL depends on what /config reports, so it is wired in both the success
    // and the failure path below rather than here -- on failure it falls back to this page's
    // own origin, which is still better than a dead button.
    fetch("/config")
        .then(function (res) {
            return res.json();
        })
        .then(function (data) {
            config = data;
            if (!config.ecpEnabled) {
                showBanner(
                    "External Control Protocol is off, so the remote buttons will do nothing. " +
                        "Enable it in the simulator under Device > External Control Protocol, then reload this page."
                );
            }
        })
        .catch(function () {
            showBanner("Could not read the simulator configuration; the remote buttons may not work.");
        })
        .finally(function () {
            initStreamUrl();
            connect();
        });
})();
