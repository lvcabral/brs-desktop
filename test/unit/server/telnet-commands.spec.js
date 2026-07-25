/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeWindow } from "../../mocks/electron.js";
import { sendDebugCommand } from "../../../src/server/telnet";

// processData() is exercised in test/integration/telnet-server.spec.js instead: it reads
// module-private client and line-buffer maps that only a real connection populates.

describe("telnet sendDebugCommand", () => {
    let client;
    let win;

    beforeEach(() => {
        client = { write: vi.fn(), destroy: vi.fn() };
        win = createFakeWindow(1);
    });

    it("says goodbye and closes on close", () => {
        sendDebugCommand("close", client, win);
        expect(client.write).toHaveBeenCalledWith("bye!\r\n");
        expect(client.destroy).toHaveBeenCalled();
    });

    it("stops the running app on quit", () => {
        sendDebugCommand("quit", client, win);
        expect(win.sentOn("closeChannel")).toEqual([
            { channel: "closeChannel", args: ["EXIT_BRIGHTSCRIPT_STOP"] },
        ]);
        // quit leaves the connection open, unlike close.
        expect(client.destroy).not.toHaveBeenCalled();
    });

    it("sends a bare newline for an empty line", () => {
        // Pressing enter at the MicroDebugger prompt steps to the next statement.
        sendDebugCommand("", client, win);
        expect(win.sentOn("debugCommand")).toEqual([
            { channel: "debugCommand", args: ["\n"] },
        ]);
    });

    it("forwards any other command to the engine verbatim", () => {
        // The MicroDebugger command set itself lives in brs-engine, not this repo, so
        // anything unrecognised here is passed straight through.
        for (const command of ["bt", "var", "cont", "step", "print x"]) {
            win.sent.length = 0;
            sendDebugCommand(command, client, win);
            expect(win.sentOn("debugCommand")).toEqual([
                { channel: "debugCommand", args: [command] },
            ]);
        }
    });

    it("preserves arguments containing spaces", () => {
        sendDebugCommand("print m.top.width + 10", client, win);
        expect(win.sentOn("debugCommand")[0].args[0]).toBe("print m.top.width + 10");
    });

    it("trims surrounding whitespace and the line terminator", () => {
        sendDebugCommand("  bt  \r\n", client, win);
        expect(win.sentOn("debugCommand")[0].args[0]).toBe("bt");
    });

    it("matches close and quit case insensitively", () => {
        sendDebugCommand("CLOSE", client, win);
        expect(client.destroy).toHaveBeenCalled();

        const other = { write: vi.fn(), destroy: vi.fn() };
        sendDebugCommand("QUIT", other, win);
        expect(win.sentOn("closeChannel")).toHaveLength(1);
    });
});
