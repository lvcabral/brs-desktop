/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import {
    extract,
    extractAny,
    parseDeviceMetadata,
    extractFirmwareFromServer,
    extractSerialNumberFromUSN,
    normalizeIpAddress,
    isRokuDiscoveryResponse,
} from "../../../src/helpers/discovery";

// An abridged /query/device-info response, in the shape a real Roku returns.
const DEVICE_INFO_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<device-info>
    <udn>29380007-0800-1025-80a4-d0abc9dcf65d</udn>
    <serial-number>X00500ABCDEF</serial-number>
    <device-id>S00500ABCDEF</device-id>
    <vendor-name>Roku</vendor-name>
    <model-name>Roku Ultra</model-name>
    <model-number>4800X</model-number>
    <friendly-device-name>Living Room Roku</friendly-device-name>
    <user-device-name>Living Room Roku</user-device-name>
    <software-version>12.5.0</software-version>
</device-info>`;

describe("extract", () => {
    it("returns the first capture group", () => {
        expect(extract(/<model-name>(.*?)<\/model-name>/i, DEVICE_INFO_XML)).toBe("Roku Ultra");
    });

    it("trims surrounding whitespace", () => {
        expect(extract(/<name>(.*?)<\/name>/i, "<name>   padded   </name>")).toBe("padded");
    });

    it("returns an empty string when nothing matches", () => {
        expect(extract(/<nonesuch>(.*?)<\/nonesuch>/i, DEVICE_INFO_XML)).toBe("");
        expect(extract(/<a>(.*?)<\/a>/i, "")).toBe("");
    });

    it("returns an empty string for a pattern with no capture group", () => {
        // The implementation requires exactly one group; anything else is treated as a miss.
        expect(extract(/<model-name>/i, DEVICE_INFO_XML)).toBe("");
    });

    it("returns an empty string for a pattern with several capture groups", () => {
        expect(extract(/<(model)-(name)>/i, DEVICE_INFO_XML)).toBe("");
    });
});

describe("extractAny", () => {
    it("returns the first pattern that matches", () => {
        expect(
            extractAny(
                [/<nope>(.*?)<\/nope>/i, /<model-number>(.*?)<\/model-number>/i],
                DEVICE_INFO_XML
            )
        ).toBe("4800X");
    });

    it("skips patterns that match empty content", () => {
        // An empty tag must not shadow a later pattern that has a real value.
        const xml = "<model-name></model-name><friendly-model-name>Roku Ultra</friendly-model-name>";
        expect(
            extractAny(
                [/<model-name>(.*?)<\/model-name>/i, /<friendly-model-name>(.*?)<\/friendly-model-name>/i],
                xml
            )
        ).toBe("Roku Ultra");
    });

    it("returns an empty string when no pattern matches", () => {
        expect(extractAny([/<a>(.*?)<\/a>/i, /<b>(.*?)<\/b>/i], DEVICE_INFO_XML)).toBe("");
        expect(extractAny([], DEVICE_INFO_XML)).toBe("");
    });
});

describe("extractFirmwareFromServer", () => {
    it("pulls the OS version out of an SSDP Server header", () => {
        const header = "Roku/9.1.0 UPnP/1.0 Roku/12.5.0 (12.5.0.4211-46)";
        expect(extractFirmwareFromServer(header)).toBe("12.5.0");
    });

    it("returns an empty string for a header from something other than a Roku", () => {
        expect(extractFirmwareFromServer("Linux/3.10 UPnP/1.0 MiniUPnPd/1.9")).toBe("");
    });

    it("returns an empty string for missing or empty input", () => {
        expect(extractFirmwareFromServer("")).toBe("");
        expect(extractFirmwareFromServer(undefined)).toBe("");
        expect(extractFirmwareFromServer(null)).toBe("");
    });
});

describe("extractSerialNumberFromUSN", () => {
    it("pulls the serial number out of a USN header", () => {
        expect(extractSerialNumberFromUSN("uuid:roku:ecp:X00500ABCDEF")).toBe("X00500ABCDEF");
    });

    it("stops at the next colon", () => {
        expect(extractSerialNumberFromUSN("uuid:roku:ecp:X005001::urn:roku-com:service:ecp:1")).toBe(
            "X005001"
        );
    });

    it("is case insensitive", () => {
        expect(extractSerialNumberFromUSN("UUID:ROKU:ECP:X00500ABCDEF")).toBe("X00500ABCDEF");
    });

    it("returns an empty string when the header is not a Roku USN", () => {
        expect(extractSerialNumberFromUSN("uuid:1234-5678")).toBe("");
        expect(extractSerialNumberFromUSN("")).toBe("");
        expect(extractSerialNumberFromUSN(undefined)).toBe("");
    });
});

describe("normalizeIpAddress", () => {
    it("strips the IPv4-mapped IPv6 prefix", () => {
        expect(normalizeIpAddress("::ffff:192.168.1.50")).toBe("192.168.1.50");
        expect(normalizeIpAddress("::ffff:127.0.0.1")).toBe("127.0.0.1");
    });

    it("leaves a plain IPv4 address alone", () => {
        expect(normalizeIpAddress("192.168.1.50")).toBe("192.168.1.50");
    });

    it("leaves other IPv6 addresses alone", () => {
        expect(normalizeIpAddress("::1")).toBe("::1");
        expect(normalizeIpAddress("fe80::1")).toBe("fe80::1");
    });

    it("returns an empty string for missing input", () => {
        expect(normalizeIpAddress("")).toBe("");
        expect(normalizeIpAddress(undefined)).toBe("");
        expect(normalizeIpAddress(null)).toBe("");
    });
});

describe("isRokuDiscoveryResponse", () => {
    it("recognises a Roku from the ST header", () => {
        expect(isRokuDiscoveryResponse({ ST: "roku:ecp" })).toBe(true);
        expect(isRokuDiscoveryResponse({ ST: "urn:roku-com:service:ecp:1" })).toBe(false);
    });

    it("recognises a Roku from the USN header", () => {
        expect(isRokuDiscoveryResponse({ USN: "uuid:roku:ecp:X00500ABCDEF" })).toBe(true);
    });

    it("is case insensitive", () => {
        expect(isRokuDiscoveryResponse({ ST: "ROKU:ECP" })).toBe(true);
        expect(isRokuDiscoveryResponse({ USN: "UUID:ROKU:ECP:X1" })).toBe(true);
    });

    it("rejects responses from other SSDP devices", () => {
        expect(isRokuDiscoveryResponse({ ST: "upnp:rootdevice", USN: "uuid:1234" })).toBe(false);
        expect(isRokuDiscoveryResponse({})).toBe(false);
    });

    it("returns false for missing headers", () => {
        expect(isRokuDiscoveryResponse(undefined)).toBe(false);
        expect(isRokuDiscoveryResponse(null)).toBe(false);
    });
});

describe("parseDeviceMetadata", () => {
    it("extracts every field from a full device-info response", () => {
        expect(parseDeviceMetadata("192.168.1.50", "", DEVICE_INFO_XML)).toEqual({
            ipAddr: "192.168.1.50",
            serialNumber: "X00500ABCDEF",
            friendlyName: "Living Room Roku",
            modelNumber: "4800X",
            modelName: "Roku Ultra",
        });
    });

    it("prefers a serial number supplied by the caller", () => {
        // The SSDP USN header is more reliable than the XML body, so it wins when present.
        const result = parseDeviceMetadata("192.168.1.50", "FROM-USN", DEVICE_INFO_XML);
        expect(result.serialNumber).toBe("FROM-USN");
    });

    it("returns a safe empty shape when there is no data", () => {
        expect(parseDeviceMetadata("192.168.1.50", "X1", "")).toEqual({
            ipAddr: "192.168.1.50",
            serialNumber: "X1",
            friendlyName: "",
            modelNumber: "",
            modelName: "",
        });
        expect(parseDeviceMetadata("192.168.1.50", "", undefined).serialNumber).toBe("");
    });

    it("accepts the camelCase tag spellings", () => {
        // Older firmware uses <serialNumber>/<modelNumber> rather than the hyphenated form.
        const xml = "<serialNumber>X2</serialNumber><modelNumber>3700X</modelNumber>";
        const result = parseDeviceMetadata("10.0.0.5", "", xml);
        expect(result.serialNumber).toBe("X2");
        expect(result.modelNumber).toBe("3700X");
    });

    it("falls back to user-device-name when there is no friendly-device-name", () => {
        const xml = "<user-device-name>Bedroom</user-device-name>";
        expect(parseDeviceMetadata("10.0.0.5", "", xml).friendlyName).toBe("Bedroom");
    });

    it("falls back to friendly-model-name when there is no model-name", () => {
        const xml = "<friendly-model-name>Roku Express</friendly-model-name>";
        expect(parseDeviceMetadata("10.0.0.5", "", xml).modelName).toBe("Roku Express");
    });

    it("leaves missing fields empty rather than undefined", () => {
        const result = parseDeviceMetadata("10.0.0.5", "", "<udn>only-this</udn>");
        expect(result.friendlyName).toBe("");
        expect(result.modelName).toBe("");
        expect(result.modelNumber).toBe("");
        expect(result.serialNumber).toBe("");
    });
});
