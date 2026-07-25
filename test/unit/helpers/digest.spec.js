/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
    cryptoUsingMD5,
    parseAuthenticationInfo,
    computeDigestResponse,
    parseDigestChallenge,
    generateDigestResponse,
    formatDigestHeader,
} from "../../../src/helpers/digest";

describe("cryptoUsingMD5", () => {
    it("produces the standard MD5 hex digest", () => {
        expect(cryptoUsingMD5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
        expect(cryptoUsingMD5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    });

    it("always returns 32 lowercase hex characters", () => {
        expect(cryptoUsingMD5("BrightScript Simulator")).toMatch(/^[0-9a-f]{32}$/);
    });
});

describe("computeDigestResponse", () => {
    it("matches the RFC 2617 section 3.5 sample", () => {
        // The canonical worked example from the spec, with qop=auth.
        const params = {
            username: "Mufasa",
            realm: "testrealm@host.com",
            password: "Circle Of Life",
            method: "GET",
            uri: "/dir/index.html",
            nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093",
            nc: "00000001",
            cnonce: "0a4f113b",
            qop: "auth",
        };
        expect(computeDigestResponse(params)).toBe("6629fae49393a05397450978507c4ef1");
    });

    it("changes when any input changes", () => {
        const base = {
            username: "rokudev",
            realm: "BrightScript Simulator",
            password: "rokudev",
            method: "GET",
            uri: "/",
            nonce: "abc",
            nc: "00000001",
            cnonce: "def",
            qop: "auth",
        };
        const expected = computeDigestResponse(base);
        for (const field of Object.keys(base)) {
            expect(computeDigestResponse({ ...base, [field]: "changed" })).not.toBe(expected);
        }
    });
});

describe("parseAuthenticationInfo", () => {
    it("parses a typical Authorization header body", () => {
        const header =
            'username="rokudev", realm="BrightScript Simulator", nonce="0.123456", ' +
            'uri="/", qop=auth, nc=00000001, cnonce="a1b2c3d4", response="deadbeef", opaque="f00d"';
        expect(parseAuthenticationInfo(header)).toEqual({
            username: "rokudev",
            realm: "BrightScript Simulator",
            nonce: "0.123456",
            uri: "/",
            qop: "auth",
            nc: "00000001",
            cnonce: "a1b2c3d4",
            response: "deadbeef",
            opaque: "f00d",
        });
    });

    it("strips surrounding quotes but keeps the value intact", () => {
        expect(parseAuthenticationInfo('realm="A B C"')).toEqual({ realm: "A B C" });
    });

    // Regression guard: the value used to be taken from split("=")[1], truncating anything
    // containing "=". Real clients base64-encode cnonce and opaque, and base64 pads with
    // "=", so a third-party client hit an unexplained 401 loop. Only this server's own
    // challenge (Math.random nonce, hex opaque) happened to avoid the character.
    it("keeps a value containing an equals sign intact", () => {
        expect(parseAuthenticationInfo('cnonce="Zm9vYmFy=="')).toEqual({ cnonce: "Zm9vYmFy==" });
        expect(parseAuthenticationInfo('opaque="YWJjZA=="')).toEqual({ opaque: "YWJjZA==" });
    });

    it("keeps a request URI with a query string intact", () => {
        expect(parseAuthenticationInfo('uri="/plugin_install?archive=dev.zip"')).toEqual({
            uri: "/plugin_install?archive=dev.zip",
        });
    });

    // Regression guard: the split used to be on the literal ", ", so a client that omitted
    // the space produced one malformed key instead of separate parameters.
    it("splits parameters separated by a bare comma", () => {
        expect(parseAuthenticationInfo('username="a",realm="b"')).toEqual({
            username: "a",
            realm: "b",
        });
    });

    it("ignores a malformed parameter with no value", () => {
        expect(parseAuthenticationInfo('username="a", garbage, realm="b"')).toEqual({
            username: "a",
            realm: "b",
        });
    });
});

describe("parseDigestChallenge", () => {
    it("parses a WWW-Authenticate challenge", () => {
        const challenge = 'Digest realm="BrightScript Simulator",qop="auth",nonce="0.987654",opaque="cafebabe"';
        expect(parseDigestChallenge(challenge)).toEqual({
            realm: "BrightScript Simulator",
            qop: "auth",
            nonce: "0.987654",
            opaque: "cafebabe",
        });
    });

    it("accepts unquoted parameter values", () => {
        const parsed = parseDigestChallenge("Digest realm=simple, qop=auth, algorithm=MD5");
        expect(parsed).toEqual({ realm: "simple", qop: "auth", algorithm: "MD5" });
    });

    it("handles quoted and unquoted values in one header", () => {
        const parsed = parseDigestChallenge('Digest realm="A B", qop=auth, nonce="xyz"');
        expect(parsed.realm).toBe("A B");
        expect(parsed.qop).toBe("auth");
        expect(parsed.nonce).toBe("xyz");
    });

    it("returns an empty object for a header with no parameters", () => {
        expect(parseDigestChallenge("Digest")).toEqual({});
        expect(parseDigestChallenge("")).toEqual({});
    });
});

describe("generateDigestResponse", () => {
    const challenge = {
        realm: "BrightScript Simulator",
        qop: "auth",
        nonce: "0.123456789",
        opaque: "abcdef0123456789",
    };

    it("returns the full qop=auth parameter set", () => {
        const result = generateDigestResponse("rokudev", "rokudev", "POST", "/plugin_install", challenge);
        expect(Object.keys(result).sort()).toEqual([
            "cnonce",
            "nc",
            "nonce",
            "opaque",
            "qop",
            "realm",
            "response",
            "uri",
            "username",
        ]);
        expect(result.nc).toBe("00000001");
        expect(result.cnonce).toMatch(/^[0-9a-f]{16}$/);
        expect(result.uri).toBe("/plugin_install");
    });

    it("computes a response the server can reproduce", () => {
        const result = generateDigestResponse("rokudev", "rokudev", "GET", "/", challenge);
        const expected = computeDigestResponse({
            username: "rokudev",
            realm: challenge.realm,
            password: "rokudev",
            method: "GET",
            uri: "/",
            nonce: challenge.nonce,
            nc: result.nc,
            cnonce: result.cnonce,
            qop: challenge.qop,
        });
        expect(result.response).toBe(expected);
    });

    it("uses a fresh client nonce each time", () => {
        const first = generateDigestResponse("rokudev", "rokudev", "GET", "/", challenge);
        const second = generateDigestResponse("rokudev", "rokudev", "GET", "/", challenge);
        expect(first.cnonce).not.toBe(second.cnonce);
        expect(first.response).not.toBe(second.response);
    });

    it("falls back to the RFC 2069 form without qop", () => {
        const legacy = { realm: "r", nonce: "n", opaque: "o" };
        const result = generateDigestResponse("user", "pass", "GET", "/", legacy);
        expect(result.qop).toBeUndefined();
        expect(result.nc).toBeUndefined();
        expect(result.cnonce).toBeUndefined();

        const ha1 = crypto.createHash("md5").update("user:r:pass").digest("hex");
        const ha2 = crypto.createHash("md5").update("GET:/").digest("hex");
        const expected = crypto.createHash("md5").update(`${ha1}:n:${ha2}`).digest("hex");
        expect(result.response).toBe(expected);
    });

    it("supports auth-int the same way as auth", () => {
        const result = generateDigestResponse("u", "p", "GET", "/", { ...challenge, qop: "auth-int" });
        expect(result.qop).toBe("auth-int");
        expect(result.nc).toBe("00000001");
    });
});

describe("formatDigestHeader", () => {
    it("quotes every parameter except nc and qop", () => {
        const header = formatDigestHeader({
            username: "rokudev",
            realm: "BrightScript Simulator",
            nonce: "0.1",
            uri: "/",
            qop: "auth",
            nc: "00000001",
            cnonce: "abcd",
            response: "beef",
            opaque: "f00d",
        });
        expect(header).toBe(
            'Digest username="rokudev", realm="BrightScript Simulator", nonce="0.1", uri="/", ' +
                'qop=auth, nc=00000001, cnonce="abcd", response="beef", opaque="f00d"'
        );
    });

    it("omits undefined parameters", () => {
        // opaque is optional; an undefined value must not become the string "undefined".
        const header = formatDigestHeader({ username: "u", opaque: undefined });
        expect(header).toBe('Digest username="u"');
        expect(header).not.toContain("undefined");
    });

    it("always carries the Digest scheme prefix", () => {
        expect(formatDigestHeader({})).toBe("Digest ");
        expect(formatDigestHeader({ a: "b" }).startsWith("Digest ")).toBe(true);
    });
});
