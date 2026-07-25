/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { parseDigestChallenge, generateDigestResponse, formatDigestHeader } from "../../src/helpers/digest";
import {
    setPassword,
    setPort,
    enableInstaller,
    disableInstaller,
    subscribeInstaller,
    unsubscribeInstaller,
} from "../../src/server/installer";

/**
 * The Roku web installer's digest authentication, end to end over a real socket.
 *
 * This is the most valuable integration test in the suite: it drives the server half
 * (src/server/installer.js, which serves the installer UI) with the client half
 * (src/helpers/digest.js, which src/helpers/roku.js uses to deploy to a peer Roku).
 * If the two ever drift apart, deploying to a real device breaks.
 */
describe("web installer digest auth", () => {
    let win;
    let base;

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        // The default port is 80, which is privileged; setPort is the existing seam.
        setPort(await getFreePort());
        setPassword("rokudev");
        const port = await new Promise((resolve) => {
            subscribeInstaller("test-ready", (event, data) => {
                if (event === "enabled" && data.enabled) {
                    resolve(data.port);
                }
            });
            enableInstaller(win);
        });
        unsubscribeInstaller("test-ready");
        base = `http://127.0.0.1:${port}`;
    });

    beforeEach(() => {
        __registerWindow(win);
    });

    afterAll(() => {
        disableInstaller();
    });

    /**
     * Perform the full challenge/response handshake for a request
     * @param {string} pathname - The request path
     * @param {object} [options] - Credentials and method overrides
     * @returns {Promise<Response>} - The authenticated response
     */
    async function authenticatedFetch(pathname, options = {}) {
        const { username = "rokudev", password = "rokudev", method = "GET" } = options;
        const unauthorized = await fetch(`${base}${pathname}`, { method });
        if (unauthorized.status !== 401) {
            return unauthorized;
        }
        const challenge = parseDigestChallenge(unauthorized.headers.get("www-authenticate"));
        const params = generateDigestResponse(username, password, method, pathname, challenge);
        return fetch(`${base}${pathname}`, {
            method,
            headers: { Authorization: formatDigestHeader(params) },
        });
    }

    it("challenges an unauthenticated request", async () => {
        const response = await fetch(`${base}/`);
        expect(response.status).toBe(401);
        const challenge = response.headers.get("www-authenticate");
        expect(challenge).toMatch(/^Digest /);
        const parsed = parseDigestChallenge(challenge);
        expect(parsed.realm).toBe("BrightScript Simulator");
        expect(parsed.qop).toBe("auth");
        expect(parsed.nonce).toBeTruthy();
        expect(parsed.opaque).toBeTruthy();
    });

    it("accepts a correctly computed response", async () => {
        // The complete handshake: 401 -> parse -> compute -> resend -> authorised.
        const response = await authenticatedFetch("/");
        expect(response.status).not.toBe(401);
    });

    it("rejects a wrong password with another challenge, not an error", async () => {
        const response = await authenticatedFetch("/", { password: "wrong" });
        expect(response.status).toBe(401);
    });

    it("rejects an unknown user", async () => {
        const response = await authenticatedFetch("/", { username: "mallory" });
        expect(response.status).toBe(401);
    });

    it("rejects a response computed for a different method", async () => {
        const unauthorized = await fetch(`${base}/`, { method: "POST" });
        expect(unauthorized.status).toBe(401);
        const challenge = parseDigestChallenge(unauthorized.headers.get("www-authenticate"));
        // Compute for GET but send as POST; HA2 covers the method, so this must fail.
        const params = generateDigestResponse("rokudev", "rokudev", "GET", "/", challenge);
        const response = await fetch(`${base}/`, {
            method: "POST",
            headers: { Authorization: formatDigestHeader(params) },
        });
        expect(response.status).toBe(401);
    });

    it("issues a fresh nonce for each challenge", async () => {
        const [first, second] = await Promise.all([fetch(`${base}/`), fetch(`${base}/`)]);
        const nonceOf = (r) => parseDigestChallenge(r.headers.get("www-authenticate")).nonce;
        expect(nonceOf(first)).not.toBe(nonceOf(second));
    });

    it("honours a changed password", async () => {
        setPassword("hunter2");
        try {
            expect((await authenticatedFetch("/", { password: "hunter2" })).status).not.toBe(401);
            expect((await authenticatedFetch("/", { password: "rokudev" })).status).toBe(401);
        } finally {
            setPassword("rokudev");
        }
    });

    it("serves package images without authentication", async () => {
        // Deliberate bypass: the installer page embeds these, and the browser will not
        // replay digest credentials for the image request.
        const response = await fetch(`${base}/pkgs/dev.png`);
        expect(response.status).not.toBe(401);
    });

    it("answers 404 for an unknown path once authenticated", async () => {
        const response = await authenticatedFetch("/nosuchpage");
        expect(response.status).toBe(404);
        expect(await response.text()).toContain("Error 404: Not Found");
    });

    it("returns an empty body for a HEAD request", async () => {
        const response = await authenticatedFetch("/nosuchpage", { method: "HEAD" });
        expect(await response.text()).toBe("");
    });
});
