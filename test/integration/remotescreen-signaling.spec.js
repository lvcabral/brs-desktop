/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { ipcMain } from "electron";
import WebSocket from "ws";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import {
    enableRemoteScreen,
    disableRemoteScreen,
    subscribeRemoteScreen,
    unsubscribeRemoteScreen,
} from "../../src/server/remotescreen";

/**
 * The WebRTC signaling relay, over real sockets.
 *
 * The relay is the piece that cannot be unit tested: the peer connections live in the renderer
 * and the sockets live in the main process, so the contract only exists end to end. The media
 * itself is out of reach here (no RTCPeerConnection under vitest), but every message that gets
 * it started passes through this path.
 *
 * "rtcSignal" is registered on ipcMain at module-evaluation time and can never re-register, so
 * it is driven with ipcMain.emit and no hook here may call removeAllListeners.
 */
describe("Remote Screen signaling", () => {
    let win;
    let port;
    const open = new Set();

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        port = await new Promise((resolve) => {
            subscribeRemoteScreen("test-ready", (event, data) => {
                if (event === "enabled" && data.enabled) {
                    resolve(data.port);
                }
            });
            getFreePort().then((free) => enableRemoteScreen(win, free));
        });
        unsubscribeRemoteScreen("test-ready");
    });

    beforeEach(() => {
        __registerWindow(win);
        win.sent.length = 0;
    });

    afterAll(() => {
        for (const ws of open) {
            ws.close();
        }
        disableRemoteScreen();
    });

    /**
     * Connect a viewer and wait for the server's opening frame.
     * @returns {Promise<{ws: WebSocket, hello: object}>} - The socket and its first message
     */
    function connectViewer() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/rtc-session`);
            open.add(ws);
            ws.once("error", reject);
            ws.once("message", (data) => resolve({ ws, hello: JSON.parse(data.toString()) }));
        });
    }

    /**
     * Await the next message on an already-open socket.
     * @param {WebSocket} ws - The open socket
     * @returns {Promise<object>} - The parsed message
     */
    function nextMessage(ws) {
        return new Promise((resolve) => {
            ws.once("message", (data) => resolve(JSON.parse(data.toString())));
        });
    }

    /**
     * Close a viewer and wait until the server has actually dropped its session.
     *
     * Waiting for the client's own close event is not enough: the server drops the session a
     * tick later, so the resulting "rtcViewerLeft" would land during the *next* test, after its
     * beforeEach cleared the log, and be mistaken for that test's own teardown.
     * @param {WebSocket} ws - The socket to close
     * @param {string} sessionId - The session the server assigned it
     * @returns {Promise<void>} - Resolves once the session is gone server-side
     */
    async function closeViewer(ws, sessionId) {
        open.delete(ws);
        await new Promise((resolve) => {
            ws.once("close", resolve);
            ws.close();
        });
        await waitForLeft(sessionId);
    }

    /**
     * Wait for the renderer to be told a specific session ended.
     * @param {string} sessionId - The session to watch for
     * @param {number} [timeout] - How long to wait, in milliseconds
     * @returns {Promise<void>} - Resolves when the message is seen
     */
    function waitForLeft(sessionId, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeout;
            const poll = () => {
                const seen = win.sentOn("rtcViewerLeft").some((msg) => msg.args[0]?.sessionId === sessionId);
                if (seen) {
                    resolve();
                } else if (Date.now() > deadline) {
                    reject(new Error(`Timed out waiting for session ${sessionId} to be dropped`));
                } else {
                    setTimeout(poll, 10);
                }
            };
            poll();
        });
    }

    it("assigns a session id and tells the renderer to make an offer", async () => {
        const { ws, hello } = await connectViewer();
        expect(hello.type).toBe("hello");
        expect(hello.sessionId).toMatch(/^s\d+$/);
        // The renderer owns the media track, so this message is what starts negotiation.
        const joined = await waitForSend(win, "rtcViewerJoined");
        expect(joined.at(-1).args[0]).toEqual({ sessionId: hello.sessionId });
        await closeViewer(ws, hello.sessionId);
    });

    it("relays an offer from the renderer to the addressed viewer only", async () => {
        const first = await connectViewer();
        const second = await connectViewer();
        const sdp = { type: "offer", sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n" };
        const delivered = nextMessage(second.ws);
        // A stray delivery to the wrong viewer would leak one session's SDP into another.
        let leaked = false;
        first.ws.once("message", () => {
            leaked = true;
        });
        ipcMain.emit("rtcSignal", {}, { sessionId: second.hello.sessionId, type: "offer", sdp });
        const message = await delivered;
        expect(message.type).toBe("offer");
        expect(message.sdp).toEqual(sdp);
        expect(leaked).toBe(false);
        await closeViewer(first.ws, first.hello.sessionId);
        await closeViewer(second.ws, second.hello.sessionId);
    });

    it("forwards an answer from the viewer to the renderer", async () => {
        const { ws, hello } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");
        const sdp = { type: "answer", sdp: "v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n" };
        ws.send(JSON.stringify({ type: "answer", sdp }));
        const relayed = await waitForSend(win, "rtcSignal");
        expect(relayed.at(-1).args[0]).toEqual({ type: "answer", sdp, sessionId: hello.sessionId });
        await closeViewer(ws, hello.sessionId);
    });

    it("forwards ICE candidates from the viewer", async () => {
        const { ws, hello } = await connectViewer();
        const candidate = { candidate: "candidate:1 1 UDP 1 192.0.2.10 5000 typ host", sdpMLineIndex: 0 };
        ws.send(JSON.stringify({ type: "candidate", candidate }));
        const relayed = await waitForSend(win, "rtcSignal");
        expect(relayed.at(-1).args[0]).toEqual({ type: "candidate", candidate, sessionId: hello.sessionId });
        await closeViewer(ws, hello.sessionId);
    });

    it("stamps the session id server-side so a viewer cannot address another session", async () => {
        const { ws, hello } = await connectViewer();
        // The viewer claims to be someone else; the relay must overwrite that claim.
        ws.send(JSON.stringify({ type: "answer", sdp: {}, sessionId: "s999" }));
        const relayed = await waitForSend(win, "rtcSignal");
        expect(relayed.at(-1).args[0].sessionId).toBe(hello.sessionId);
        expect(relayed.at(-1).args[0].sessionId).not.toBe("s999");
        await closeViewer(ws, hello.sessionId);
    });

    it("ignores message types that are not part of the answering side", async () => {
        const { ws, hello } = await connectViewer();
        // Only "answer" and "candidate" travel viewer to renderer; an "offer" from a viewer is
        // either a confused client or someone probing, and must not reach the page.
        ws.send(JSON.stringify({ type: "offer", sdp: {} }));
        ws.send(JSON.stringify({ type: "busy" }));
        ws.send("not json at all");
        // A relayed answer afterwards proves the socket is still live and the earlier three
        // were dropped rather than queued.
        ws.send(JSON.stringify({ type: "answer", sdp: { type: "answer" } }));
        const relayed = await waitForSend(win, "rtcSignal");
        expect(relayed).toHaveLength(1);
        expect(relayed[0].args[0].type).toBe("answer");
        await closeViewer(ws, hello.sessionId);
    });

    it("tells the renderer to tear down the peer when a viewer disconnects", async () => {
        const { ws, hello } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");
        await closeViewer(ws, hello.sessionId);
        const left = await waitForSend(win, "rtcViewerLeft");
        expect(left.at(-1).args[0]).toEqual({ sessionId: hello.sessionId });
    });

    it("turns background throttling off while watched and back on when the last viewer goes", async () => {
        // A minimized window stops painting, which freezes the stream on a stale frame; the
        // service lifts the throttle only for as long as someone is actually watching.
        win.webContents.setBackgroundThrottling.mockClear();
        const { ws, hello } = await connectViewer();
        expect(win.webContents.setBackgroundThrottling).toHaveBeenCalledWith(false);
        await closeViewer(ws, hello.sessionId);
        expect(win.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);
    });

    it("refuses a viewer past the cap and says why", async () => {
        const { maxViewers } = await fetch(`http://127.0.0.1:${port}/config`).then((res) => res.json());
        const accepted = [];
        for (let i = 0; i < maxViewers; i++) {
            accepted.push(await connectViewer());
        }
        const extra = new WebSocket(`ws://127.0.0.1:${port}/rtc-session`);
        open.add(extra);
        const refusal = await nextMessage(extra);
        const code = await new Promise((resolve) => extra.once("close", resolve));
        expect(refusal).toEqual({ type: "busy", maxViewers });
        // 4000-4999 is reserved for applications, so the page can distinguish "full" from a
        // generic disconnect and stop retrying.
        expect(code).toBe(4000);
        open.delete(extra);
        for (const viewer of accepted) {
            await closeViewer(viewer.ws, viewer.hello.sessionId);
        }
    });

    it("refuses an upgrade on any path but the signaling one", async () => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/somewhere-else`);
        const error = await new Promise((resolve) => ws.once("error", resolve));
        expect(error).toBeInstanceOf(Error);
    });

    it("refuses an upgrade requested by a page from another origin", async () => {
        // WebSockets are exempt from CORS, so a page on any website the user is visiting can open
        // this socket and be handed the live video of the screen. It arrives from loopback like
        // the real viewer does, so only the Origin distinguishes the two.
        const ws = new WebSocket(`ws://127.0.0.1:${port}/rtc-session`, {
            origin: "https://example.com",
        });
        const error = await new Promise((resolve) => ws.once("error", resolve));
        expect(error).toBeInstanceOf(Error);
        expect(win.sentOn("rtcViewerJoined")).toHaveLength(0);
    });

    it("accepts an upgrade from the page it serves itself", async () => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/rtc-session`, {
            origin: `http://127.0.0.1:${port}`,
        });
        open.add(ws);
        const hello = await new Promise((resolve) => ws.once("message", (data) => resolve(JSON.parse(data))));
        expect(hello.type).toBe("hello");
        await closeViewer(ws, hello.sessionId);
    });

    it("re-announces open sessions when the renderer says it is ready", async () => {
        // "rtcViewerJoined" is fire-and-forget, so a viewer that connected before the renderer
        // registered its handler never got an offer. The renderer announcing itself is what
        // rescues those sessions -- without it they hold a slot on a socket that never streams.
        const { ws, hello } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");
        win.sent.length = 0;
        ipcMain.emit("rtcReady", {}, {});
        const rejoined = await waitForSend(win, "rtcViewerJoined");
        expect(rejoined.at(-1).args[0]).toEqual({ sessionId: hello.sessionId });
        await closeViewer(ws, hello.sessionId);
    });

    it("drops a session whose peer connection failed in the renderer", async () => {
        // The renderer reports the failure because only it can see the connection state. Left
        // open, the socket holds one of the viewer slots around a peer that can never recover.
        const { ws, hello } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");
        open.delete(ws);
        const closed = new Promise((resolve) => ws.once("close", resolve));
        ipcMain.emit("rtcSessionFailed", {}, { sessionId: hello.sessionId });
        await closed;
        const left = await waitForSend(win, "rtcViewerLeft");
        expect(left.at(-1).args[0]).toEqual({ sessionId: hello.sessionId });
        // The slot is free again: a fresh viewer gets a new id and its own join announcement.
        const next = await connectViewer();
        expect(next.hello.sessionId).not.toBe(hello.sessionId);
        await closeViewer(next.ws, next.hello.sessionId);
    });

    it("ignores a failure report for a session it does not know", async () => {
        const { ws, hello } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");
        win.sent.length = 0;
        ipcMain.emit("rtcSessionFailed", {}, { sessionId: "s999" });
        // The real session is untouched -- a stray id must not tear down a working viewer.
        expect(win.sentOn("rtcViewerLeft")).toHaveLength(0);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        await closeViewer(ws, hello.sessionId);
    });
});
