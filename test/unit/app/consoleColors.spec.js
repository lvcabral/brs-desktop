/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { getBrsConsolePatterns } from "../../../src/app/consoleColors";

// Distinct per-key colors so a test can assert exactly which rule matched.
const FAKE_THEME = {
    string: "#string",
    path: "#path",
    component: "#component",
    info: "#info",
    structure: "#structure",
    error: "#error",
    warning: "#warning",
    hex: "#hex",
    debug: "#debug",
    null: "#null",
    boolean: "#boolean",
    number: "#number",
    timestamp: "#timestamp",
    tag: "#tag",
    boolTrue: "#boolTrue",
    invalid: "#invalid",
    comment: "#comment",
    debugLabel: "#debugLabel",
};
const COLOR_THEMES = { light: FAKE_THEME, dark: FAKE_THEME };

// Mirrors @lvcabral/terminal's contextualColorize() overlap resolution (sort by start index,
// then by priority descending; keep a match only if it doesn't overlap one already kept), so
// these tests reflect what actually renders rather than raw, unresolved pattern matches.
function colorFor(line) {
    const patterns = getBrsConsolePatterns("light", COLOR_THEMES);
    const matches = [];
    for (const pattern of patterns) {
        const flags = pattern.regex.flags.includes("g") ? pattern.regex.flags : pattern.regex.flags + "g";
        const regex = new RegExp(pattern.regex.source, flags);
        let match;
        while ((match = regex.exec(line)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
                color: pattern.color,
                priority: pattern.priority,
            });
            if (match[0].length === 0) regex.lastIndex += 1;
        }
    }
    matches.sort((a, b) => (a.start === b.start ? b.priority - a.priority : a.start - b.start));
    const resolved = [];
    let lastEnd = 0;
    for (const match of matches) {
        if (match.start >= lastEnd) {
            resolved.push(match);
            lastEnd = match.end;
        }
    }
    return resolved;
}

