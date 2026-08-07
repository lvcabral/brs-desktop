/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import os from "node:os";
import WebSocket from "ws";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import {
    enableRemoteScreen,
    disableRemoteScreen,
    isRemoteScreenEnabled,
    getRemoteScreenPort,
    dropAllSessions,
    subscribeRemoteScreen,
    unsubscribeRemoteScreen,
} from "../../src/server/remotescreen";

/**
 * Find a non-loopback IPv4 address on this machine (same helper as remotescreen-localonly.spec.js).
 * @returns {string|undefined} - A LAN address, or undefined on a host with no LAN interface
 */
function findLanAddress() {
    return Object.values(os.networkInterfaces())
        .flat()
        .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address;
}

const lanAddress = findLanAddress();

/**
 * Service lifecycle, bulk teardown, and HTTP edge cases for Remote Screen.
 *
 * The other three spec files start the server once and exercise it. This file tests the
 * transitions between those states: enable, disable, re-enable, and the dropAllSessions
 * call the renderer issues on reload.
 */
describe("Remote Screen lifecycle", () => {
    let win;

    beforeAll(() => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
    });

    beforeEach(() => {
        __registerWindow(win);
    });

    afterAll(() => {
        disableRemoteScreen();
    });

    it("reports the service as disabled before it is started", () => {
        expect(isRemoteScreenEnabled()).toBe(false);
    });

    it("defaults to the constant port before a server has bound", () => {
        // The 8090 constant from src/constants.js — no server has ever assigned another.
        expect(getRemoteScreenPort()).toBe(8090);
    });

    it("can be enabled and reports the bound port through the observer", async () => {
        const port = await new Promise((resolve) => {
            subscribeRemoteScreen("test-enable", (event, data) => {
                if (event === "enabled" && data.enabled) {
                    resolve(data.port);
                }
            });
            getFreePort().then((free) => enableRemoteScreen(win, free));
        });
        unsubscribeRemoteScreen("test-enable");
        expect(isRemoteScreenEnabled()).toBe(true);
        expect(getRemoteScreenPort()).toBe(port);
    });

    it("is idempotent when already enabled", async () => {
        // A second call must not try to bind a second server, which would either fail or
        // leave the first one leaking.
        const portBefore = getRemoteScreenPort();
        const anotherPort = await getFreePort();
        enableRemoteScreen(win, anotherPort);
        expect(isRemoteScreenEnabled()).toBe(true);
        expect(getRemoteScreenPort()).toBe(portBefore);
    });

    it("fires the disabled observer notification on shutdown", async () => {
        const notification = await new Promise((resolve) => {
            subscribeRemoteScreen("test-disable", (event, data) => {
                if (event === "enabled" && !data.enabled) {
                    resolve(data);
                }
            });
            disableRemoteScreen();
        });
        unsubscribeRemoteScreen("test-disable");
        expect(notification.enabled).toBe(false);
        expect(isRemoteScreenEnabled()).toBe(false);
    });

    it("is a no-op when disabled while already off", () => {
        // Must not throw or fire observer notifications.
        let fired = false;
        subscribeRemoteScreen("test-noop", () => {
            fired = true;
        });
        disableRemoteScreen();
        unsubscribeRemoteScreen("test-noop");
        expect(fired).toBe(false);
        expect(isRemoteScreenEnabled()).toBe(false);
    });

    it("can be re-enabled after a disable cycle", async () => {
        const port = await new Promise((resolve) => {
            subscribeRemoteScreen("test-reenable", (event, data) => {
                if (event === "enabled" && data.enabled) {
                    resolve(data.port);
                }
            });
            getFreePort().then((free) => enableRemoteScreen(win, free));
        });
        unsubscribeRemoteScreen("test-reenable");
        expect(isRemoteScreenEnabled()).toBe(true);
        // The re-enabled server must actually accept connections.
        const res = await fetch(`http://127.0.0.1:${port}/config`);
        expect(res.status).toBe(200);
    });
});

describe("dropAllSessions", () => {
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

    it("closes every open viewer at once", async () => {
        const first = await connectViewer();
        const second = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");

        const firstClosed = new Promise((resolve) => first.ws.once("close", resolve));
        const secondClosed = new Promise((resolve) => second.ws.once("close", resolve));

        dropAllSessions();

        await firstClosed;
        await secondClosed;
        open.delete(first.ws);
        open.delete(second.ws);
        expect(first.ws.readyState).toBe(WebSocket.CLOSED);
        expect(second.ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("re-enables background throttling after clearing all sessions", async () => {
        const viewer = await connectViewer();
        await waitForSend(win, "rtcViewerJoined");

        win.webContents.setBackgroundThrottling.mockClear();
        const closed = new Promise((resolve) => viewer.ws.once("close", resolve));
        dropAllSessions();
        await closed;
        open.delete(viewer.ws);

        // The last call must restore throttling after the bulk teardown.
        expect(win.webContents.setBackgroundThrottling).toHaveBeenCalledWith(true);
    });

    it("allows a fresh viewer to connect after a bulk teardown", async () => {
        // Proves the server is still running and handing out new session ids.
        const viewer = await connectViewer();
        expect(viewer.hello.type).toBe("hello");
        expect(viewer.hello.sessionId).toMatch(/^s\d+$/);

        const closed = new Promise((resolve) => viewer.ws.once("close", resolve));
        dropAllSessions();
        await closed;
        open.delete(viewer.ws);
    });
});

describe("HTTP edge cases", () => {
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
    });

    afterAll(() => {
        disableRemoteScreen();
    });

    it("returns 200 with no body for HEAD on /config", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/config`, { method: "HEAD" });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/json");
        expect(await res.text()).toBe("");
    });

    it("strips query strings before routing", async () => {
        // Cache busters, timestamp parameters and similar must not prevent a known path
        // from matching. The server splits on "?" before looking up the route.
        const config = await fetch(`http://127.0.0.1:${port}/config?t=${Date.now()}`);
        expect(config.status).toBe(200);
        expect(await config.json()).toHaveProperty("ecpPort");

        const page = await fetch(`http://127.0.0.1:${port}/?v=2`);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("<video");
    });

    it("returns 405 for PUT, the same as DELETE and PATCH", async () => {
        // The server spec tests DELETE; this ensures the check is method-agnostic.
        const put = await fetch(`http://127.0.0.1:${port}/`, { method: "PUT" });
        expect(put.status).toBe(405);
    });
});

describe("localOnly startup option", () => {
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
            getFreePort().then((free) => enableRemoteScreen(win, free, { localOnly: true }));
        });
        unsubscribeRemoteScreen("test-ready");
    });

    beforeEach(() => {
        __registerWindow(win);
    });

    afterAll(() => {
        disableRemoteScreen();
    });

    it("serves the page to localhost even when started with localOnly", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        expect(res.status).toBe(200);
    });

    it("withholds the LAN address from /config when started with localOnly", async () => {
        const original = globalThis.sharedObject.deviceInfo.localIps;
        globalThis.sharedObject.deviceInfo.localIps = ["en0,192.0.2.10"]; // TEST-NET-1, RFC 5737
        try {
            const config = await fetch(`http://127.0.0.1:${port}/config`).then((res) => res.json());
            expect(config.lanHost).toBeNull();
        } finally {
            globalThis.sharedObject.deviceInfo.localIps = original;
        }
    });

    it.runIf(lanAddress)("refuses an HTTP request from the network when started with localOnly", async () => {
        const res = await fetch(`http://${lanAddress}:${port}/`);
        expect(res.status).toBe(403);
    });
});
