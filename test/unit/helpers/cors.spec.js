/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach } from "vitest";
import { session } from "../../mocks/electron.js";
import { buildCorsHeaders, enableCorsHeaders } from "../../../src/helpers/cors";

function makeDetails(overrides = {}) {
    return {
        id: 1,
        method: "GET",
        responseHeaders: {},
        ...overrides,
    };
}

describe("buildCorsHeaders", () => {
    it("reflects the tracked Origin instead of a wildcard, and allows credentials", () => {
        const { responseHeaders } = buildCorsHeaders(makeDetails(), { origin: "https://channel.example" });
        expect(responseHeaders["Access-Control-Allow-Origin"]).toEqual(["https://channel.example"]);
        expect(responseHeaders["Access-Control-Allow-Credentials"]).toEqual(["true"]);
    });

    it("falls back to a wildcard origin when no Origin was tracked for the request", () => {
        const { responseHeaders } = buildCorsHeaders(makeDetails());
        expect(responseHeaders["Access-Control-Allow-Origin"]).toEqual(["*"]);
    });

    it("forces a 200 status line on OPTIONS preflight requests, and echoes the requested headers back", () => {
        const details = makeDetails({ method: "OPTIONS" });
        const result = buildCorsHeaders(details, {
            origin: "https://channel.example",
            requestedHeaders: "x-custom-header",
        });
        expect(result.statusLine).toBe("HTTP/1.1 200 OK");
        expect(result.responseHeaders["Access-Control-Allow-Headers"]).toEqual(["x-custom-header"]);
    });

    it("does not force a status line on non-OPTIONS requests", () => {
        const result = buildCorsHeaders(makeDetails());
        expect(result.statusLine).toBeUndefined();
    });

    it("falls back to a wildcard Access-Control-Allow-Headers when no headers were requested", () => {
        const { responseHeaders } = buildCorsHeaders(makeDetails({ method: "OPTIONS" }));
        expect(responseHeaders["Access-Control-Allow-Headers"]).toEqual(["*"]);
    });

    it("strips a server's own Access-Control-Allow-* headers instead of duplicating them", () => {
        const details = makeDetails({
            responseHeaders: {
                "Access-Control-Allow-Origin": ["https://someone-else.example"],
                "Access-Control-Allow-Credentials": ["false"],
            },
        });
        const { responseHeaders } = buildCorsHeaders(details, { origin: "https://channel.example" });
        expect(responseHeaders["Access-Control-Allow-Origin"]).toEqual(["https://channel.example"]);
        expect(responseHeaders["Access-Control-Allow-Credentials"]).toEqual(["true"]);
    });

    it("always sets the COOP/COEP/CORP isolation headers", () => {
        const { responseHeaders } = buildCorsHeaders(makeDetails());
        expect(responseHeaders["Cross-Origin-Opener-Policy"]).toEqual(["same-origin"]);
        expect(responseHeaders["Cross-Origin-Embedder-Policy"]).toEqual(["require-corp"]);
        expect(responseHeaders["Cross-Origin-Resource-Policy"]).toEqual(["cross-origin"]);
    });
});

describe("enableCorsHeaders", () => {
    let webRequest;
    let handlers;

    beforeEach(() => {
        webRequest = session.defaultSession.webRequest;
        webRequest.onBeforeSendHeaders.mockClear();
        webRequest.onHeadersReceived.mockClear();
        webRequest.onCompleted.mockClear();
        webRequest.onErrorOccurred.mockClear();
        enableCorsHeaders(session.defaultSession);
        handlers = {
            onBeforeSendHeaders: webRequest.onBeforeSendHeaders.mock.calls[0][0],
            onHeadersReceived: webRequest.onHeadersReceived.mock.calls[0][0],
            onCompleted: webRequest.onCompleted.mock.calls[0][0],
            onErrorOccurred: webRequest.onErrorOccurred.mock.calls[0][0],
        };
    });

    it("registers listeners for the full request lifecycle", () => {
        expect(webRequest.onBeforeSendHeaders).toHaveBeenCalledTimes(1);
        expect(webRequest.onHeadersReceived).toHaveBeenCalledTimes(1);
        expect(webRequest.onCompleted).toHaveBeenCalledTimes(1);
        expect(webRequest.onErrorOccurred).toHaveBeenCalledTimes(1);
    });

    it("tracks a request's Origin from onBeforeSendHeaders and uses it in onHeadersReceived", () => {
        handlers.onBeforeSendHeaders({ id: 42, requestHeaders: { Origin: "https://channel.example" } }, () => {});
        let response;
        handlers.onHeadersReceived(makeDetails({ id: 42 }), (r) => (response = r));
        expect(response.responseHeaders["Access-Control-Allow-Origin"]).toEqual(["https://channel.example"]);
    });

    it("forgets a request's tracked data once it completes or errors", () => {
        handlers.onBeforeSendHeaders({ id: 1, requestHeaders: { Origin: "https://a.example" } }, () => {});
        handlers.onCompleted({ id: 1 });
        let response;
        handlers.onHeadersReceived(makeDetails({ id: 1 }), (r) => (response = r));
        expect(response.responseHeaders["Access-Control-Allow-Origin"]).toEqual(["*"]);

        handlers.onBeforeSendHeaders({ id: 2, requestHeaders: { Origin: "https://b.example" } }, () => {});
        handlers.onErrorOccurred({ id: 2 });
        handlers.onHeadersReceived(makeDetails({ id: 2 }), (r) => (response = r));
        expect(response.responseHeaders["Access-Control-Allow-Origin"]).toEqual(["*"]);
    });

    it("does not track a request that carries no Origin or Access-Control-Request-Headers", () => {
        handlers.onBeforeSendHeaders({ id: 7, requestHeaders: {} }, () => {});
        let response;
        handlers.onHeadersReceived(makeDetails({ id: 7 }), (r) => (response = r));
        expect(response.responseHeaders["Access-Control-Allow-Origin"]).toEqual(["*"]);
    });
});
