/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Renderer half of the Remote Screen service. RTCPeerConnection only exists in the renderer
// and a TCP listener only exists in the main process, so signaling is relayed over IPC:
// src/server/remotescreen.js owns the sockets, this module owns the peer connections.
//
// The simulator is the offerer -- it owns the media track, so it knows when there is
// something to negotiate about, and the viewer never has to ask for a recvonly transceiver.

import { startMirror, stopMirror, getMirrorStream, resizeMirror, onEngineFrame, onEngineCleared } from "./mirror";

// sessionId -> { pc, pending }. "pending" buffers ICE candidates that arrive before the
// answer does, which is normal with trickle ICE and fatal if addIceCandidate is called early.
const peers = new Map();

/**
 * Wires up the Remote Screen signaling handlers. Call once, after brs.initialize() has
 * claimed the display canvas so the mirror has something to copy.
 */
export function initRemoteScreen() {
    if (!document.getElementById("display")) {
        return; // not the simulator window
    }
    if (typeof brs.setFrameNotify !== "function" || typeof brs.getDisplayBuffer !== "function") {
        // Without the frame event there is nothing to drive the mirror, so the stream would be a
        // single frozen picture. Better to refuse than to serve that silently.
        console.error(
            "Remote Screen: brs-engine is missing setFrameNotify()/getDisplayBuffer() -- " +
                "requires brs-engine 2.4.0 or later. The service is disabled."
        );
        return;
    }
    api.receive("rtcViewerJoined", (data) => {
        openSession(data.sessionId).catch((err) => {
            console.error(`Remote Screen: failed to offer to ${data.sessionId}: ${err.message}`);
            // Tell main, or the viewer sits on an open socket waiting for an offer that failed
            // to be built and will never be retried.
            failSession(data.sessionId);
        });
    });
    api.receive("rtcViewerLeft", (data) => {
        closeSession(data.sessionId);
    });
    api.receive("rtcSignal", (data) => {
        applySignal(data).catch((err) => {
            console.error(`Remote Screen: bad ${data?.type} for ${data?.sessionId}: ${err.message}`);
        });
    });
    // Keep the captured track sized to the display mode. Window resizes are deliberately
    // ignored: they rewrite #display's backing store constantly, which is the whole reason
    // the mirror canvas exists. A display-mode change is rare and user-driven, so paying a
    // renegotiation for it is acceptable.
    brs.subscribe("webrtc", (event, data) => {
        if (event === "framePainted") {
            onEngineFrame();
        } else if (event === "frameCleared") {
            onEngineCleared();
        } else if (event === "display" && peers.size > 0) {
            resizeMirror(data);
        }
    });
    // Announced last, once the handlers above are live. Any viewer that connected before this
    // point never got an offer -- "rtcViewerJoined" is fire-and-forget, so it was dropped -- and
    // this prompts the main process to re-announce those sessions.
    api.send("rtcReady", {});
}

/**
 * Creates a peer connection for a viewer and sends it an offer.
 * @param {string} sessionId - The session the main process assigned
 * @returns {Promise<void>} - Resolves once the offer has been handed to the main process
 */
async function openSession(sessionId) {
    if (peers.has(sessionId)) {
        return;
    }
    // Sized before the stream is captured, so the track starts at the right dimensions rather
    // than being resized -- and renegotiated -- immediately after the first viewer connects.
    resizeMirror(brs.getDisplayMode());
    const stream = getMirrorStream();
    const [track] = stream.getVideoTracks();
    if (!track) {
        console.error("Remote Screen: display capture produced no video track");
        // Nothing was registered in "peers", so closeSession can never run to stop the capture:
        // starting the loop only after this check is what keeps it from running with no viewers.
        failSession(sessionId);
        return;
    }
    // Asked for only while someone is watching, so an unwatched simulator pays nothing for the
    // notification. Set before startMirror() so no repaint between the two goes unnoticed.
    brs.setFrameNotify(true);
    startMirror();
    // No ICE servers: this is a LAN feature, so host candidates are the only ones needed.
    // Reaching a viewer across the internet would mean adding STUN for server-reflexive
    // candidates and TURN for symmetric NAT -- and authentication, which v1 does not have.
    const pc = new RTCPeerConnection({ iceServers: [] });
    peers.set(sessionId, { pc, pending: [] });
    pc.addTrack(track, stream);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            api.send("rtcSignal", { sessionId, type: "candidate", candidate: event.candidate.toJSON() });
        }
    };
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
            // ICE gave up. The socket has to go too, so the viewer reconnects and renegotiates
            // instead of holding a slot around a connection that can never recover.
            failSession(sessionId);
        } else if (pc.connectionState === "closed") {
            closeSession(sessionId);
        }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    api.send("rtcSignal", { sessionId, type: "offer", sdp: pc.localDescription.toJSON() });
}

/**
 * Applies an answer or ICE candidate relayed from a viewer.
 * @param {object} data - The signaling message
 * @returns {Promise<void>} - Resolves once the message has been applied
 */
async function applySignal(data) {
    const session = peers.get(data?.sessionId);
    if (!session) {
        return;
    }
    if (data.type === "answer") {
        await session.pc.setRemoteDescription(data.sdp);
        // Safe to apply the buffered candidates now that there is a remote description.
        for (const candidate of session.pending) {
            await session.pc.addIceCandidate(candidate);
        }
        session.pending = [];
    } else if (data.type === "candidate") {
        if (session.pc.remoteDescription) {
            await session.pc.addIceCandidate(data.candidate);
        } else {
            session.pending.push(data.candidate);
        }
    }
}

/**
 * Tears down a session and asks the main process to close its socket.
 *
 * Used for the failure paths, where closeSession() alone is not enough: it only cleans up on this
 * side, leaving the socket open around a dead peer connection. Since an offer is only ever sent
 * when a viewer joins, nothing would renegotiate, and the viewer would hold one of the four slots
 * until its tab closed. Closing the socket instead makes the page reconnect and start over.
 * @param {string} sessionId - The session that failed
 */
function failSession(sessionId) {
    closeSession(sessionId);
    api.send("rtcSessionFailed", { sessionId });
}

/**
 * Tears down one viewer's peer connection, stopping the capture loop once the last one goes.
 * @param {string} sessionId - The session to close
 */
function closeSession(sessionId) {
    const session = peers.get(sessionId);
    if (!session) {
        return;
    }
    session.pc.onicecandidate = null;
    session.pc.onconnectionstatechange = null;
    session.pc.close();
    peers.delete(sessionId);
    if (peers.size === 0) {
        stopMirror();
        brs.setFrameNotify(false);
    }
}
