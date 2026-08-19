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
import { describe, it, expect, beforeEach } from "vitest";
import { protocol } from "../../mocks/electron.js";
import { registerAppScheme, enableAppProtocol, appUrl, userDataUrl } from "../../../src/helpers/protocol";

let rootDir;
let userDataDir;
let handler;

beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-desktop-app-root-"));
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-desktop-userdata-"));
    fs.writeFileSync(path.join(rootDir, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(userDataDir, "icon.png"), "fake-png-bytes");
    protocol.handle.mockClear();
    enableAppProtocol(rootDir, userDataDir);
    handler = protocol.handle.mock.calls[0][1];
});

describe("registerAppScheme", () => {
    it("registers the app scheme as standard/secure before app is ready", () => {
        registerAppScheme();
        expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
            expect.objectContaining({
                scheme: "app",
                privileges: expect.objectContaining({ standard: true, secure: true }),
            }),
        ]);
    });
});

describe("appUrl / userDataUrl", () => {
    it("builds URLs under the app:// origin", () => {
        expect(appUrl("index.html")).toBe("app://simulator/index.html");
        expect(userDataUrl("icon.png")).toBe("app://simulator/userdata/icon.png");
    });
});

describe("enableAppProtocol handler", () => {
    it("serves a file from rootDir with the matching content type", async () => {
        const response = await handler({ url: appUrl("index.html") });
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/html");
        expect(await response.text()).toBe("<html></html>");
    });

    it("serves a file from userDataDir under the /userdata/ prefix", async () => {
        const response = await handler({ url: userDataUrl("icon.png") });
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/png");
        expect(await response.text()).toBe("fake-png-bytes");
    });

    it("falls back to application/octet-stream for an unknown extension", async () => {
        fs.writeFileSync(path.join(rootDir, "data.bin"), "bytes");
        const response = await handler({ url: appUrl("data.bin") });
        expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    });

    it("returns 404 for a missing file", async () => {
        const response = await handler({ url: appUrl("missing.html") });
        expect(response.status).toBe(404);
    });

    it("never serves a file outside rootDir, even with a traversal URL", async () => {
        // The URL parser itself collapses ".." before the handler sees it (Node: new
        // URL("app://simulator/../../etc/passwd").pathname === "/etc/passwd"), so this lands
        // on a 404 rather than the explicit boundary check — the guard is defense in depth for
        // that check, not the only thing preventing escape. What matters is nothing outside
        // rootDir is ever returned.
        const secret = fs.mkdtempSync(path.join(os.tmpdir(), "brs-desktop-secret-"));
        fs.writeFileSync(path.join(secret, "passwd"), "root:x:0:0");
        const response = await handler({ url: appUrl("../../../../../.." + path.join(secret, "passwd")) });
        expect(response.status).not.toBe(200);
    });
});
