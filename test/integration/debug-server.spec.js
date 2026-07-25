/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSendCount } from "../helpers/fakeWindow.js";
import { connectSocket } from "../helpers/socketClient.js";
import { getSettings } from "../../src/helpers/settings";
import {
    enableDebugServer,
    disableDebugServer,
    subscribeDebugServer,
    unsubscribeDebugServer,
} from "../../src/server/debug";

/**
 * The Roku dev-console command shell on a real TCP socket.
 *
 * Note this is not the MicroDebugger (that is telnet on 8085 and lives in brs-engine);
 * this is the separate command shell that implements press, type, plugins and friends.
 */
describe("debug server", () => {
    let win;
    let port;
    const open = [];

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        port = await getFreePort();
        const settings = getSettings(win);
        await new Promise((resolve) => {
            subscribeDebugServer("test-ready", (event, enabled) => {
                if (event === "enabled" && enabled) {
                    resolve();
                }
            });
            // debug.js caches window/settings on the first enable only.
            enableDebugServer(win, settings, port);
        });
        unsubscribeDebugServer("test-ready");
    });

    beforeEach(() => {
        // The global setup clears the window registry between tests. The debug server
        // caches its window at enable time, but the `press` handler re-resolves
        // BrowserWindow.fromId(1) on every command, so it has to stay registered.
        __registerWindow(win);
    });

    afterEach(() => {
        for (const client of open.splice(0)) {
            client.end();
        }
        win.sent.length = 0;
    });

    afterAll(() => {
        disableDebugServer();
    });

    /**
     * Open a shell connection and wait for the prompt
     * @returns {Promise<object>} - The connected client
     */
    async function connect() {
        const client = await connectSocket(port);
        open.push(client);
        await client.waitForText(">");
        return client;
    }

    /**
     * Send a command and wait for the next prompt
     * @param {object} client - The connected client
     * @param {string} command - The command to send, without the terminator
     * @returns {Promise<string>} - The output produced by the command
     */
    async function run(client, command) {
        client.clear();
        client.write(`${command}\r\n`);
        await client.waitForText(">");
        return client.text();
    }

    it("greets with the device identity and a prompt", async () => {
        const client = await connect();
        // Serial number, friendly name and the full OS version decoded from the firmware.
        expect(client.text()).toContain("BRSDESKTOP070");
        expect(client.text()).toContain("BrightScript Simulator");
        expect(client.text()).toContain("11.3.0.4170");
        expect(client.text().endsWith(">")).toBe(true);
    });

    it("lists every command for help", async () => {
        const client = await connect();
        const output = await run(client, "help");
        expect(output).toContain("Display the help.");
        expect(output).toContain("Simulate a keypress.");
        expect(output).toContain("Send a literal text sequence.");
    });

    it("treats ? as an alias for help", async () => {
        const client = await connect();
        expect(await run(client, "?")).toContain("Display the help.");
    });

    it("describes a single command when given an argument", async () => {
        const client = await connect();
        const output = await run(client, "help press");
        expect(output).toContain("Simulate a keypress.");
        expect(output).not.toContain("Send a literal text sequence.");
    });

    it("reports the developer key", async () => {
        const client = await connect();
        expect(await run(client, "showkey")).toContain("brs-dev-id");
    });

    it("lists the installed plugins", async () => {
        const client = await connect();
        const output = await run(client, "plugins");
        expect(output).toContain("Test App");
    });

    it("remembers the rendezvous logging state", async () => {
        const client = await connect();
        await run(client, "logrendezvous on");
        expect(await run(client, "logrendezvous")).toMatch(/on/i);
        await run(client, "logrendezvous off");
        expect(await run(client, "logrendezvous")).toMatch(/off/i);
    });

    it("sends one key per character of a press argument, in order", async () => {
        const client = await connect();
        client.write("press hus\r\n");
        const sent = await waitForSendCount(win, "postKeyPress", 3);
        expect(sent.map((message) => message.args[0])).toEqual(["home", "up", "select"]);
    });

    it("lists the available keys when press has no argument", async () => {
        const client = await connect();
        const output = await run(client, "press");
        expect(output).toContain("Home");
        expect(output).toContain("InstantReplay");
    });

    it("sends literal keys for a type argument", async () => {
        const client = await connect();
        client.write("type abc\r\n");
        const sent = await waitForSendCount(win, "postKeyPress", 3);
        expect(sent.map((message) => message.args[0])).toEqual(["lit_a", "lit_b", "lit_c"]);
    });

    it("reports a documented but unimplemented command", async () => {
        const client = await connect();
        // sgnodes is listed in the help text but handled by brs-engine, not here.
        expect(await run(client, "sgnodes")).toContain("Command not implemented yet");
    });

    it("rejects an unknown command", async () => {
        const client = await connect();
        expect(await run(client, "bogus")).toContain("Command not recognized");
    });

    it("closes the connection on quit", async () => {
        const client = await connect();
        client.clear();
        client.write("quit\r\n");
        await client.waitForText("Quit command received");
        await client.waitForClose();
        expect(client.text()).toContain("Quit command received, exiting.");
        expect(client.closed).toBe(true);
    });
});
