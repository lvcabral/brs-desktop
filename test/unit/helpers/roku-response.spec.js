/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { isCompileError } from "../../../src/helpers/roku";

describe("isCompileError", () => {
    it("recognises the Roku installer's compile failure page", () => {
        // A real device answers a POST to /plugin_install with this text in the body when
        // the uploaded package does not compile; the HTTP status is still 200.
        const page = `<html><body><font color="red">Install Failure: Compilation Failed.</font></body></html>`;
        expect(isCompileError(page)).toBe(true);
    });

    it("is case insensitive", () => {
        expect(isCompileError("install failure: compilation failed")).toBe(true);
        expect(isCompileError("INSTALL FAILURE: COMPILATION FAILED")).toBe(true);
    });

    it("accepts any single whitespace character between the words", () => {
        expect(isCompileError("Install\tFailure:\nCompilation Failed")).toBe(true);
    });

    it("tolerates any run of whitespace between the words", () => {
        expect(isCompileError("Install Failure:  Compilation Failed")).toBe(true);
        expect(isCompileError("Install  Failure:\n\n  Compilation\tFailed")).toBe(true);
        // Real pages wrap the text in markup, so the spacing is not under our control.
        expect(isCompileError("<font color=\"red\">Install Failure:\n    Compilation Failed</font>")).toBe(true);
    });

    it("returns false for a successful install", () => {
        expect(isCompileError("<html>Application Received: 4096 bytes stored.</html>")).toBe(false);
        expect(isCompileError("Identical to previous version -- not replacing.")).toBe(false);
    });

    it("returns false for an unrelated failure", () => {
        expect(isCompileError("Install Failure: Package upload failed")).toBe(false);
    });

    it("returns false for empty or missing input", () => {
        expect(isCompileError("")).toBe(false);
        expect(isCompileError(undefined)).toBe(false);
        expect(isCompileError(null)).toBe(false);
    });
});
