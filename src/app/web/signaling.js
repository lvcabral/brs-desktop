/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared WebRTC signaling for the Remote Screen pages: the full viewer (remote.html) and the
// chrome-less embed (embed.html). Both negotiate identically -- only their UI differs -- so this
// is the one copy of the protocol.
//
// Copied unbundled like its callers, so it exposes a global rather than an export, and is loaded
// before them. The simulator is always the offerer (it owns the media track), so a page only ever
// answers; it never initiates negotiation.
//
// Usage:
//   var session = window.brsSignaling.connect({
//       onTrack: function (stream) {},   // media arrived
//       onStatus: function (text) {},    // human-readable state change
//       onBusy: function (maxViewers) {} // viewer cap reached; no reconnect will be attempted
//   });

(function () {
    "use strict";

    var SIGNALING_PATH = "/rtc-session";
    var RECONNECT_MS = 2000;
    // Matches CLOSE_CODE_BUSY in src/server/remotescreen.js. 4000-4999 is the range reserved
    // for applications.
    var CLOSE_CODE_BUSY = 4000;

    /**
     * Opens a signaling session and keeps it open, reconnecting on drop.
     * @param {object} handlers - onTrack, onStatus and onBusy callbacks, all optional
     * @returns {object} - The session, with a close() that stops reconnecting
     */
    function connect(handlers) {
        var onTrack = handlers.onTrack || function () {};
        var onStatus = handlers.onStatus || function () {};
        var onBusy = handlers.onBusy || function () {};

        var ws;
        var pc;
        var reconnectTimer;
        var busy = false;
        var closed = false;
        // Candidates that arrive before setRemoteDescription has resolved. addIceCandidate
        // rejects without a remote description, and with trickle ICE the simulator's candidates
        // routinely arrive during the answer chain, so buffering is what keeps them from
        // being lost.
        var pendingCandidates = [];

        function send(message) {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }

        /**
         * Tears down the peer connection. Called before every new negotiation and on socket
         * close, so a stale connection never lingers holding a frozen frame.
         */
        function closePeer() {
            pendingCandidates = [];
            if (pc) {
                pc.onicecandidate = null;
                pc.ontrack = null;
                pc.onconnectionstatechange = null;
                pc.close();
                pc = null;
            }
            onTrack(null);
        }

        /**
         * Reports a candidate the browser would not accept. Candidates are advisory -- one being
         * rejected does not sink the connection.
         * @param {Error} err - The rejection
         */
        function warnCandidateRejected(err) {
            console.warn("candidate rejected:", err.message);
        }

        /** Applies the candidates that arrived before there was a remote description. */
        function flushCandidates() {
            var queued = pendingCandidates;
            pendingCandidates = [];
            queued.forEach(function (candidate) {
                pc.addIceCandidate(candidate).catch(warnCandidateRejected);
            });
        }

        function onConnectionStateChange() {
            if (!pc) {
                return;
            }
            if (pc.connectionState === "disconnected") {
                // Often transient, so this only reports; ICE may still recover on its own.
                onStatus("Connection lost");
            } else if (pc.connectionState === "failed") {
                // Terminal. Dropping the socket sends the page through the reconnect path, which
                // is the only thing that produces a fresh offer -- the simulator offers on join
                // and never spontaneously renegotiates.
                onStatus("Connection failed - retrying...");
                if (ws) {
                    ws.close();
                }
            }
        }

        /**
         * Answers the simulator's offer.
         * @param {object} sdp - The remote offer
         */
        function handleOffer(sdp) {
            closePeer();
            // No ICE servers: this service is LAN-only by design, so host candidates suffice.
            pc = new RTCPeerConnection({ iceServers: [] });
            pc.ontrack = function (event) {
                onTrack(event.streams[0]);
            };
            pc.onicecandidate = function (event) {
                if (event.candidate) {
                    send({ type: "candidate", candidate: event.candidate.toJSON() });
                }
            };
            pc.onconnectionstatechange = onConnectionStateChange;
            pc.setRemoteDescription(sdp)
                .then(function () {
                    return pc.createAnswer();
                })
                .then(function (answer) {
                    return pc.setLocalDescription(answer);
                })
                .then(function () {
                    send({ type: "answer", sdp: pc.localDescription.toJSON() });
                    flushCandidates();
                })
                .catch(function (err) {
                    onStatus("Negotiation failed");
                    console.error("answer failed:", err);
                });
        }

        function handleCandidate(candidate) {
            if (!pc) {
                return;
            }
            if (pc.remoteDescription) {
                pc.addIceCandidate(candidate).catch(warnCandidateRejected);
            } else {
                pendingCandidates.push(candidate);
            }
        }

        function handleMessage(event) {
            var msg;
            try {
                msg = JSON.parse(event.data);
            } catch (err) {
                return;
            }
            if (msg.type === "offer") {
                handleOffer(msg.sdp);
            } else if (msg.type === "candidate") {
                handleCandidate(msg.candidate);
            } else if (msg.type === "busy") {
                // Latched so the close handler does not schedule a reconnect that would just be
                // refused again, hammering the simulator.
                busy = true;
                onStatus("Too many viewers");
                onBusy(msg.maxViewers);
            }
        }

        function open() {
            var scheme = location.protocol === "https:" ? "wss:" : "ws:";
            ws = new WebSocket(scheme + "//" + location.host + SIGNALING_PATH);
            ws.onopen = function () {
                onStatus("Waiting for video...");
            };
            ws.onmessage = handleMessage;
            ws.onclose = function (event) {
                closePeer();
                if (busy || closed || event.code === CLOSE_CODE_BUSY) {
                    return;
                }
                onStatus("Disconnected - retrying...");
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(open, RECONNECT_MS);
            };
            ws.onerror = function () {
                onStatus("Signaling error");
            };
        }

        open();

        return {
            close: function () {
                closed = true;
                clearTimeout(reconnectTimer);
                closePeer();
                if (ws) {
                    ws.close();
                }
            },
        };
    }

    window.brsSignaling = { connect: connect };
})();
