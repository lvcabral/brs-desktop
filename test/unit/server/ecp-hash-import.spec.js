/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Regression guard for a latent import-order bug.
 *
 * `genAppRegistry()` in src/server/ecp.js calls `.hashCode()` on a string, but ecp.js used
 * not to import src/helpers/hash. It worked only because src/menu/menuService.js imports
 * hash for its own use and happened to load first. Any reordering of the import graph —
 * or loading ecp.js on its own, as a test does — turned GET /query/registry/:appID into a 500.
 */
describe("ecp.js prototype dependencies", () => {
    let original;

    beforeEach(() => {
        original = Object.getOwnPropertyDescriptor(String.prototype, "hashCode");
        delete String.prototype.hashCode;
        vi.resetModules();
    });

    afterEach(() => {
        if (original) {
            Object.defineProperty(String.prototype, "hashCode", original);
        }
        vi.resetModules();
    });

    it("installs String.prototype.hashCode by importing it directly", async () => {
        expect("dev.zip".hashCode).toBeUndefined();
        await import("../../../src/server/ecp");
        expect(typeof "dev.zip".hashCode).toBe("function");
    });

    it("does not depend on menuService having been loaded first", async () => {
        // Import ecp.js in isolation, with no other src/ module in the graph.
        const ecp = await import("../../../src/server/ecp");
        expect(ecp.isECPEnabled).toBe(false);
        expect(() => "/tmp/dev.zip".hashCode()).not.toThrow();
    });
});
