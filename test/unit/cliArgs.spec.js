/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import minimist from "minimist";
import { cliArgumentsConfig } from "../../src/cliArgs";

/**
 * Parse an argument list the way main.js does
 * @param {...string} args - The arguments, without the leading executable path
 * @returns {object} - The minimist result
 */
function parse(...args) {
    return minimist(args, cliArgumentsConfig);
}

describe("CLI aliases", () => {
    it.each([
        ["b", "debug"],
        ["c", "console"],
        ["d", "devtools"],
        ["e", "ecp"],
        ["f", "fullscreen"],
        ["w", "web"],
        ["p", "pwd"],
        ["m", "mode"],
        ["r", "rc"],
    ])("aliases -%s to --%s", (short, long) => {
        expect(cliArgumentsConfig.alias[short]).toBe(long);
    });

    it("keeps the short and long forms in sync when parsing", () => {
        expect(parse("-d").devtools).toBe(true);
        expect(parse("--devtools").d).toBe(true);
        expect(parse("-m", "hd").mode).toBe("hd");
        expect(parse("--mode", "hd").m).toBe("hd");
    });
});

describe("boolean flags", () => {
    it.each(["console", "debug", "devtools", "ecp", "fullscreen", "rc"])("parses --%s as a boolean", (flag) => {
        expect(parse(`--${flag}`)[flag]).toBe(true);
    });

    it("defaults every boolean flag to false", () => {
        const parsed = parse();
        for (const flag of ["console", "debug", "devtools", "ecp", "fullscreen", "rc"]) {
            expect(parsed[flag]).toBe(false);
        }
    });

    it("does not swallow the next argument after a boolean flag", () => {
        // Declaring these as booleans is what keeps `-d file.zip` from parsing as -d="file.zip".
        const parsed = parse("-d", "/tmp/channel.zip");
        expect(parsed.devtools).toBe(true);
        expect(parsed._).toEqual(["/tmp/channel.zip"]);
    });
});

describe("string options", () => {
    it("keeps a numeric password as a string", () => {
        // Without the `string` declaration this would become the number 1234 and the
        // digest auth comparison against the stored credential would fail.
        const parsed = parse("-p", "1234");
        expect(parsed.pwd).toBe("1234");
        expect(typeof parsed.pwd).toBe("string");
    });

    it.each(["sd", "hd", "fhd"])("parses the %s display mode", (mode) => {
        expect(parse("-m", mode).mode).toBe(mode);
    });

    it("parses the -o package path", () => {
        expect(parse("-o", "/tmp/channel.zip").o).toBe("/tmp/channel.zip");
    });

    it("keeps the web port a string, like the other value-taking options", () => {
        // Declared as a string so a bare -w yields "" rather than boolean true, which
        // would otherwise be persisted to services.webPort as NaN.
        expect(parse("-w", "8080").web).toBe("8080");
        expect(typeof parse("-w", "8080").web).toBe("string");
        expect(parse("-w").web).toBe("");
    });
});

describe("positional arguments", () => {
    it("collects a bare file path", () => {
        expect(parse("/tmp/channel.zip")._).toEqual(["/tmp/channel.zip"]);
    });

    it("separates positionals from flags in any order", () => {
        const parsed = parse("--ecp", "/tmp/channel.zip", "-m", "fhd");
        expect(parsed.ecp).toBe(true);
        expect(parsed.mode).toBe("fhd");
        expect(parsed._).toEqual(["/tmp/channel.zip"]);
    });

    it("handles a combined invocation end to end", () => {
        const parsed = parse("--devtools", "--console", "-m", "hd", "-p", "secret", "/tmp/app.zip");
        expect(parsed).toMatchObject({
            devtools: true,
            console: true,
            mode: "hd",
            pwd: "secret",
            _: ["/tmp/app.zip"],
        });
    });
});
