/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../../fixtures/sharedObject";
import {
    initECP,
    queryReply,
    processRequest,
    genDeviceInfoXml,
    subscribeECP,
    unsubscribeECP,
} from "../../../src/server/ecp";

const STATUS_OK = '"response":"x","response-id":"1","status":"200","status-msg":"OK"';

/**
 * Build the ECP-2 request envelope the WebSocket layer receives
 * @param {string} request - The request name
 * @param {object} [extra] - Additional fields
 * @returns {string} - The JSON message
 */
function message(request, extra = {}) {
    return JSON.stringify({ request, "request-id": "1", ...extra });
}

/**
 * Decode a base64 payload
 * @param {string} encoded - The base64 string
 * @returns {string} - The decoded text
 */
function decode(encoded) {
    return Buffer.from(encoded, "base64").toString("utf8");
}

describe("queryReply", () => {
    beforeEach(() => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        initECP();
    });

    it.each([
        "query-device-info",
        "query-themes",
        "query-screensavers",
        "query-apps",
        "query-tv-active-channel",
        "query-media-player",
        "query-audio-device",
    ])("answers %s with base64 XML", (request) => {
        const reply = JSON.parse(queryReply({ request }, STATUS_OK));
        expect(reply["content-type"]).toContain("text/xml");
        expect(reply.status).toBe("200");
        expect(decode(reply["content-data"])).toContain("<?xml");
    });

    it("returns the WebSocket flavour of the device info", () => {
        // The ECP-2 payload is the encrypted form, which carries virtual-device-id on top
        // of everything the REST response has.
        const reply = JSON.parse(queryReply({ request: "query-device-info" }, STATUS_OK));
        const xml = decode(reply["content-data"]);
        expect(xml).toBe(decode(genDeviceInfoXml(true)));
        expect(xml).toContain("virtual-device-id");
        expect(xml).toContain("<serial-number>BRSDESKTOP070</serial-number>");
    });

    // query-icon reads the app icon from path.join(__dirname, "images", ...). Under
    // vite-node __dirname is src/server/, not the webpack bundle's app/ directory, so the
    // file is absent and the read throws. The content-type rewrite it performs is covered
    // by test/integration/ecp-websocket.spec.js instead.

    it("answers query-textedit-state with JSON", () => {
        const reply = JSON.parse(queryReply({ request: "query-textedit-state" }, STATUS_OK));
        expect(reply["content-type"]).toContain("application/json");
        expect(JSON.parse(decode(reply["content-data"]))).toEqual({
            "textedit-state": { "textedit-id": "none" },
        });
    });

    it("answers an unknown query with a bare status envelope", () => {
        const reply = JSON.parse(queryReply({ request: "query-nonesuch" }, STATUS_OK));
        expect(reply.status).toBe("200");
        expect(reply["content-data"]).toBeUndefined();
    });
});

describe("processRequest", () => {
    let ws;

    beforeEach(() => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        // Registered for initECP() to pick up; this suite asserts on the reply, not the window.
        __registerWindow(createFakeWindow(1));
        initECP();
        ws = { send: vi.fn() };
    });

    /**
     * Read the single reply the handler sent
     * @returns {object} - The parsed reply
     */
    function reply() {
        expect(ws.send).toHaveBeenCalledTimes(1);
        return JSON.parse(ws.send.mock.calls[0][0]);
    }

    it("acknowledges an authenticate request carrying a response", () => {
        processRequest(ws, message("authenticate", { "param-response": "abc" }));
        expect(reply()).toMatchObject({ response: "authenticate", status: "200" });
    });

    it("echoes the request id so a client can correlate replies", () => {
        processRequest(ws, JSON.stringify({ request: "request-events", "request-id": "42" }));
        expect(reply()["response-id"]).toBe("42");
    });

    it("routes query requests through queryReply", () => {
        processRequest(ws, message("query-device-info"));
        expect(decode(reply()["content-data"])).toContain("<serial-number>");
    });

    it("notifies observers of a launch request", () => {
        const observer = vi.fn();
        subscribeECP("test", observer);
        try {
            processRequest(ws, message("launch", { "param-channel-id": "dev" }));
            expect(observer).toHaveBeenCalledWith("launch", { appID: "dev" });
        } finally {
            unsubscribeECP("test");
        }
    });

    // The key-press branch writes to the module-level `window`, which only enableECP()
    // populates. Covered in test/integration/ecp-websocket.spec.js, where the server is
    // actually running.

    it("answers any other request with OK", () => {
        processRequest(ws, message("request-events"));
        expect(reply().status).toBe("200");
    });

    it("ignores malformed JSON without replying or throwing", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            expect(() => processRequest(ws, "{not json")).not.toThrow();
            expect(ws.send).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it("ignores an empty message", () => {
        processRequest(ws, "");
        expect(ws.send).not.toHaveBeenCalled();
    });
});
