/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import {
    cryptoUsingMD5,
    parseAuthenticationInfo,
    computeDigestResponse,
    parseDigestChallenge,
    generateDigestResponse,
    formatDigestHeader,
} from "../../../src/helpers/digest";

/**
 * Full digest handshake with no socket involved.
 *
 * The server half (src/server/installer.js) and the client half (src/helpers/roku.js) are
 * both used in anger: the simulator serves the Roku web installer, and it also deploys to
 * a peer Roku by answering that device's challenge. This exercises both halves against
 * each other, which is the property that actually has to hold.
 */

const REALM = "BrightScript Simulator";
const USER = "rokudev";
const PASSWORD = "rokudev";

/**
 * Build the challenge installer.js sends, in the same shape as authenticateUser()
 * @param {object} [overrides] - Values to override in the challenge
 * @returns {string} - The WWW-Authenticate header value
 */
function serverChallenge(overrides = {}) {
    const { realm = REALM, nonce = String(Math.random()), opaque = cryptoUsingMD5(REALM) } = overrides;
    return `Digest realm="${realm}",qop="auth",nonce="${nonce}",opaque="${opaque}"`;
}

/**
 * Verify a client's Authorization header the way performDigestAuth() does
 * @param {string} authorization - The full Authorization header value
 * @param {string} method - The HTTP method of the request
 * @returns {boolean} - True when the response matches
 */
function serverVerify(authorization, method) {
    const parsed = parseAuthenticationInfo(authorization.replace(/^Digest /, ""));
    if (parsed.username !== USER) {
        return false;
    }
    const expected = computeDigestResponse({
        ...parsed,
        realm: REALM,
        password: PASSWORD,
        method,
    });
    return parsed.response === expected;
}

describe("digest handshake", () => {
    it("authenticates a correct client response", () => {
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "GET", "/", challenge);
        expect(serverVerify(formatDigestHeader(params), "GET")).toBe(true);
    });

    it("rejects a wrong password", () => {
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, "wrong", "GET", "/", challenge);
        expect(serverVerify(formatDigestHeader(params), "GET")).toBe(false);
    });

    it("rejects an unknown user", () => {
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse("mallory", PASSWORD, "GET", "/", challenge);
        expect(serverVerify(formatDigestHeader(params), "GET")).toBe(false);
    });

    it("rejects a response computed for a different method", () => {
        // HA2 covers the method, so a GET response must not authorise a POST.
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "GET", "/", challenge);
        expect(serverVerify(formatDigestHeader(params), "POST")).toBe(false);
    });

    it("rejects a response computed for a different URI", () => {
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "POST", "/plugin_install", challenge);
        const tampered = formatDigestHeader({ ...params, uri: "/" });
        expect(serverVerify(tampered, "POST")).toBe(false);
    });

    it("authenticates the peer-deploy path", () => {
        // This is the exact exchange runOnPeerRoku() performs against a real device.
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "POST", "/plugin_install", challenge);
        expect(serverVerify(formatDigestHeader(params), "POST")).toBe(true);
    });
});

describe("values containing an equals sign", () => {
    // These used to fail: the server split every parameter on "=" and kept only the first
    // segment, truncating base64 padding and query strings. The handshake above passed only
    // because this server's own challenge never emits an "=". A third-party client did.
    it("authenticates when the opaque value is base64 padded", () => {
        const challenge = parseDigestChallenge(serverChallenge({ opaque: "YWJjZGVm==" }));
        const params = generateDigestResponse(USER, PASSWORD, "GET", "/", challenge);
        const header = formatDigestHeader(params);
        expect(parseAuthenticationInfo(header.replace(/^Digest /, "")).opaque).toBe("YWJjZGVm==");
        expect(serverVerify(header, "GET")).toBe(true);
    });

    it("authenticates when the client nonce is base64 padded", () => {
        // cnonce is part of the hash, so truncating it broke verification outright.
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "GET", "/", challenge);
        const cnonce = "Zm9vYmFy==";
        const response = computeDigestResponse({
            username: USER,
            realm: REALM,
            password: PASSWORD,
            method: "GET",
            uri: "/",
            nonce: challenge.nonce,
            nc: params.nc,
            cnonce,
            qop: challenge.qop,
        });
        const header = formatDigestHeader({ ...params, cnonce, response });
        expect(serverVerify(header, "GET")).toBe(true);
    });

    it("authenticates a request URI carrying a query string", () => {
        // The realistic case: /plugin_install?archive=dev.zip used to truncate to
        // "/plugin_install?archive", so HA2 no longer matched.
        const challenge = parseDigestChallenge(serverChallenge());
        const uri = "/plugin_install?archive=dev.zip";
        const params = generateDigestResponse(USER, PASSWORD, "POST", uri, challenge);
        const header = formatDigestHeader(params);
        expect(parseAuthenticationInfo(header.replace(/^Digest /, "")).uri).toBe(uri);
        expect(serverVerify(header, "POST")).toBe(true);
    });

    it("accepts a client that separates parameters without a space", () => {
        const challenge = parseDigestChallenge(serverChallenge());
        const params = generateDigestResponse(USER, PASSWORD, "GET", "/", challenge);
        const header = formatDigestHeader(params).replace(/, /g, ",");
        expect(serverVerify(header, "GET")).toBe(true);
    });
});
