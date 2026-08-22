/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Regex-to-color rules for BrightScript-aware console coloring, consumed by the `@lvcabral/terminal`
// package's `customPatterns`/`useDefaultPatterns: false` option (see src/app/editor.js).
//
// IMPORTANT: by the time these patterns run, updateTerminal() has already HTML-escaped the line
// (`<` -> `&lt;`, `>` -> `&gt;`) and replaced every space with `&nbsp;` — so patterns must match
// those literal entity strings, not raw `<`, `>`, or a space character.
//
// Patterns are deliberately narrow (no greedy `.*`): the terminal package resolves overlapping
// matches by start index first, priority second, so a wide/greedy pattern starting earlier would
// win over a more specific one nested inside it regardless of priority.
export function getBrsConsolePatterns(theme, colorThemes) {
    const c = colorThemes[theme] || colorThemes.light;
    return [
        { regex: /"(?:[^"\\]|\\.)*"/g, color: c.string, type: "string", priority: 100 },
        { regex: /'(?:[^'\\]|\\.)*'/g, color: c.string, type: "string", priority: 100 },
        // Roku device URIs — pkg:/, tmp:/, cachefs:/, ext1:/, common:/, widget:/, complib:/ — with
        // an optional trailing "(line[,col[-col]])" source-location suffix (as seen in error/backtrace
        // text, e.g. "pkg:/source/editor_code.brs(3)"); the suffix is just as often absent for a
        // plain resource path (e.g. "pkg:/images/logo.png").
        {
            regex: /\b(?:pkg|tmp|cachefs|ext1|common|widget|complib):\/[\w./-]+(?:\(\d+(?:,\d+(?:-\d+)?)?\))?/g,
            color: c.path,
            type: "location",
            priority: 90,
        },
        // Web URLs. Stops at an "&nbsp;" (a real space in the original text) via lookahead rather
        // than excluding "&" outright, so a literal "&" inside a query string still colors as part
        // of the URL.
        { regex: /https?:\/\/(?:(?!&nbsp;)[^\s<>"'])+/g, color: c.path, type: "location", priority: 88 },
        // Standard 8-4-4-4-12 GUID/UUID, e.g. "3F2504E0-4F89-41D3-9A0C-0305E82C3301". A dedicated
        // rule because the generic number/hex rules below can't cleanly match a run that mixes
        // digits and letters across dash-separated groups.
        { regex: /\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/g, color: c.hex, type: "hex", priority: 85 },
        // Component names may carry a namespace, e.g. "roSGNode:ContentNode" — [\w:.]+ covers that.
        { regex: /&lt;Component:&nbsp;ro[\w:.]+&gt;/g, color: c.component, type: "component", priority: 85 },
        { regex: /&lt;Function:&nbsp;\w+&gt;/g, color: c.info, type: "function", priority: 85 },
        // Generic XML tags (open/close/self-closing), e.g. `<Config version="2">`, for the (rare)
        // case an app logs raw XML. Lazily matches through the nearest "&gt;", so the whole tag
        // (including any attributes) is one span — same treatment as, and same color as, the
        // Component:/Function: rules above (whose tie at the same start index this rule's lower
        // priority keeps losing).
        { regex: /&lt;\/?[A-Za-z][\w:.-]*.*?&gt;/g, color: c.component, type: "structure", priority: 80 },
        // A backtrace comment line, e.g. "005:&nbsp;&nbsp;&nbsp;&nbsp;'&nbsp;a&nbsp;comment" (the leading
        // "NNN:" prefix, when present, is optional here so the match can also cover any indentation
        // before the apostrophe). Higher priority than the plain "NNN:" structure rule below so a
        // comment line wins the tie at the same start index instead of only the prefix being colored.
        { regex: /^(?:\d{3}:(?:\*|&nbsp;))?(?:&nbsp;)*'.*/, color: c.comment, type: "comment", priority: 82 },
        // Function/method call names, e.g. "second()", "createObject("roPath",1)",
        // "GridView.RebuildRowList()" — matches only the identifier (optionally dotted, for object
        // method calls) immediately followed by "(", via a lookahead that doesn't consume the "("
        // itself. That keeps the match to just the call name: the arguments are left for the
        // string/number/hex rules to color individually instead of being swallowed into one span.
        // Covers backtrace frames too (e.g. "Function main() As Void" colors "main"), so no
        // separate "Function ...(...)" rule is needed.
        { regex: /\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?=\()/g, color: c.info, type: "function", priority: 80 },
        { regex: /^#\d+(?:&nbsp;)+Function\b/, color: c.structure, type: "structure", priority: 80 },
        { regex: /^\d{3}:(?:\*|&nbsp;)/, color: c.structure, type: "structure", priority: 80 },
        { regex: /file\/line:/g, color: c.structure, type: "structure", priority: 70 },
        { regex: /^BackTrace:/, color: c.structure, type: "structure", priority: 70 },
        { regex: /BRIGHTSCRIPT:&nbsp;ERROR:/g, color: c.error, type: "error", priority: 75 },
        { regex: /BRIGHTSCRIPT:&nbsp;WARNING:/g, color: c.warning, type: "warning", priority: 75 },
        // A bare "ERROR:"/"WARNING:"/"DEBUG:" label leading a line (distinct from the
        // "BRIGHTSCRIPT: ERROR:"/"BRIGHTSCRIPT: WARNING:" rules above, which only match that exact
        // compound prefix anywhere in the text — these match apps that print their own log lines
        // prefixed this way).
        { regex: /^ERROR:/, color: c.error, type: "error", priority: 75 },
        { regex: /^WARNING:/, color: c.warning, type: "warning", priority: 75 },
        { regex: /^DEBUG:/, color: c.debugLabel, type: "structure", priority: 75 },
        { regex: /\(&h[0-9A-Fa-f]+\)/g, color: c.hex, type: "hex", priority: 70 },
        { regex: /\(v\d+(?:\.\d+)*\)/g, color: c.number, type: "number", priority: 75 },
        // Timestamp prefix on structured log lines, e.g. "08-21 17:58:34.711 [scrpt.ctx.run.enter] ...".
        { regex: /^\d{2}-\d{2}&nbsp;\d{2}:\d{2}:\d{2}\.\d{3}/, color: c.timestamp, type: "structure", priority: 65 },
        // ISO 8601 dates, with or without milliseconds, "T" or space (already &nbsp;) separated.
        {
            regex: /\b\d{4}-\d{2}-\d{2}(?:T|&nbsp;)\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
            color: c.timestamp,
            type: "structure",
            priority: 65,
        },
        // Bracketed log tags, e.g. "[scrpt.ctx.run.enter]", "[beacon.report]".
        { regex: /\[[\w.]+\]/g, color: c.tag, type: "structure", priority: 60 },
        { regex: /\binvalid\b/g, color: c.invalid, type: "null", priority: 55 },
        { regex: /\btrue\b/g, color: c.boolTrue, type: "boolean", priority: 55 },
        { regex: /\bfalse\b/g, color: c.boolean, type: "boolean", priority: 55 },
        { regex: /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\bnan\b/g, color: c.number, type: "number", priority: 50 },
    ];
}
