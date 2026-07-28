/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    isValidIP,
    isValidUrl,
    isLocalhostAddress,
    destroyRemoteClients,
    formatPath,
    getRokuOS,
    readJsonFile,
    writeJsonFile,
    getGateway,
} from "../../../src/helpers/util";
import { __setActiveInterface, __setError } from "../../mocks/network";

describe("isValidIP", () => {
    it("accepts dotted quads", () => {
        expect(isValidIP("192.168.1.1")).toBe(true);
        expect(isValidIP("0.0.0.0")).toBe(true);
        expect(isValidIP("255.255.255.255")).toBe(true);
        expect(isValidIP("127.0.0.1")).toBe(true);
    });

    it("rejects octets outside 0-255", () => {
        expect(isValidIP("256.1.1.1")).toBe(false);
        expect(isValidIP("1.1.1.256")).toBe(false);
        expect(isValidIP("1.2.3.-1")).toBe(false);
    });

    it("rejects the wrong number of octets", () => {
        expect(isValidIP("1.2.3")).toBe(false);
        expect(isValidIP("1.2.3.4.5")).toBe(false);
        expect(isValidIP("")).toBe(false);
    });

    it("rejects non-numeric octets", () => {
        expect(isValidIP("a.b.c.d")).toBe(false);
        expect(isValidIP("192.168.1.x")).toBe(false);
    });

    it("rejects non-strings", () => {
        expect(isValidIP(undefined)).toBe(false);
        expect(isValidIP(null)).toBe(false);
        expect(isValidIP(12345)).toBe(false);
        expect(isValidIP(["1.2.3.4"])).toBe(false);
    });

    it("rejects octets that are not plain decimal numbers", () => {
        // Number() coercion used to accept all of these: "" is 0, " 1" is 1, "0x10" is 16
        // and "4e0" is 4. A configured peer address that looks like one of these is a
        // typo, and failing here beats a confusing network error later.
        expect(isValidIP("1.2.3.")).toBe(false);
        expect(isValidIP(" 1.2.3.4")).toBe(false);
        expect(isValidIP("0x10.1.1.1")).toBe(false);
        expect(isValidIP("1.2.3.4e0")).toBe(false);
        expect(isValidIP("1.2.3.+4")).toBe(false);
        expect(isValidIP("1.2.3.0004")).toBe(false);
    });

    it("still accepts ordinary addresses", () => {
        // Guard against over-tightening: leading zeros within three digits are common in
        // hand-typed addresses and remain acceptable.
        expect(isValidIP("192.168.001.1")).toBe(true);
        expect(isValidIP("010.0.0.1")).toBe(true);
    });
});

describe("isLocalhostAddress", () => {
    it("accepts IPv4 loopback", () => {
        expect(isLocalhostAddress("127.0.0.1")).toBe(true);
    });

    it("accepts IPv6 loopback", () => {
        expect(isLocalhostAddress("::1")).toBe(true);
    });

    it("accepts IPv4-mapped IPv6 loopback", () => {
        expect(isLocalhostAddress("::ffff:127.0.0.1")).toBe(true);
    });

    it("rejects non-loopback addresses", () => {
        expect(isLocalhostAddress("192.168.1.1")).toBe(false);
        expect(isLocalhostAddress("::ffff:192.168.1.1")).toBe(false);
        expect(isLocalhostAddress("0.0.0.0")).toBe(false);
        expect(isLocalhostAddress("10.0.0.1")).toBe(false);
    });

    it("rejects the 'localhost' hostname — only numeric IPs are compared", () => {
        expect(isLocalhostAddress("localhost")).toBe(false);
    });

    it("rejects undefined and null without throwing", () => {
        expect(isLocalhostAddress(undefined)).toBe(false);
        expect(isLocalhostAddress(null)).toBe(false);
    });
});

