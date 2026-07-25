/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    defineBrightScriptLanguage,
    defineBrightScriptTheme,
} from "../../../src/app/brightscript";

/**
 * Minimal stand-in for the Monaco namespace: just the surface these two functions touch.
 * Bundling real Monaco into a Node test would pull in the whole editor for no benefit.
 * @returns {object} - The stub
 */
function createStubMonaco() {
    return {
        languages: {
            register: vi.fn(),
            setMonarchTokensProvider: vi.fn(),
            setLanguageConfiguration: vi.fn(),
            IndentAction: { None: 0, Indent: 1, IndentOutdent: 2, Outdent: 3 },
        },
        editor: {
            defineTheme: vi.fn(),
        },
    };
}

describe("defineBrightScriptLanguage", () => {
    let monaco;

    beforeEach(() => {
        monaco = createStubMonaco();
        defineBrightScriptLanguage(monaco);
    });

    it("registers the brightscript language", () => {
        expect(monaco.languages.register).toHaveBeenCalledWith({ id: "brightscript" });
    });

    it("installs a case-insensitive Monarch tokenizer", () => {
        const [languageId, provider] = monaco.languages.setMonarchTokensProvider.mock.calls[0];
        expect(languageId).toBe("brightscript");
        // BrightScript is case insensitive; without this flag "PRINT" would not highlight.
        expect(provider.ignoreCase).toBe(true);
        expect(provider.tokenizer.root).toBeDefined();
    });

    it("declares the BrightScript keywords and types", () => {
        const [, provider] = monaco.languages.setMonarchTokensProvider.mock.calls[0];
        expect(provider.keywords).toEqual(expect.arrayContaining(["sub", "function", "if", "then", "endsub"]));
        expect(provider.typeKeywords).toEqual(expect.arrayContaining(["integer", "string", "object", "dynamic"]));
        // BrightScript uses \ for integer division and & for concatenation.
        expect(provider.operators).toEqual(expect.arrayContaining(["\\", "&", "<>"]));
    });

    it("configures brackets, folding markers and indentation", () => {
        const [languageId, config] = monaco.languages.setLanguageConfiguration.mock.calls[0];
        expect(languageId).toBe("brightscript");
        expect(config.brackets).toBeDefined();
        expect(config.folding.markers.start).toBeInstanceOf(RegExp);
        expect(config.indentationRules.increaseIndentPattern).toBeInstanceOf(RegExp);
    });
});

describe("indentation rules", () => {
    let increase;
    let decrease;

    beforeEach(() => {
        const monaco = createStubMonaco();
        defineBrightScriptLanguage(monaco);
        const [, config] = monaco.languages.setLanguageConfiguration.mock.calls[0];
        increase = config.indentationRules.increaseIndentPattern;
        decrease = config.indentationRules.decreaseIndentPattern;
    });

    it("increases indent after block openers", () => {
        expect(increase.test("sub main()")).toBe(true);
        expect(increase.test("function getValue() as integer")).toBe(true);
        expect(increase.test("    for i = 0 to 10")).toBe(true);
        expect(increase.test("while running")).toBe(true);
        expect(increase.test("try")).toBe(true);
        expect(increase.test("else")).toBe(true);
    });

    it("increases indent for a multi-line if but not a single-line one", () => {
        expect(increase.test("if x = 1")).toBe(true);
        // A trailing `then` means the body is on the same line, so the next line
        // should not be indented.
        expect(increase.test("if x = 1 then print x")).toBe(false);
    });

    it("decreases indent on block closers, both spellings", () => {
        for (const line of ["end sub", "end function", "end if", "end for", "end while", "end try"]) {
            expect(decrease.test(line)).toBe(true);
        }
        for (const line of ["endsub", "endfunction", "endif", "endfor", "endwhile", "endtry"]) {
            expect(decrease.test(line)).toBe(true);
        }
    });

    it("decreases indent on else, elseif and catch", () => {
        expect(decrease.test("else")).toBe(true);
        expect(decrease.test("elseif x = 2")).toBe(true);
        expect(decrease.test("    catch e")).toBe(true);
    });

    it("is case insensitive, as BrightScript is", () => {
        expect(increase.test("SUB Main()")).toBe(true);
        expect(decrease.test("End Sub")).toBe(true);
        expect(decrease.test("ENDIF")).toBe(true);
    });

    it("ignores ordinary statements", () => {
        expect(increase.test("print \"hello\"")).toBe(false);
        expect(increase.test("x = 1")).toBe(false);
        expect(decrease.test("print \"hello\"")).toBe(false);
        // "subtotal" starts with "sub" but is an identifier, not a declaration.
        expect(increase.test("subtotal = 1")).toBe(false);
    });
});

