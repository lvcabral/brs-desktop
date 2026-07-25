/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createFakeWindow, __registerWindow, ipcMain } from "../mocks/electron.js";
import { makeSharedObject, makeEngineDeviceInfo } from "../fixtures/sharedObject.js";
import { getFreePort } from "../helpers/freePort.js";
import { waitForSend } from "../helpers/fakeWindow.js";
import { connectSocket } from "../helpers/socketClient.js";
import {
    enableTelnet,
    disableTelnet,
    subscribeTelnet,
    unsubscribeTelnet,
} from "../../src/server/telnet";

/**
 * The remote console on a real TCP socket.
 *
 * The telnet IAC negotiation is asserted byte for byte: a real telnet client opens with
 * these sequences, and answering them wrongly leaves the console unusable.
 */
describe("telnet server", () => {
    let win;
    let port;
    const open = [];

    beforeAll(async () => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        win = __registerWindow(createFakeWindow(1));
        port = await getFreePort();
        await new Promise((resolve) => {
            subscribeTelnet("test-ready", (event, enabled) => {
                if (event === "enabled" && enabled) {
                    resolve();
                }
            });
            enableTelnet(win, port);
        });
        unsubscribeTelnet("test-ready");
    });

    afterEach(() => {
        for (const client of open.splice(0)) {
            client.end();
        }
        win.sent.length = 0;
    });

    afterAll(() => {
        disableTelnet();
    });

    /**
     * Open a console connection and wait for the greeting
     * @returns {Promise<object>} - The connected client
     */
    async function connect() {
        const client = await connectSocket(port);
        open.push(client);
        await client.waitForText("Connected to");
        return client;
    }

    it("greets a new connection", async () => {
        const client = await connect();
        expect(client.text()).toContain("Connected to BrightScript Simulator");
    });

    it("replays the console buffer to a new client", async () => {
        // console.js keeps a ring buffer so a late-joining client sees prior output.
        ipcMain.emit("telnet", {}, "earlier output\r\n");
        const client = await connect();
        await client.waitForText("earlier output");
        expect(client.text()).toContain("earlier output");
    });

    it("broadcasts console output to every connected client", async () => {
        const first = await connect();
        const second = await connect();
        first.clear();
        second.clear();
        ipcMain.emit("telnet", {}, "broadcast line\r\n");
        await first.waitForText("broadcast line");
        await second.waitForText("broadcast line");
    });

    describe("telnet IAC negotiation", () => {
        it("answers an interrupt with WONT and breaks into the debugger", async () => {
            const client = await connect();
            client.clear();
            client.write(Buffer.from("fff4fffd06", "hex"));
            await client.waitFor((_text, hex) => hex.includes("fffc06"));
            const [sent] = await waitForSend(win, "debugCommand");
            expect(sent.args[0]).toBe("break");
        });

        it("refuses character-at-a-time mode", async () => {
            const client = await connect();
            client.clear();
            client.write(Buffer.from("fffd03fffd01", "hex"));
            await client.waitFor((_text, hex) => hex.includes("fffc03fffc01"));
        });

        it("refuses a logout request", async () => {
            const client = await connect();
            client.clear();
            client.write(Buffer.from("fffd12", "hex"));
            await client.waitFor((_text, hex) => hex.includes("fffc12"));
        });

        it("stays connected and silent for an unrecognised command", async () => {
            const client = await connect();
            client.clear();
            client.write(Buffer.from("fffd05", "hex"));
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(client.hex()).toBe("");
            expect(client.closed).toBe(false);
        });

        it("treats Ctrl+C as a break", async () => {
            const client = await connect();
            client.write(Buffer.from("03", "hex"));
            const [sent] = await waitForSend(win, "debugCommand");
            expect(sent.args[0]).toBe("break");
        });
    });

    describe("command handling", () => {
        it("buffers a command split across packets", async () => {
            // TCP gives no message framing, so the server accumulates until CR or LF.
            const client = await connect();
            client.write("pri");
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(win.sentOn("debugCommand")).toHaveLength(0);

            client.write("nt x\r\n");
            const [sent] = await waitForSend(win, "debugCommand");
            expect(sent.args[0]).toBe("print x");
        });

        it("forwards an ordinary MicroDebugger command", async () => {
            const client = await connect();
            client.write("bt\r\n");
            const [sent] = await waitForSend(win, "debugCommand");
            expect(sent.args[0]).toBe("bt");
        });

        it("says goodbye and disconnects on close", async () => {
            const client = await connect();
            client.clear();
            client.write("close\r\n");
            await client.waitForText("bye!");
            await client.waitForClose();
        });

        it("stops the running app on quit", async () => {
            const client = await connect();
            client.write("quit\r\n");
            const [sent] = await waitForSend(win, "closeChannel");
            expect(sent.args[0]).toBe("EXIT_BRIGHTSCRIPT_STOP");
        });
    });
});
