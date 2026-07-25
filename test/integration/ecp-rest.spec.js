/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createFakeWindow, __registerWindow, ipcMain } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import {
    initECP,
    enableECP,
    disableECP,
    subscribeECP,
    unsubscribeECP,
} from "../../src/server/ecp";

/**
 * The real ECP REST API, running in-process on an ephemeral port.
 *
 * This is the surface other tools speak to: the VS Code BrightScript extension discovers
 * the simulator as a Roku over ECP, and the Roku Deep Linking Tester drives it the same way.
 */
describe("ECP REST API", () => {
    let win;
    let base;

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        const port = await getFreePort();
        initECP();
        // The observer fires exactly when the socket is listening, so no sleeping.
        await new Promise((resolve) => {
            subscribeECP("test-ready", (event, enabled) => {
                if (event === "enabled" && enabled) {
                    resolve();
                }
            });
            enableECP(win, port);
        });
        unsubscribeECP("test-ready");
        base = `http://127.0.0.1:${port}`;
    });

    afterAll(() => {
        disableECP();
    });

    describe("discovery endpoints", () => {
        it("serves the UPnP device root", async () => {
            const response = await fetch(`${base}/`);
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("application/xml");
            const body = await response.text();
            expect(body).toContain("<friendlyName>");
            expect(body.trimEnd().endsWith("</root>")).toBe(true);
        });

        it("serves device info", async () => {
            const response = await fetch(`${base}/query/device-info`);
            expect(response.status).toBe(200);
            const body = await response.text();
            expect(body).toContain("<serial-number>BRSDESKTOP070</serial-number>");
            expect(body).toContain("<software-version>11.3.0</software-version>");
        });

        // BUG: src/server/ecp.js registers `//query/device-info` alongside the single-slash
        // route, evidently to serve clients that build the URL by concatenation. That
        // registration never matches — restana is created with ignoreTrailingSlash, which
        // normalises the duplicate away, so the double-slash path 404s. Verified with a raw
        // HTTP request, so this is the server's behaviour and not fetch normalising the URL.
        // Pinned rather than fixed: whether to support that path, and how, is a product call.
        it("does not answer the double-slash form, despite the extra route", async () => {
            expect((await fetch(`${base}/query/device-info`)).status).toBe(200);
            expect((await fetch(`${base}//query/device-info`)).status).toBe(404);
        });
    });

    describe("app queries", () => {
        it("lists the installed apps", async () => {
            const body = await fetch(`${base}/query/apps`).then((r) => r.text());
            expect(body).toContain('id="dev"');
            expect(body).toContain("Test App");
        });

        it("reports the active app", async () => {
            const body = await fetch(`${base}/query/active-app`).then((r) => r.text());
            expect(body).toContain("<active-app>");
        });

        it("reports app state for a known app", async () => {
            const body = await fetch(`${base}/query/app-state/dev`).then((r) => r.text());
            expect(body).not.toContain("FAILED");
        });

        it("reports FAILED for an unknown app", async () => {
            const body = await fetch(`${base}/query/app-state/nosuchapp`).then((r) => r.text());
            expect(body).toContain("FAILED");
        });

        it("serves the app registry", async () => {
            const body = await fetch(`${base}/query/registry/dev`).then((r) => r.text());
            expect(body).toContain("<dev-id>brs-dev-id</dev-id>");
        });

        it("serves the media player state", async () => {
            const response = await fetch(`${base}/query/media-player`);
            expect(response.status).toBe(200);
            expect(await response.text()).toContain("<player");
        });
    });

    describe("remote control", () => {
        it("forwards a keypress to the renderer", async () => {
            win.sent.length = 0;
            const response = await fetch(`${base}/keypress/home`, { method: "POST" });
            expect(response.status).toBe(200);
            expect(win.sentOn("postKeyPress")[0].args[0]).toBe("home");
        });

        it("forwards keydown and keyup separately", async () => {
            win.sent.length = 0;
            await fetch(`${base}/keydown/select`, { method: "POST" });
            await fetch(`${base}/keyup/select`, { method: "POST" });
            expect(win.sentOn("postKeyDown")[0].args[0]).toBe("select");
            expect(win.sentOn("postKeyUp")[0].args[0]).toBe("select");
        });

        it("notifies observers of a launch, carrying the deep-link query", async () => {
            const observer = vi.fn();
            subscribeECP("launch-test", observer);
            try {
                await fetch(`${base}/launch/dev?contentId=123&mediaType=movie`, { method: "POST" });
                expect(observer).toHaveBeenCalledWith(
                    "launch",
                    expect.objectContaining({ appID: "dev" })
                );
            } finally {
                unsubscribeECP("launch-test");
            }
        });

        it("closes the running app on exit-app", async () => {
            win.sent.length = 0;
            await fetch(`${base}/exit-app/dev`, { method: "POST" });
            expect(win.sentOn("closeChannel")).toHaveLength(1);
        });

        it("normalises the caller address on /input", async () => {
            // Reaching the server over a real socket is the only way to exercise the
            // IPv4-mapped IPv6 handling in sendInput; on localhost Node reports either
            // ::1 or ::ffff:127.0.0.1 depending on the stack.
            win.sent.length = 0;
            await fetch(`${base}/input?a=1`, { method: "POST" });
            const params = win.sentOn("postInputParams")[0].args[0];
            expect(params.source_ip_addr).toBe("127.0.0.1");
        });
    });

    describe("endpoints that read bundled files", () => {
        // These resolve paths with path.join(__dirname, ...). Under vite-node __dirname is
        // src/server/, not the webpack bundle's app/ directory, so the assets are absent.
        // They work in the packaged app; only the test environment cannot reach them.
        it.each(["/device-image.png", "/ecp_SCPD.xml", "/query/icon/dev"])(
            "%s fails in the test environment because __dirname differs",
            async (route) => {
                const response = await fetch(`${base}${route}`);
                expect(response.status).toBeGreaterThanOrEqual(400);
            }
        );
    });
});
