/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import crypto from "node:crypto";

// HTTP Digest access authentication (RFC 2617), both halves in one place:
//
//  - server side, used by src/server/installer.js to challenge and verify incoming requests
//  - client side, used by src/helpers/roku.js to answer a peer Roku's challenge
//
// Keeping them together is what lets a test drive a full challenge/response round trip
// without a socket, and guarantees the two stay compatible.

/**
 * MD5-hash a string and return it as lowercase hex
 * @param {string} data - The data to hash
 * @returns {string} - The hex digest
 */
export function cryptoUsingMD5(data) {
    return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * Parse the parameters of an incoming Authorization header (server side)
 * @param {string} authData - The header value with the leading "Digest " removed
 * @returns {object} - The parameters, with surrounding quotes stripped
 */
export function parseAuthenticationInfo(authData) {
    let authenticationObj = {};
    // Split on a comma with optional whitespace: not every client emits ", ".
    for (const d of authData.split(/,\s*/)) {
        // Split on the *first* "=" only. Values are frequently base64 and so carry "="
        // padding, and a uri may contain a query string; splitting on every "=" would
        // truncate them and the response comparison would fail with a confusing 401 loop.
        const separator = d.indexOf("=");
        if (separator === -1) {
            continue;
        }
        const key = d.slice(0, separator).trim();
        const value = d.slice(separator + 1);
        authenticationObj[key] = value.replace(/"/g, "");
    }
    return authenticationObj;
}

/**
 * Compute the expected digest response for a request (server side).
 *
 * Extracted verbatim from performDigestAuth() so the RFC 2617 arithmetic can be verified
 * on its own and reused by the client half.
 * @param {object} params - The digest parameters
 * @param {string} params.username - The user name
 * @param {string} params.realm - The authentication realm
 * @param {string} params.password - The shared secret
 * @param {string} params.method - The HTTP method
 * @param {string} params.uri - The request URI
 * @param {string} params.nonce - The server nonce
 * @param {string} params.nc - The nonce count
 * @param {string} params.cnonce - The client nonce
 * @param {string} params.qop - The quality of protection
 * @returns {string} - The expected response hash
 */
export function computeDigestResponse({ username, realm, password, method, uri, nonce, nc, cnonce, qop }) {
    const ha1 = cryptoUsingMD5(`${username}:${realm}:${password}`);
    const ha2 = cryptoUsingMD5(`${method}:${uri}`);
    return cryptoUsingMD5([ha1, nonce, nc, cnonce, qop, ha2].join(":"));
}

/**
 * Parse a WWW-Authenticate challenge (client side)
 * @param {string} authHeader - The challenge header value
 * @returns {object} - The challenge parameters
 */
export function parseDigestChallenge(authHeader) {
    const params = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
    let match;
    while ((match = regex.exec(authHeader))) {
        params[match[1]] = match[2] || match[3];
    }
    return params;
}

/**
 * Answer a digest challenge (client side)
 * @param {string} username - The user name
 * @param {string} password - The shared secret
 * @param {string} method - The HTTP method
 * @param {string} path - The request path
 * @param {object} challenge - The parsed challenge
 * @returns {object} - The parameters to send back in the Authorization header
 */
export function generateDigestResponse(username, password, method, path, challenge) {
    const ha1 = crypto
        .createHash("md5")
        .update(`${username}:${challenge.realm}:${password}`)
        .digest("hex");

    const ha2 = crypto.createHash("md5").update(`${method}:${path}`).digest("hex");

    let response;
    if (challenge.qop === "auth" || challenge.qop === "auth-int") {
        const nc = "00000001";
        const cnonce = crypto.randomBytes(8).toString("hex");
        response = crypto
            .createHash("md5")
            .update(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
            .digest("hex");

        return {
            username,
            realm: challenge.realm,
            nonce: challenge.nonce,
            uri: path,
            qop: challenge.qop,
            nc,
            cnonce,
            response,
            opaque: challenge.opaque,
        };
    } else {
        response = crypto
            .createHash("md5")
            .update(`${ha1}:${challenge.nonce}:${ha2}`)
            .digest("hex");

        return {
            username,
            realm: challenge.realm,
            nonce: challenge.nonce,
            uri: path,
            response,
            opaque: challenge.opaque,
        };
    }
}

/**
 * Render digest parameters as an Authorization header value (client side)
 * @param {object} params - The parameters to send
 * @returns {string} - The header value, including the "Digest " prefix
 */
export function formatDigestHeader(params) {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            if (key === "nc" || key === "qop") {
                parts.push(`${key}=${value}`);
            } else {
                parts.push(`${key}="${value}"`);
            }
        }
    }
    return `Digest ${parts.join(", ")}`;
}
