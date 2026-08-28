/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Real Roku hardware has no CORS concept; app:// is a real origin (unlike file://, which grants
// documents universal cross-origin XHR access), so this restores that behavior by stamping every
// response with permissive Access-Control-Allow-* headers.
//
// A request whose credentials mode is "include" (brs-engine's RoURLTransfer sets
// `xhr.withCredentials = true` when a channel calls roUrlTransfer.EnableCookies()) makes the
// Fetch spec reject two of the values this file used to hardcode:
//   - Access-Control-Allow-Origin: "*" is forbidden outright for a credentialed response; the
//     origin must be echoed back explicitly.
//   - Access-Control-Allow-Headers: "*" is read as the literal header name "*" rather than a
//     wildcard once credentials are involved, so a credentialed request carrying a custom header
//     (e.g. the case PR #338 already special-cases for the OPTIONS status) would still fail
//     preflight.
// Reflecting the real request's Origin and Access-Control-Request-Headers back is valid for both
// credentialed and non-credentialed requests, and is exactly as permissive as the wildcard was —
// so it keeps this file's "allow everything" intent without tripping the spec's guard rail.
//
// onHeadersReceived's details carry no request headers (only onBeforeSendHeaders does), so a
// request's Origin/Access-Control-Request-Headers are captured there and stashed by request id
// for onHeadersReceived to read back. onCompleted/onErrorOccurred each fire exactly once per
// request id and are what clean the map up — without them it would grow for the life of the app.

/**
 * Build the onHeadersReceived callback payload for one response.
 * @param {import("electron").OnHeadersReceivedListenerDetails} details - The response details
 * @param {{origin?: string, requestedHeaders?: string}} [pending] - Origin/requested-headers captured
 *   for this request's id by the onBeforeSendHeaders listener, if any
 * @returns {{responseHeaders: Record<string, string[]>, statusLine?: string}} - The callback payload
 */
export function buildCorsHeaders(details, pending = {}) {
    const responseHeaders = details.responseHeaders;
    responseHeaders["Cross-Origin-Opener-Policy"] = ["same-origin"];
    responseHeaders["Cross-Origin-Embedder-Policy"] = ["require-corp"];
    responseHeaders["Cross-Origin-Resource-Policy"] = ["cross-origin"];
    // Clear any existing Access-Control-Allow-* first — a server that sends its own gets a
    // duplicated header (e.g. "*, *" or "true, true"), which is a CORS error itself.
    for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase().startsWith("access-control-allow-")) {
            delete responseHeaders[key];
        }
    }
    responseHeaders["Access-Control-Allow-Origin"] = [pending.origin || "*"];
    // Every requester sharing this session (main + editor windows both use session.defaultSession,
    // see helpers/window.js) gets credentialed cross-origin reads unconditionally — no allowlist.
    // That is a deliberate extension of this file's "real Roku hardware has no CORS concept"
    // stance to credentialed requests too, not an oversight: tightening it would mean deciding
    // which origins a sideloaded channel's roUrlTransfer.EnableCookies() calls should still be
    // allowed to reach, which this app has never restricted for non-credentialed requests either.
    responseHeaders["Access-Control-Allow-Credentials"] = ["true"];
    responseHeaders["Access-Control-Allow-Methods"] = ["GET, POST, PUT, DELETE, HEAD, OPTIONS"];
    responseHeaders["Access-Control-Allow-Headers"] = [pending.requestedHeaders || "*"];
    const response = { responseHeaders };
    // A cross-origin request with a non-simple header (e.g. roUrlTransfer's custom headers)
    // makes Chromium send its own CORS preflight (an OPTIONS request) ahead of the real one.
    // Real Roku hardware never does this, and most third-party servers were never built to
    // answer it either — they reply with whatever they'd give any other unrecognized route
    // (403/404/...), which fails the preflight on status alone before our injected
    // Access-Control-Allow-* headers above are even considered. Force it to 200 so those
    // headers can do their job.
    if (details.method === "OPTIONS") {
        response.statusLine = "HTTP/1.1 200 OK";
    }
    return response;
}

// Request header casing isn't guaranteed, so this collects both values (Origin and
// Access-Control-Request-Headers) in a single pass over the header names. Returns null for the
// common case (same-origin/non-preflight traffic, the majority of requests) so the caller has
// nothing worth tracking for that request's id.
function findOriginAndRequestedHeaders(requestHeaders) {
    const pending = {};
    for (const key of Object.keys(requestHeaders)) {
        const lower = key.toLowerCase();
        if (lower === "origin") {
            pending.origin = requestHeaders[key];
        } else if (lower === "access-control-request-headers") {
            pending.requestedHeaders = requestHeaders[key];
        }
    }
    return pending.origin || pending.requestedHeaders ? pending : null;
}

/**
 * Register the CORS/COOP/COEP header injection on a session, enabling SharedArrayBuffer and
 * cross-origin requests (including credentialed ones) the same way real Roku hardware allows them.
 *
 * Claims 4 webRequest listener slots (onBeforeSendHeaders, onHeadersReceived, onCompleted,
 * onErrorOccurred) on `appSession`. Electron allows only one listener per event type per session —
 * registering any of these same event types elsewhere on the same session silently replaces this
 * one (or vice versa) with no error, breaking CORS/credentialed requests app-wide. Route any future
 * use of these events through this function instead of registering a second listener.
 * @param {import("electron").Session} appSession - The session to instrument, typically session.defaultSession
 */
export function enableCorsHeaders(appSession) {
    const pendingByRequestId = new Map();
    appSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const pending = findOriginAndRequestedHeaders(details.requestHeaders);
        if (pending) {
            pendingByRequestId.set(details.id, pending);
        }
        callback({ requestHeaders: details.requestHeaders });
    });
    appSession.webRequest.onHeadersReceived((details, callback) => {
        callback(buildCorsHeaders(details, pendingByRequestId.get(details.id)));
    });
    const forgetRequest = (details) => pendingByRequestId.delete(details.id);
    appSession.webRequest.onCompleted(forgetRequest);
    appSession.webRequest.onErrorOccurred(forgetRequest);
}
