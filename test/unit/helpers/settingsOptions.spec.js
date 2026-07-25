/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import * as options from "../../../src/helpers/settingsOptions";

const builders = Object.entries(options).filter(([name]) => name.startsWith("get"));

describe("preference option arrays", () => {
    it("exports all nine builders", () => {
        expect(builders.map(([name]) => name).sort()).toEqual([
            "getBackgroundOpacityArray",
            "getCaptionColorArray",
            "getCountryArray",
            "getLocaleIdArray",
            "getTextEffectArray",
            "getTextFontArray",
            "getTextOpacityArray",
            "getTracksLanguageArray",
            "getTextSizeArray",
        ].sort());
    });

    it.each(builders)("%s matches its snapshot", (_name, build) => {
        expect(build()).toMatchSnapshot();
    });

    it.each(builders)("%s yields well-formed {label, value} entries", (_name, build) => {
        const entries = build();
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(Object.keys(entry).sort()).toEqual(["label", "value"]);
            expect(typeof entry.label).toBe("string");
            expect(typeof entry.value).toBe("string");
            expect(entry.label).not.toBe("");
            expect(entry.value).not.toBe("");
        }
    });

    // A duplicate value renders a duplicate row in the dropdown and makes the selected
    // entry ambiguous. This invariant is what caught the repeated "Small" caption size.
    it.each(builders)("%s has no duplicate values", (_name, build) => {
        const values = build().map((entry) => entry.value);
        expect(new Set(values).size).toBe(values.length);
    });

    it.each(builders)("%s has no duplicate labels", (_name, build) => {
        const labels = build().map((entry) => entry.label);
        expect(new Set(labels).size).toBe(labels.length);
    });
});

describe("specific option lists", () => {
    it("offers the locales the simulator supports", () => {
        const values = options.getLocaleIdArray().map((entry) => entry.value);
        expect(values).toContain("en_US");
        // Roku locale ids are language_COUNTRY with an underscore, not a hyphen.
        for (const value of values) {
            expect(value).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
        }
    });

    it("offers the Roku caption sizes", () => {
        const values = options.getTextSizeArray().map((entry) => entry.value);
        expect(values).toEqual(["default", "extra large", "large", "medium", "small", "extra small"]);
    });

    it("leads every list with a default entry where Roku does", () => {
        for (const build of [
            options.getTextFontArray,
            options.getTextEffectArray,
            options.getTextSizeArray,
            options.getCaptionColorArray,
            options.getTextOpacityArray,
            options.getBackgroundOpacityArray,
        ]) {
            expect(build()[0].value).toBe("default");
        }
    });

    it("uses ISO 3166 alpha-2 country codes", () => {
        for (const entry of options.getCountryArray()) {
            expect(entry.value).toMatch(/^[A-Z]{2}$/);
        }
    });
});
