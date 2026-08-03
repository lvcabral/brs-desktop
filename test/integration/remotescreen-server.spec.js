/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import http from "node:http";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import {
    enableRemoteScreen,
    disableRemoteScreen,
    subscribeRemoteScreen,
    unsubscribeRemoteScreen,
} from "../../src/server/remotescreen";

/**
 * The Remote Screen HTTP surface, over a real socket on an ephemeral port.
 *
 * The WebRTC media path is deliberately absent: Electron is aliased away under vitest, and
 * there is no DOM canvas, no captureStream() and no RTCPeerConnection to drive. What is covered
 * here is everything the viewer page needs before the video starts -- the page itself, the
 * config it renders from, and the text-entry route.
 */
describe("Remote Screen HTTP server", () => {
    let win;
    let base;
    let port;

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        port = await new Promise((resolve) => {
            subscribeRemoteScreen("test-ready", (event, data) => {
                if (event === "enabled" && data.enabled) {
                    resolve(data.port);
                }
            });
            getFreePort().then((free) => enableRemoteScreen(win, free));
        });
        unsubscribeRemoteScreen("test-ready");
        base = `http://127.0.0.1:${port}`;
    });

    beforeEach(() => {
        __registerWindow(win);
    });

    afterAll(() => {
        disableRemoteScreen();
    });

    it("serves the viewer page at the root", async () => {
        // This passes only because the service resolves assets through the ASSET_BASE probe;
        // the web installer's bare __dirname cannot find src/app/web under vite-node.
        const res = await fetch(`${base}/`);
        const body = await res.text();
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/html");
        expect(body).toContain("<video");
        expect(body).toContain("/remote.js");
    });

    it("serves the same page at /index.html", async () => {
        const res = await fetch(`${base}/index.html`);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain("<video");
    });

    it("serves the stylesheet and the viewer script the page asks for", async () => {
        const css = await fetch(`${base}/remote.css`);
        const js = await fetch(`${base}/remote.js`);
        expect(css.status).toBe(200);
        expect(css.headers.get("content-type")).toBe("text/css");
        expect(js.status).toBe(200);
        expect(js.headers.get("content-type")).toBe("text/javascript");
        // A 404 here would leave the page rendering with no behaviour at all.
        expect(await js.text()).toContain("RTCPeerConnection");
    });

    it("serves the shared Roku skin the web installer also uses", async () => {
        // remote.css only adds the video stage and the D-pad; without this the page loses its
        // whole visual identity and renders as unstyled HTML.
        const res = await fetch(`${base}/css/styles.min.css`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/css");
        expect(await res.text()).toContain(".roku-button");
    });

    it("links the page to both stylesheets in skin-then-override order", async () => {
        // The skin styles bare `button` globally, so remote.css has to come second or the
        // remote's own geometry loses to it.
        const body = await fetch(`${base}/`).then((res) => res.text());
        expect(body.indexOf("/css/styles.min.css")).toBeGreaterThan(-1);
        expect(body.indexOf("/remote.css")).toBeGreaterThan(body.indexOf("/css/styles.min.css"));
    });

    it("reports the settings the viewer page builds itself from", async () => {
        const res = await fetch(`${base}/config`);
        const config = await res.json();
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/json");
        expect(config.ecpPort).toBe(8060);
        // ECP is not started in this spec, so the page must be told the remote will be inert.
        expect(config.ecpEnabled).toBe(false);
        expect(config.displayMode).toBe(globalThis.sharedObject.deviceInfo.displayMode);
        expect(config.maxViewers).toBeGreaterThan(0);
    });

    it("replays posted text through the renderer's existing paste queue", async () => {
        const res = await fetch(`${base}/paste`, { method: "POST", body: "hello world" });
        expect(res.status).toBe(204);
        const messages = await waitForSend(win, "pasteText");
        expect(messages.at(-1).args[0]).toBe("hello world");
    });

    it("rejects a paste body too large to be someone typing", async () => {
        const res = await fetch(`${base}/paste`, { method: "POST", body: "x".repeat(5000) });
        expect(res.status).toBe(413);
    });

    it("reassembles a multi-byte character split across two chunks", async () => {
        // The body is written as two chunks that cut a 3-byte UTF-8 character in half. Decoding
        // each chunk on its own would yield replacement characters, which the paste queue would
        // then type into the app as the wrong keypresses.
        const bytes = Buffer.from("aé漢z", "utf8");
        const split = bytes.length - 2;
        const status = await new Promise((resolve, reject) => {
            const req = http.request({ host: "127.0.0.1", port, path: "/paste", method: "POST" }, (res) => {
                res.resume();
                resolve(res.statusCode);
            });
            req.on("error", reject);
            req.write(bytes.subarray(0, split));
            req.end(bytes.subarray(split));
        });
        expect(status).toBe(204);
        const messages = await waitForSend(win, "pasteText");
        expect(messages.at(-1).args[0]).toBe("aé漢z");
    });

    it("refuses a paste sent by a page from another origin", async () => {
        // A body-only POST is a CORS-safelisted simple request, so a hostile page on any website
        // can reach loopback without a preflight. The address check cannot tell it apart from the
        // real viewer; the Origin can.
        const before = win.sentOn("pasteText").length;
        const res = await fetch(`${base}/paste`, {
            method: "POST",
            body: "typed by someone else",
            headers: { Origin: "https://example.com" },
        });
        expect(res.status).toBe(403);
        expect(win.sentOn("pasteText")).toHaveLength(before);
    });

    it("accepts a paste from the page it serves itself", async () => {
        const res = await fetch(`${base}/paste`, {
            method: "POST",
            body: "same origin",
            headers: { Origin: base },
        });
        expect(res.status).toBe(204);
        const messages = await waitForSend(win, "pasteText");
        expect(messages.at(-1).args[0]).toBe("same origin");
    });

    it("refuses a paste whose Origin is not a URL at all", async () => {
        const before = win.sentOn("pasteText").length;
        const res = await fetch(`${base}/paste`, {
            method: "POST",
            body: "malformed",
            headers: { Origin: "not-an-origin" },
        });
        expect(res.status).toBe(403);
        expect(win.sentOn("pasteText")).toHaveLength(before);
    });

    it("ignores an empty paste rather than waking the renderer", async () => {
        const before = win.sentOn("pasteText").length;
        const res = await fetch(`${base}/paste`, { method: "POST", body: "" });
        expect(res.status).toBe(204);
        expect(win.sentOn("pasteText")).toHaveLength(before);
    });

    it("returns 404 for an unknown path", async () => {
        const res = await fetch(`${base}/not-a-route`);
        expect(res.status).toBe(404);
        expect(await res.text()).toContain("File not found");
    });

    it("answers HEAD with no body", async () => {
        const res = await fetch(`${base}/`, { method: "HEAD" });
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("");
    });

    it("rejects methods it does not implement", async () => {
        const res = await fetch(`${base}/`, { method: "DELETE" });
        expect(res.status).toBe(405);
    });
});
