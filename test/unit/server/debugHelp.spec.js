/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { HELP_COMMANDS, PRESS_HELP, getHelpText } from "../../../src/server/debugHelp";

describe("HELP_COMMANDS", () => {
    it("matches its snapshot", () => {
        expect(HELP_COMMANDS).toMatchSnapshot();
    });

    it("gives every command a name and a description", () => {
        for (const entry of HELP_COMMANDS) {
            expect(entry.cmd).toBeTruthy();
            expect(entry.desc).toBeTruthy();
            expect(typeof entry.args).toBe("string");
        }
    });

    it("lists commands in alphabetical order", () => {
        // "q" sits after "quit" in the source, matching a real Roku console's listing.
        const names = HELP_COMMANDS.map((entry) => entry.cmd);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names.filter((n) => n !== "q")).toEqual(sorted.filter((n) => n !== "q"));
    });

    it("has no duplicate command names", () => {
        const names = HELP_COMMANDS.map((entry) => entry.cmd);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe("getHelpText with no argument", () => {
    const listing = getHelpText();

    it("matches its snapshot", () => {
        expect(listing).toMatchSnapshot();
    });

    it("ends every line with CRLF, as a telnet client expects", () => {
        expect(listing.endsWith("\r\n")).toBe(true);
        expect(listing.split("\r\n").filter(Boolean)).toHaveLength(HELP_COMMANDS.length);
    });

    it("lists every command", () => {
        for (const entry of HELP_COMMANDS) {
            expect(listing).toContain(entry.desc);
        }
    });

    it("aligns descriptions at column 24", () => {
        for (const line of listing.split("\r\n").filter(Boolean)) {
            const entry = HELP_COMMANDS.find((cmd) => line.startsWith(cmd.cmd));
            const prefix = entry.cmd + (entry.args ? ` ${entry.args}` : "");
            if (prefix.length < 24) {
                expect(line.indexOf(entry.desc)).toBe(24);
            } else {
                // Over-long prefixes fall back to a single separating space rather than
                // wrapping; `target` is the one entry that exercises this.
                expect(line).toBe(`${prefix} ${entry.desc}`);
            }
        }
    });

    it("keeps the over-long target entry readable", () => {
        const target = HELP_COMMANDS.find((entry) => entry.cmd === "target");
        expect(`${target.cmd} ${target.args}`.length).toBeGreaterThanOrEqual(24);
        expect(listing).toContain(`${target.cmd} ${target.args} ${target.desc}`);
    });
});

describe("getHelpText for a single command", () => {
    it("returns just that command's line", () => {
        const help = getHelpText("press");
        expect(help.split("\r\n").filter(Boolean)).toHaveLength(1);
        expect(help).toContain("Simulate a keypress.");
        expect(help.endsWith("\r\n")).toBe(true);
    });

    it("looks commands up case insensitively", () => {
        expect(getHelpText("PRESS")).toBe(getHelpText("press"));
        expect(getHelpText("Genkey")).toBe(getHelpText("genkey"));
    });

    it("reports unknown commands without throwing", () => {
        expect(getHelpText("nonesuch")).toBe("No help found for 'nonesuch'.\r\n");
    });

    it("falls back to the full listing for an empty argument", () => {
        // debug.js passes expr[1], which is undefined for a bare "help".
        expect(getHelpText("")).toBe(getHelpText());
        expect(getHelpText(undefined)).toBe(getHelpText());
    });
});

describe("PRESS_HELP", () => {
    it("matches its snapshot", () => {
        expect(PRESS_HELP).toMatchSnapshot();
    });

    it("documents 24 key rows separated by CRLF", () => {
        expect(PRESS_HELP.split("\r\n")).toHaveLength(24);
    });
});
