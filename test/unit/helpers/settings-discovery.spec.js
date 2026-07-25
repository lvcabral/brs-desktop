/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { updateDeviceMetadata, getRokuDeviceOptions, getTitleOverlayTheme } from "../../../src/helpers/settings";

/**
 * The number of discovered devices currently listed, excluding the "Manual Entry" row
 * @returns {number} - The device count
 */
function deviceCount() {
    return getRokuDeviceOptions().length - 1;
}

/**
 * Find the option for a given IP
 * @param {string} ip - The device address
 * @returns {object|undefined} - The matching option
 */
function optionFor(ip) {
    return getRokuDeviceOptions().find((option) => option.value === ip);
}

describe("updateDeviceMetadata", () => {
    it("records a newly discovered device", () => {
        const before = deviceCount();
        updateDeviceMetadata(
            "192.168.1.10",
            { ip: "192.168.1.10" },
            {
                ipAddr: "192.168.1.10",
                friendlyName: "Living Room",
                modelName: "Roku Ultra",
                modelNumber: "4800X",
            }
        );
        expect(deviceCount()).toBe(before + 1);
        expect(optionFor("192.168.1.10").label).toContain("Living Room");
    });

    it("normalises an IPv4-mapped IPv6 address to one entry", () => {
        const before = deviceCount();
        updateDeviceMetadata(
            "192.168.1.11",
            { ip: "192.168.1.11" },
            {
                ipAddr: "::ffff:192.168.1.11",
                friendlyName: "Bedroom",
                modelName: "Roku Express",
            }
        );
        expect(deviceCount()).toBe(before + 1);
        expect(optionFor("192.168.1.11")).toBeDefined();
    });

    it("does not let blank details clobber what is already known", () => {
        updateDeviceMetadata(
            "192.168.1.12",
            { ip: "192.168.1.12" },
            {
                ipAddr: "192.168.1.12",
                friendlyName: "Kitchen",
                modelName: "Roku Streaming Stick",
                modelNumber: "3810X",
            }
        );
        // A second SSDP response with no body must not erase the first one's details.
        updateDeviceMetadata(
            "192.168.1.12",
            { ip: "192.168.1.12" },
            {
                ipAddr: "192.168.1.12",
                friendlyName: "   ",
                modelName: "",
            }
        );
        const label = optionFor("192.168.1.12").label;
        expect(label).toContain("Kitchen");
        expect(label).toContain("3810X");
    });

    it("lets newer details win over older ones", () => {
        updateDeviceMetadata(
            "192.168.1.13",
            { ip: "192.168.1.13" },
            {
                ipAddr: "192.168.1.13",
                friendlyName: "Old Name",
            }
        );
        updateDeviceMetadata(
            "192.168.1.13",
            { ip: "192.168.1.13" },
            {
                ipAddr: "192.168.1.13",
                friendlyName: "New Name",
            }
        );
        expect(optionFor("192.168.1.13").label).toContain("New Name");
        expect(optionFor("192.168.1.13").label).not.toContain("Old Name");
    });

    it("does not create a duplicate entry for a device seen twice", () => {
        updateDeviceMetadata("192.168.1.14", { ip: "192.168.1.14" }, { ipAddr: "192.168.1.14", modelName: "Roku" });
        const after = deviceCount();
        updateDeviceMetadata("192.168.1.14", { ip: "192.168.1.14" }, { ipAddr: "192.168.1.14", modelName: "Roku" });
        expect(deviceCount()).toBe(after);
    });

    it("tolerates a response with no details at all", () => {
        expect(() => updateDeviceMetadata("192.168.1.15", { ip: "192.168.1.15" }, undefined)).not.toThrow();
        expect(optionFor("192.168.1.15")).toBeDefined();
    });
});

describe("getRokuDeviceOptions", () => {
    it("always offers manual entry first", () => {
        // The peer-Roku IP field falls back to a hand-typed address when discovery
        // finds nothing, so this row must never disappear.
        expect(getRokuDeviceOptions()[0]).toEqual({ label: "Manual Entry", value: "manual" });
    });

    it("builds a label from name, model, OS and serial", () => {
        updateDeviceMetadata(
            "10.0.0.2",
            {
                ip: "10.0.0.2",
                firmware: "12.5.0",
                serialNumber: "X00500ABCDEF",
            },
            {
                ipAddr: "10.0.0.2",
                friendlyName: "Den Roku",
                modelNumber: "4800X",
            }
        );
        expect(optionFor("10.0.0.2").label).toBe("Den Roku · 4800X · OS 12.5.0 · X00500ABCDEF (10.0.0.2)");
    });

    it("omits detail segments that are unknown", () => {
        updateDeviceMetadata(
            "10.0.0.3",
            { ip: "10.0.0.3" },
            {
                ipAddr: "10.0.0.3",
                friendlyName: "Bare Roku",
            }
        );
        expect(optionFor("10.0.0.3").label).toBe("Bare Roku (10.0.0.3)");
    });

    it("falls back from friendly name to model name", () => {
        updateDeviceMetadata(
            "10.0.0.4",
            { ip: "10.0.0.4" },
            {
                ipAddr: "10.0.0.4",
                modelName: "Roku Premiere",
            }
        );
        expect(optionFor("10.0.0.4").label).toContain("Roku Premiere");
    });

    it("falls back to a generic name when nothing is known", () => {
        updateDeviceMetadata("10.0.0.5", { ip: "10.0.0.5" }, { ipAddr: "10.0.0.5" });
        expect(optionFor("10.0.0.5").label).toBe("Roku Device (10.0.0.5)");
    });
});

describe("getTitleOverlayTheme", () => {
    it.each([
        ["purple", "#3d1b56", "#dac7ea"],
        ["dark", "#252526", "#cccccc"],
        ["light", "#dddddd", "#333333"],
    ])("styles the %s title bar", (theme, color, symbolColor) => {
        expect(getTitleOverlayTheme(theme)).toEqual({ color, symbolColor, height: 28 });
    });

    it("falls back to the light overlay for an unknown theme", () => {
        expect(getTitleOverlayTheme("system")).toEqual(getTitleOverlayTheme("light"));
        expect(getTitleOverlayTheme(undefined)).toEqual(getTitleOverlayTheme("light"));
    });

    it("keeps the title bar height constant across themes", () => {
        for (const theme of ["purple", "dark", "light", "system"]) {
            expect(getTitleOverlayTheme(theme).height).toBe(28);
        }
    });
});