describe("folding markers", () => {
    let start;
    let end;

    beforeEach(() => {
        const monaco = createStubMonaco();
        defineBrightScriptLanguage(monaco);
        const [, config] = monaco.languages.setLanguageConfiguration.mock.calls[0];
        ({ start, end } = config.folding.markers);
    });

    it("matches region comments in both comment styles", () => {
        expect(start.test("' #region helpers")).toBe(true);
        expect(start.test("rem #region helpers")).toBe(true);
        expect(start.test("    ' #region")).toBe(true);
        expect(end.test("' #endregion")).toBe(true);
        expect(end.test("REM #endregion")).toBe(true);
    });

    it("does not match region words outside comments", () => {
        expect(start.test("region = 1")).toBe(false);
        expect(start.test("print \"#region\"")).toBe(false);
    });
});

describe("defineBrightScriptTheme", () => {
    let monaco;

    beforeEach(() => {
        monaco = createStubMonaco();
    });

    it.each([
        ["dark", "brightscript-dark", "vs-dark"],
        ["purple", "brightscript-purple", "vs-dark"],
        ["light", "brightscript-light", "vs"],
    ])("maps the %s app theme to %s", (theme, expectedName, expectedBase) => {
        expect(defineBrightScriptTheme(monaco, theme)).toBe(expectedName);
        const [name, definition] = monaco.editor.defineTheme.mock.calls[0];
        expect(name).toBe(expectedName);
        expect(definition.base).toBe(expectedBase);
        expect(definition.inherit).toBe(true);
        expect(definition.rules.length).toBeGreaterThan(0);
    });

    it("falls back to the light theme for an unknown theme name", () => {
        expect(defineBrightScriptTheme(monaco, "solarized")).toBe("brightscript-light");
        expect(defineBrightScriptTheme(monaco, undefined)).toBe("brightscript-light");
    });

    it("only the purple theme overrides editor background colors", () => {
        defineBrightScriptTheme(monaco, "purple");
        const [, purple] = monaco.editor.defineTheme.mock.calls[0];
        expect(purple.colors["editor.background"]).toBe("#2d1b3d");

        monaco.editor.defineTheme.mockClear();
        defineBrightScriptTheme(monaco, "dark");
        const [, dark] = monaco.editor.defineTheme.mock.calls[0];
        expect(dark.colors).toEqual({});
    });

    it("gives every rule a token and a foreground color", () => {
        defineBrightScriptTheme(monaco, "dark");
        const [, definition] = monaco.editor.defineTheme.mock.calls[0];
        for (const rule of definition.rules) {
            expect(rule.token).toBeTruthy();
            expect(rule.foreground).toMatch(/^[0-9A-Fa-f]{6}$/);
        }
    });

    it("defines the same token set in light and dark", () => {
        defineBrightScriptTheme(monaco, "dark");
        const darkTokens = monaco.editor.defineTheme.mock.calls[0][1].rules.map((rule) => rule.token);
        monaco.editor.defineTheme.mockClear();
        defineBrightScriptTheme(monaco, "light");
        const lightTokens = monaco.editor.defineTheme.mock.calls[0][1].rules.map((rule) => rule.token);
        expect(lightTokens).toEqual(darkTokens);
    });
});
