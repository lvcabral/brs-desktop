/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import { initECP, enableECP, disableECP, subscribeECP, unsubscribeECP } from "../../src/server/ecp";

/**
 * The ECP-2 WebSocket protocol, over a real socket on an ephemeral port.
 */
describe("ECP-2 WebSocket", () => {
    let win;
    let port;

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        port = await getFreePort();
        initECP();
        await new Promise((resolve) => {
            subscribeECP("test-ready", (event, enabled) => {
                if (event === "enabled" && enabled) {
                    resolve();
                }
            });
            enableECP(win, port);
        });
        unsubscribeECP("test-ready");
    });

    afterAll(() => {
        disableECP();
    });

    /**
     * Open an ECP-2 session and collect the server's opening challenge
     * @returns {Promise<{ws: WebSocket, challenge: object}>} - The socket and challenge
     */
    function openSession() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/ecp-session`);
            ws.once("error", reject);
            ws.once("message", (data) => {
                resolve({ ws, challenge: JSON.parse(data.toString()) });
            });
        });
    }

    /**
     * Send a request and await the matching reply
     * @param {WebSocket} ws - The open socket
     * @param {object} request - The request payload
     * @returns {Promise<object>} - The parsed reply
     */
    function exchange(ws, request) {
        return new Promise((resolve) => {
            ws.once("message", (data) => resolve(JSON.parse(data.toString())));
            ws.send(JSON.stringify(request));
        });
    }

    it("pushes an authentication challenge on connect", async () => {
        const { ws, challenge } = await openSession();
        try {
            expect(challenge.notify).toBe("authenticate");
            expect(challenge["param-challenge"]).toBeTruthy();
            expect(challenge.timestamp).toMatch(/^\d+\.\d{3}$/);
        } finally {
            ws.close();
        }
    });

    it("accepts an authentication response", async () => {
        const { ws } = await openSession();
        try {
            const reply = await exchange(ws, {
                request: "authenticate",
                "request-id": "1",
                "param-response": "anything",
            });
            expect(reply.status).toBe("200");
            expect(reply["response-id"]).toBe("1");
        } finally {
            ws.close();
        }
    });

    it("answers query-device-info with base64 XML", async () => {
        const { ws } = await openSession();
        try {
            const reply = await exchange(ws, { request: "query-device-info", "request-id": "2" });
            const xml = Buffer.from(reply["content-data"], "base64").toString("utf8");
            expect(xml).toContain("<serial-number>BRSDESKTOP070</serial-number>");
            expect(xml).toContain("virtual-device-id");
        } finally {
            ws.close();
        }
    });

    it("answers query-textedit-state as JSON", async () => {
        const { ws } = await openSession();
        try {
            const reply = await exchange(ws, { request: "query-textedit-state", "request-id": "3" });
            expect(reply["content-type"]).toContain("application/json");
        } finally {
            ws.close();
        }
    });

    it("forwards a key press to the renderer with Roku's timings", async () => {
        const { ws } = await openSession();
        win.sent.length = 0;
        try {
            await exchange(ws, { request: "key-press", "request-id": "4", "param-key": "home" });
            const [sent] = await waitForSend(win, "postKeyPress");
            expect(sent.args).toEqual(["home", 300, 50]);
        } finally {
            ws.close();
        }
    });

    it("notifies observers of a launch request", async () => {
        const { ws } = await openSession();
        const launches = [];
        subscribeECP("ws-launch", (event, data) => {
            if (event === "launch") {
                launches.push(data);
            }
        });
        try {
            await exchange(ws, {
                request: "launch",
                "request-id": "5",
                "param-channel-id": "dev",
            });
            expect(launches).toEqual([{ appID: "dev" }]);
        } finally {
            unsubscribeECP("ws-launch");
            ws.close();
        }
    });

    it("answers an unrecognised request with OK", async () => {
        const { ws } = await openSession();
        try {
            const reply = await exchange(ws, { request: "request-events", "request-id": "6" });
            expect(reply.status).toBe("200");
        } finally {
            ws.close();
        }
    });

    it("refuses an upgrade on any other path", async () => {
        // Only /ecp-session is a valid ECP-2 endpoint; anything else has its socket destroyed.
        await expect(
            new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://127.0.0.1:${port}/not-ecp-session`);
                ws.once("open", () => {
                    ws.close();
                    resolve("connected");
                });
                ws.once("error", reject);
            })
        ).rejects.toThrow();
    });
});
