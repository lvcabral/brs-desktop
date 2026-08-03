/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import os from "node:os";
import WebSocket from "ws";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import {
    enableRemoteScreen,
    disableRemoteScreen,
    setRemoteScreenLocalOnly,
    subscribeRemoteScreen,
    unsubscribeRemoteScreen,
} from "../../src/server/remotescreen";

/**
 * Find a non-loopback IPv4 address on this machine.
 *
 * Connecting to it reaches the same server -- listen() with no host binds every interface --
 * but the socket's remoteAddress is not loopback, which is exactly what the local-only filters
 * key on. That makes a genuinely "remote" connection testable without faking a socket.
 * @returns {string|undefined} - A LAN address, or undefined on a host with no LAN interface
 */
function findLanAddress() {
    return Object.values(os.networkInterfaces())
        .flat()
        .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address;
}

const lanAddress = findLanAddress();

/**
 * Local-only enforcement for Remote Screen.
 *
 * The service is unauthenticated by design, so this toggle is the only thing standing between
 * the simulator screen and the network. It has to hold at three separate points: each HTTP
 * request, the WebSocket upgrade, and sessions that were already open when the setting flipped.
 */
describe("Remote Screen local-only mode", () => {
    let win;
    let port;

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

    afterEach(() => {
        setRemoteScreenLocalOnly(false);
    });

    afterAll(() => {
        disableRemoteScreen();
    });

    /**
     * Open a viewer session and wait for the server's opening frame.
     * @param {string} [host] - Which address to connect to
     * @returns {Promise<{ws: WebSocket, hello: object}>} - The socket and its first message
     */
    function connectViewer(host = "127.0.0.1") {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://${host}:${port}/rtc-session`);
            ws.once("error", reject);
            ws.once("message", (data) => resolve({ ws, hello: JSON.parse(data.toString()) }));
        });
    }

    it("still serves the page to this machine while local-only", async () => {
        setRemoteScreenLocalOnly(true);
        const res = await fetch(`http://127.0.0.1:${port}/`);
        expect(res.status).toBe(200);
    });

    it("withholds the LAN address from /config while local-only", async () => {
        // The address exists, but advertising it would be a link to a connection this very
        // setting refuses, so the page falls back to its own origin instead.
        const original = globalThis.sharedObject.deviceInfo.localIps;
        globalThis.sharedObject.deviceInfo.localIps = ["en0,192.0.2.10"]; // TEST-NET-1, RFC 5737
        try {
            setRemoteScreenLocalOnly(true);
            const restricted = await fetch(`http://127.0.0.1:${port}/config`).then((res) => res.json());
            expect(restricted.lanHost).toBeNull();

            setRemoteScreenLocalOnly(false);
            const open = await fetch(`http://127.0.0.1:${port}/config`).then((res) => res.json());
            expect(open.lanHost).toBe("192.0.2.10");
        } finally {
            globalThis.sharedObject.deviceInfo.localIps = original;
        }
    });

    it("still accepts a viewer from this machine while local-only", async () => {
        setRemoteScreenLocalOnly(true);
        const { ws, hello } = await connectViewer();
        expect(hello.type).toBe("hello");
        await waitForSend(win, "rtcViewerJoined");
        ws.close();
    });

    it("keeps a loopback session alive when remote access is turned off mid-stream", async () => {
        const { ws } = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");

        setRemoteScreenLocalOnly(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        // Dropping the local viewer would break the common case -- watching on the same
        // machine -- every time someone tightened the setting.
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
    });

    it.runIf(lanAddress)("refuses an HTTP request from the network while local-only", async () => {
        setRemoteScreenLocalOnly(true);
        const res = await fetch(`http://${lanAddress}:${port}/`);
        expect(res.status).toBe(403);
        expect(await res.text()).toBe("Forbidden");
    });

    it.runIf(lanAddress)("refuses a WebSocket upgrade from the network while local-only", async () => {
        setRemoteScreenLocalOnly(true);
        const error = await new Promise((resolve) => {
            const ws = new WebSocket(`ws://${lanAddress}:${port}/rtc-session`);
            ws.once("error", resolve);
            ws.once("open", () => resolve(null));
        });
        // The upgrade handler destroys the socket rather than completing the handshake.
        expect(error).toBeInstanceOf(Error);
    });

    it.runIf(lanAddress)("drops a session already open from the network when local-only is set", async () => {
        const { ws, hello } = await connectViewer(lanAddress);
        await waitForSend(win, "rtcViewerJoined");
        const closed = new Promise((resolve) => ws.once("close", resolve));

        // The connection filters only run for new connections, so without this the viewer
        // would keep watching the screen after the user turned remote access off.
        setRemoteScreenLocalOnly(true);
        await closed;

        expect(ws.readyState).toBe(WebSocket.CLOSED);
        const left = await waitForSend(win, "rtcViewerLeft");
        expect(left.at(-1).args[0]).toEqual({ sessionId: hello.sessionId });
    });

    if (!lanAddress) {
        // Not a silent gap: on a host with no LAN interface there is no way to originate a
        // non-loopback connection, so the three checks above cannot run here. The unit spec for
        // isLocalhostAddress covers which addresses count as local.
        it("reports that the remote-connection checks need a LAN interface", () => {
            expect(lanAddress).toBeUndefined();
        });
    }
});