describe("destroyRemoteClients", () => {
    const fakeClient = (remoteAddress) => ({ remoteAddress, destroy: vi.fn() });

    it("drops the clients connected from the network and keeps the local ones", () => {
        const local = fakeClient("127.0.0.1");
        const localV6 = fakeClient("::1");
        const mapped = fakeClient("::ffff:127.0.0.1");
        const remote = fakeClient("192.0.2.10");
        const remoteV6 = fakeClient("::ffff:192.0.2.10");
        const clients = new Map([
            [0, local],
            [1, remote],
            [2, localV6],
            [3, remoteV6],
            [4, mapped],
        ]);

        expect(destroyRemoteClients(clients)).toBe(2);
        expect(remote.destroy).toHaveBeenCalled();
        expect(remoteV6.destroy).toHaveBeenCalled();
        expect(local.destroy).not.toHaveBeenCalled();
        expect(localV6.destroy).not.toHaveBeenCalled();
        expect(mapped.destroy).not.toHaveBeenCalled();
        // The dropped ids are removed so a later broadcast does not write to a dead socket.
        expect([...clients.keys()]).toEqual([0, 2, 4]);
    });

    it("drops a client whose socket was already torn down", () => {
        // A destroyed socket reports no remote address, so it cannot be proven local.
        const stale = fakeClient(undefined);
        const clients = new Map([[0, stale]]);

        expect(destroyRemoteClients(clients)).toBe(1);
        expect(stale.destroy).toHaveBeenCalled();
        expect(clients.size).toBe(0);
    });

    it("does nothing when there are no clients", () => {
        const clients = new Map();
        expect(destroyRemoteClients(clients)).toBe(0);
        expect(clients.size).toBe(0);
    });
});

describe("isValidUrl", () => {
    it("accepts absolute URLs", () => {
        expect(isValidUrl("http://example.com")).toBe(true);
        expect(isValidUrl("https://example.com/path?query=1#hash")).toBe(true);
        expect(isValidUrl("file:///tmp/app.zip")).toBe(true);
        expect(isValidUrl("ws://127.0.0.1:8060/ecp-session")).toBe(true);
    });

    it("rejects strings that are not URLs", () => {
        expect(isValidUrl("not a url")).toBe(false);
        expect(isValidUrl("example.com")).toBe(false);
        expect(isValidUrl("")).toBe(false);
        expect(isValidUrl(undefined)).toBe(false);
    });
});

describe("formatPath", () => {
    it("leaves POSIX paths alone on non-Windows platforms", () => {
        // The module captures process.platform at import time, so this branch is
        // whichever one the host runs. See the dynamic-import test below for the other.
        const posix = "/Users/test/Documents/app.zip";
        expect(formatPath(posix)).toBe(posix);
    });

    it("converts backslashes to forward slashes when running on Windows", async () => {
        const original = Object.getOwnPropertyDescriptor(process, "platform");
        Object.defineProperty(process, "platform", { value: "win32", configurable: true });
        try {
            // Drop the module cache so the module-level `isWindows` const is re-evaluated
            // against the stubbed platform.
            vi.resetModules();
            const fresh = await import("../../../src/helpers/util");
            expect(fresh.formatPath(String.raw`C:\Users\test\app.zip`)).toBe("C:/Users/test/app.zip");
            expect(fresh.formatPath("already/posix")).toBe("already/posix");
        } finally {
            Object.defineProperty(process, "platform", original);
            vi.resetModules();
        }
    });
});