describe("getBrsConsolePatterns", () => {
    it("falls back to the light theme when the requested theme is missing", () => {
        const patterns = getBrsConsolePatterns("nonexistent", COLOR_THEMES);
        expect(patterns.find((p) => p.type === "string").color).toBe("#string");
    });

    it("colors a component with a namespaced name (roSGNode:ContentNode)", () => {
        const matches = colorFor("&lt;Component:&nbsp;roSGNode:ContentNode&gt;&nbsp;=");
        const hit = matches.find((m) => m.color === "#component");
        expect(hit).toBeDefined();
        expect(hit.text).toBe("&lt;Component:&nbsp;roSGNode:ContentNode&gt;");
    });

    it("still colors a plain component name (roAssociativeArray)", () => {
        const matches = colorFor("&lt;Component:&nbsp;roAssociativeArray&gt;");
        const hit = matches.find((m) => m.color === "#component");
        expect(hit).toBeDefined();
        expect(hit.text).toBe("&lt;Component:&nbsp;roAssociativeArray&gt;");
    });

    it("colors single-quoted text", () => {
        const matches = colorFor("id&nbsp;'1748651461'");
        const hit = matches.find((m) => m.color === "#string");
        expect(hit).toBeDefined();
        expect(hit.text).toBe("'1748651461'");
    });

    it("colors a bracketed log tag", () => {
        const matches = colorFor("[scrpt.ctx.run.enter]&nbsp;UI:&nbsp;Entering");
        const hit = matches.find((m) => m.color === "#tag" && m.text === "[scrpt.ctx.run.enter]");
        expect(hit).toBeDefined();
    });

    it("colors the date/time prefix on a structured log line", () => {
        const line = "08-21&nbsp;17:58:34.711&nbsp;[scrpt.ctx.run.enter]";
        const matches = colorFor(line);
        const hit = matches.find((m) => m.color === "#timestamp");
        expect(hit).toBeDefined();
        expect(hit.text).toBe("08-21&nbsp;17:58:34.711");
        expect(hit.start).toBe(0);
    });

    it("colors a parenthesized version number", () => {
        const matches = colorFor("brs-scenegraph&nbsp;(v0.5.1)&nbsp;from");
        const hit = matches.find((m) => m.color === "#number" && m.text === "(v0.5.1)");
        expect(hit).toBeDefined();
    });

    it("full structured log line: timestamp, bracket tag and single-quoted text all color", () => {
        const line =
            "08-21&nbsp;17:58:34.711&nbsp;[scrpt.ctx.run.enter]&nbsp;UI:&nbsp;Entering&nbsp;'BrightScript&nbsp;file:&nbsp;editor_code.brs',&nbsp;id&nbsp;'1748651461'";
        const matches = colorFor(line);
        expect(matches.some((m) => m.color === "#timestamp")).toBe(true);
        expect(matches.some((m) => m.color === "#tag" && m.text === "[scrpt.ctx.run.enter]")).toBe(true);
        expect(matches.some((m) => m.color === "#string" && m.text.includes("editor_code.brs"))).toBe(true);
        expect(matches.some((m) => m.color === "#string" && m.text === "'1748651461'")).toBe(true);
    });

    it("colors true and false with distinct colors", () => {
        const matches = colorFor("focusable:&nbsp;false,&nbsp;forwardDashQueryStringParams:&nbsp;true");
        expect(matches.find((m) => m.text === "true").color).toBe("#boolTrue");
        expect(matches.find((m) => m.text === "false").color).toBe("#boolean");
    });

    it("colors invalid as its own (purple) color, not null/boolean", () => {
        const matches = colorFor("focusedChild:&nbsp;&lt;Component:&nbsp;roInvalid&gt;&nbsp;invalid");
        const hit = matches.find((m) => m.text === "invalid" && m.color === "#invalid");
        expect(hit).toBeDefined();
    });

    it("colors the function name in a backtrace frame signature", () => {
        const line = "#3&nbsp;&nbsp;Function&nbsp;main()&nbsp;As&nbsp;Void";
        const matches = colorFor(line);
        expect(matches.some((m) => m.color === "#structure" && m.text === "#3&nbsp;&nbsp;Function")).toBe(true);
        expect(matches.some((m) => m.color === "#info" && m.text === "main")).toBe(true);
    });

    it("colors a plain function call name", () => {
        const matches = colorFor("result&nbsp;=&nbsp;second()");
        const hit = matches.find((m) => m.color === "#info" && m.text === "second");
        expect(hit).toBeDefined();
    });

    it("colors a dotted method call name (object.Method())", () => {
        const matches = colorFor("GridView.RebuildRowList()&nbsp;failed");
        const hit = matches.find((m) => m.color === "#info" && m.text === "GridView.RebuildRowList");
        expect(hit).toBeDefined();
    });

    it("colors a call name but leaves its arguments individually colorable", () => {
        const matches = colorFor('createObject("roPath",1)');
        const callHit = matches.find((m) => m.color === "#info" && m.text === "createObject");
        expect(callHit).toBeDefined();
        const stringHit = matches.find((m) => m.color === "#string" && m.text === '"roPath"');
        expect(stringHit).toBeDefined();
        const numberHit = matches.find((m) => m.color === "#number" && m.text === "1");
        expect(numberHit).toBeDefined();
    });

    it("does not treat a pkg: location's filename as a call name", () => {
        const matches = colorFor("pkg:/source/editor_code.brs(3)");
        expect(matches.some((m) => m.color === "#info")).toBe(false);
        expect(matches.find((m) => m.color === "#path").text).toBe("pkg:/source/editor_code.brs(3)");
    });

    it("colors a source-listing comment line green, without recoloring a non-comment listing line", () => {
        const commentLine = "005:&nbsp;&nbsp;&nbsp;&nbsp;'&nbsp;a&nbsp;comment";
        const commentMatches = colorFor(commentLine);
        const commentHit = commentMatches.find((m) => m.color === "#comment");
        expect(commentHit).toBeDefined();
        expect(commentHit.start).toBe(0);

        const codeLine = "006:&nbsp;&nbsp;&nbsp;&nbsp;x&nbsp;=&nbsp;5";
        const codeMatches = colorFor(codeLine);
        expect(codeMatches.some((m) => m.color === "#comment")).toBe(false);
        expect(codeMatches.some((m) => m.color === "#structure" && m.text === "006:&nbsp;")).toBe(true);
    });

    it("does not treat a mid-line quoted-string apostrophe as a comment", () => {
        const matches = colorFor("id&nbsp;'1748651461'");
        expect(matches.some((m) => m.color === "#comment")).toBe(false);
    });

    it("colors an ISO 8601 date with milliseconds", () => {
        const matches = colorFor("timestamp:&nbsp;2026-08-21T22:21:12.058Z&nbsp;done");
        const hit = matches.find((m) => m.color === "#timestamp" && m.text === "2026-08-21T22:21:12.058Z");
        expect(hit).toBeDefined();
    });

    it("colors an ISO 8601 date without milliseconds", () => {
        const matches = colorFor("timestamp:&nbsp;2026-08-21T22:21:12&nbsp;done");
        const hit = matches.find((m) => m.color === "#timestamp" && m.text === "2026-08-21T22:21:12");
        expect(hit).toBeDefined();
    });

    it("colors an XML open tag with an attribute (blue, like a component), and its matching close tag", () => {
        const line = '&lt;Config&nbsp;version="2"&gt;value&lt;/Config&gt;';
        const matches = colorFor(line);
        expect(
            matches.some((m) => m.color === "#component" && m.text === '&lt;Config&nbsp;version="2"&gt;')
        ).toBe(true);
        expect(matches.some((m) => m.color === "#component" && m.text === "&lt;/Config&gt;")).toBe(true);
    });

    it("colors a self-closing XML tag", () => {
        const matches = colorFor("&lt;Node/&gt;");
        const hit = matches.find((m) => m.color === "#component" && m.text === "&lt;Node/&gt;");
        expect(hit).toBeDefined();
    });

    it("still colors <Component: ...> as a component, not a generic XML tag", () => {
        const matches = colorFor("&lt;Component:&nbsp;roArray&gt;");
        const hit = matches.find((m) => m.text === "&lt;Component:&nbsp;roArray&gt;");
        expect(hit.color).toBe("#component");
    });

    it("colors a line-leading ERROR:/WARNING:/DEBUG: label", () => {
        expect(colorFor("ERROR:&nbsp;something&nbsp;broke").find((m) => m.text === "ERROR:").color).toBe("#error");
        expect(colorFor("WARNING:&nbsp;take&nbsp;care").find((m) => m.text === "WARNING:").color).toBe("#warning");
        expect(colorFor("DEBUG:&nbsp;trace&nbsp;info").find((m) => m.text === "DEBUG:").color).toBe("#debugLabel");
    });

    it("does not double-match a bare label rule against a BRIGHTSCRIPT: ERROR: line", () => {
        const matches = colorFor("BRIGHTSCRIPT:&nbsp;ERROR:&nbsp;bad&nbsp;thing");
        expect(matches.filter((m) => m.color === "#error").length).toBe(1);
        expect(matches.find((m) => m.color === "#error").text).toBe("BRIGHTSCRIPT:&nbsp;ERROR:");
    });

    it("colors a full GUID/UUID, not just the segment before the first dash", () => {
        const matches = colorFor("id:&nbsp;3F2504E0-4F89-41D3-9A0C-0305E82C3301&nbsp;done");
        const hit = matches.find((m) => m.color === "#hex" && m.text === "3F2504E0-4F89-41D3-9A0C-0305E82C3301");
        expect(hit).toBeDefined();
    });

    it("colors a pkg:/ resource path with no trailing line-number suffix", () => {
        const matches = colorFor("Loaded&nbsp;icon&nbsp;pkg:/images/logo.png&nbsp;ok");
        const hit = matches.find((m) => m.color === "#path" && m.text === "pkg:/images/logo.png");
        expect(hit).toBeDefined();
    });

    it("colors tmp:/ and other Roku device URI schemes", () => {
        expect(colorFor("saved&nbsp;to&nbsp;tmp:/cache/file.tmp").find((m) => m.color === "#path").text).toBe(
            "tmp:/cache/file.tmp"
        );
        expect(colorFor("reading&nbsp;from&nbsp;common:/certs/ca.pem").find((m) => m.color === "#path").text).toBe(
            "common:/certs/ca.pem"
        );
    });

    it("colors a plain http(s) URL", () => {
        const matches = colorFor("from&nbsp;https://example.com/lib/brs-sg.js&nbsp;loaded");
        const hit = matches.find((m) => m.color === "#path" && m.text === "https://example.com/lib/brs-sg.js");
        expect(hit).toBeDefined();
    });

    it("colors an http(s) URL with a query string, without swallowing trailing text", () => {
        const matches = colorFor("see&nbsp;https://example.com/x?a=1&b=2&nbsp;for&nbsp;details");
        const hit = matches.find((m) => m.color === "#path" && m.text === "https://example.com/x?a=1&b=2");
        expect(hit).toBeDefined();
    });
});