describe("getRokuOS", () => {
    // "BSC.30E04170A" decodes as: charAt(2) === "C" -> index 11 in the version alphabet
    // "0123456789ACDEFGHJKLMNPRSTUVWXY" (note: no B), minor "3", revision "0", build "4170".
    const firmware = "BSC.30E04170A";

    it("decodes the version by default", () => {
        expect(getRokuOS(firmware)).toBe("11.3.0");
    });

    it("returns the build when version is false", () => {
        expect(getRokuOS(firmware, false)).toBe("4170");
    });

    it("appends the build when full is true", () => {
        expect(getRokuOS(firmware, true, true)).toBe("11.3.0.4170");
    });

    it("decodes each letter in the version alphabet", () => {
        // The alphabet deliberately skips B, I, O, Q and Z to avoid digit lookalikes.
        const alphabet = "0123456789ACDEFGHJKLMNPRSTUVWXY";
        for (const [index, char] of [...alphabet].entries()) {
            expect(getRokuOS(`XX${char}.50E04170A`)).toBe(`${index}.5.0`);
        }
    });

    it("returns an empty string for firmware that is too short", () => {
        expect(getRokuOS("BSC.30E04170")).toBe(""); // exactly 12 characters
        expect(getRokuOS("short")).toBe("");
        expect(getRokuOS("")).toBe("");
        expect(getRokuOS(undefined)).toBe("");
        expect(getRokuOS(null)).toBe("");
    });

    it("returns an empty string for a character outside the version alphabet", () => {
        // B, I, O, Q and Z are deliberately absent from the alphabet. Treat an
        // unrecognised character the same as firmware that is too short to decode,
        // rather than reporting a negative major version.
        expect(getRokuOS("XXB.30E04170A")).toBe("");
        expect(getRokuOS("XXZ.30E04170A")).toBe("");
        expect(getRokuOS("XXB.30E04170A", true, true)).toBe("");
    });

    it("still returns the build for an unknown character when asked for the build", () => {
        // The build is a plain slice and does not depend on the alphabet.
        expect(getRokuOS("XXB.30E04170A", false)).toBe("4170");
    });
});

describe("readJsonFile / writeJsonFile", () => {
    let dir;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-util-spec-"));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("round-trips an object", () => {
        const file = path.join(dir, "recent-files.json");
        const data = { zip: ["/tmp/a.zip"], ids: ["123"], nested: { count: 2 } };
        writeJsonFile(file, data);
        expect(readJsonFile(file)).toEqual(data);
    });

    it("leaves no temporary file behind after an atomic write", () => {
        const file = path.join(dir, "settings.json");
        writeJsonFile(file, { ok: true });
        expect(fs.existsSync(`${file}.__new__`)).toBe(false);
        expect(fs.readdirSync(dir)).toEqual(["settings.json"]);
    });

    it("overwrites an existing file", () => {
        const file = path.join(dir, "settings.json");
        writeJsonFile(file, { version: 1 });
        writeJsonFile(file, { version: 2 });
        expect(readJsonFile(file)).toEqual({ version: 2 });
    });

    it("returns undefined when the file does not exist", () => {
        expect(readJsonFile(path.join(dir, "missing.json"))).toBeUndefined();
    });

    it("throws on malformed JSON", () => {
        const file = path.join(dir, "corrupt.json");
        fs.writeFileSync(file, "{ not json");
        expect(() => readJsonFile(file)).toThrow(SyntaxError);
    });

    it("rethrows errors other than ENOENT", () => {
        // Reading a directory fails with EISDIR on macOS/Linux and EBUSY/EPERM on Windows;
        // whatever it is, it must not be swallowed the way a missing file is.
        expect(() => readJsonFile(dir)).toThrow();
    });
});

describe("getGateway", () => {
    it("reports the active interface's gateway", async () => {
        __setActiveInterface({ name: "en0", gateway_ip: "192.0.2.1", type: "Wired" });
        await expect(getGateway()).resolves.toEqual({
            ip: "192.0.2.1",
            name: "en0",
            type: "WiredConnection",
            ssid: "",
        });
    });

    it("maps a wireless interface to WiFiConnection", async () => {
        __setActiveInterface({ name: "wlan0", gateway_ip: "192.0.2.2", type: "Wireless" });
        const gateway = await getGateway();
        expect(gateway.ip).toBe("192.0.2.2");
        expect(gateway.name).toBe("wlan0");
        expect(gateway.type).toBe("WiFiConnection");
        // The SSID comes from shelling out to a platform-specific command; on a CI runner
        // that yields the "WiFi" fallback rather than a real network name.
        expect(typeof gateway.ssid).toBe("string");
    });

    it("returns empty values when the interface lookup fails", async () => {
        // The rejection has to surface at the await so the try/catch can absorb it. Before
        // getActiveInterface() was awaited, the rejection escaped as an unhandled promise
        // and every field below was filled in from an undefined gateway instead.
        __setError(new Error("no active interface"));
        await expect(getGateway()).resolves.toEqual({
            ip: "",
            name: "",
            type: "",
            ssid: "",
        });
    });
});
