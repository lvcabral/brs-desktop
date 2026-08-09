/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ipcMain } from "../../mocks/electron.js";
import { makeSharedObject, makeDeviceInfo, makeEngineDeviceInfo } from "../../fixtures/sharedObject";
import {
    initECP,
    genDeviceRootXml,
    genDeviceInfoXml,
    genThemesXml,
    genScrsvXml,
    genAppsXml,
    genActiveApp,
    genMediaPlayer,
    genAppState,
    genAppRegistry,
    genGraphicsFrameRate,
    genSgRendezvousStatusXml,
    genSgRendezvousQueryXml,
    getMacAddress,
    getModelName,
} from "../../../src/server/ecp";

/**
 * Decode a base64 payload back to XML
 * @param {string} encoded - The base64 string
 * @returns {string} - The decoded text
 */
function decode(encoded) {
    return Buffer.from(encoded, "base64").toString("utf8");
}

describe("ECP payload builders", () => {
    beforeEach(() => {
        globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo());
        initECP();
    });

    describe("genDeviceRootXml", () => {
        const xml = () => genDeviceRootXml();

        it("is well-formed UPnP root XML", () => {
            expect(xml()).toMatch(/^<\?xml version="1\.0"/);
            expect(xml()).toContain("<root");
            expect(xml().trimEnd().endsWith("</root>")).toBe(true);
        });

        it("advertises the device identity", () => {
            expect(xml()).toContain("<friendlyName>");
            expect(xml()).toContain("<modelName>");
            expect(xml()).toContain("<serialNumber>BRSDESKTOP070</serialNumber>");
        });

        it("derives the UDN from the MAC address", () => {
            const mac = getMacAddress().replaceAll(/:\s*/g, "");
            expect(xml()).toContain(`uuid:138aedd0-d6ad-11eb-b8bc-${mac}`);
        });

        it("lists both UPnP services", () => {
            // Roku advertises an ECP service and a DIAL service; the VS Code extension
            // looks for these when discovering a device.
            expect(xml()).toContain("ecp_SCPD.xml");
            expect(xml()).toContain("dial_SCPD.xml");
        });
    });

    describe("genDeviceInfoXml", () => {
        it("reports the fixture device", () => {
            const xml = genDeviceInfoXml(false);
            expect(xml).toContain("<serial-number>BRSDESKTOP070</serial-number>");
            expect(xml).toContain("<keyed-developer-id>brs-dev-id</keyed-developer-id>");
            expect(xml).toContain("<user-device-name>BrightScript Simulator</user-device-name>");
            expect(xml).toContain("<model-number>4200X</model-number>");
        });

        it("derives the software version from the firmware string", () => {
            // BSC.30E04170A decodes to 11.3.0; see getRokuOS in helpers/util.
            expect(genDeviceInfoXml(false)).toContain("<software-version>11.3.0</software-version>");
        });

        it("reports the locale and country", () => {
            const xml = genDeviceInfoXml(false);
            expect(xml).toContain("<country>US</country>");
            expect(xml).toContain("<language>en</language>");
        });

        it("base64-encodes when asked", () => {
            const encoded = genDeviceInfoXml(true);
            expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
            expect(decode(encoded)).toContain("<serial-number>BRSDESKTOP070</serial-number>");
        });

        it("adds the virtual device id only in the encrypted form", () => {
            // The ECP-2 WebSocket payload carries a field the REST response omits.
            expect(decode(genDeviceInfoXml(true))).toContain("virtual-device-id");
            expect(genDeviceInfoXml(false)).not.toContain("virtual-device-id");
        });

        // device.models arrives from the renderer via the deviceData IPC and is absent from
        // the object main.js builds at startup, so an ECP client can query in that window --
        // the VS Code BrightScript extension polls on connect. Answering with the generic
        // model name beats returning a 500.
        it("falls back to a generic model name before the renderer has reported device data", () => {
            globalThis.sharedObject = makeSharedObject(makeDeviceInfo());
            initECP();
            const xml = genDeviceInfoXml(false);
            // The serial number also arrives with deviceData, so it is legitimately blank
            // here; what matters is that the model falls back instead of throwing.
            expect(xml).toContain("Roku (4200X)");
            expect(xml).toContain("<device-info>");
        });
    });

    describe("genThemesXml and genScrsvXml", () => {
        it("match their snapshots", () => {
            expect(genThemesXml(false)).toMatchSnapshot();
            expect(genScrsvXml(false)).toMatchSnapshot();
        });

        it("mark exactly one entry as selected", () => {
            expect(genThemesXml(false).match(/selected="true"/g)).toHaveLength(1);
            expect(genScrsvXml(false).match(/selected="true"/g)).toHaveLength(1);
        });

        it("round-trip through base64", () => {
            expect(decode(genThemesXml(true))).toBe(genThemesXml(false));
            expect(decode(genScrsvXml(true))).toBe(genScrsvXml(false));
        });
    });

    describe("genAppsXml", () => {
        it("injects a dummy Home app when fewer than two are installed", () => {
            // The Roku Deep Linking Tester refuses to work against a device with
            // fewer than two apps, so a placeholder is added.
            globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo({ appList: [] }));
            initECP();
            expect(genAppsXml(false)).toContain('id="home"');
        });

        it("keeps the dummy alongside a single real app", () => {
            const xml = genAppsXml(false);
            expect(xml).toContain('id="home"');
            expect(xml).toContain('id="dev"');
            expect(xml).toContain("Test App");
        });

        it("omits the dummy once two or more apps are installed", () => {
            const appList = [
                { id: "a", title: "App A", version: "1.0.0" },
                { id: "b", title: "App B", version: "2.0.0" },
                { id: "c", title: "App C", version: "3.0.0" },
            ];
            globalThis.sharedObject = makeSharedObject(makeEngineDeviceInfo({ appList }));
            initECP();
            const xml = genAppsXml(false);
            expect(xml).not.toContain('id="home"');
            expect(xml.match(/<app /g)).toHaveLength(3);
        });
    });

    describe("genActiveApp", () => {
        // No listener cleanup here on purpose: ecp.js registers its "currentApp" handler at
        // module-evaluation time, so removing it would leave the rest of the file unable to
        // set currentApp at all. These two run in order, unset then set.
        it("reports the home screen when nothing is running", () => {
            const xml = genActiveApp(false);
            expect(xml).toContain(">Home</app>");
            expect(xml).toContain('type="home"');
        });

        it("reports the running app once the renderer announces it", () => {
            // currentApp is populated by an ipcMain handler registered at module load.
            ipcMain.emit("currentApp", {}, { id: "dev", title: "Test App", version: "1.0.0" });
            const xml = genActiveApp(false);
            expect(xml).toContain("Test App");
            expect(xml).toContain('id="dev"');
            expect(xml).toContain('type="appl"');
        });
    });

    describe("genAppState", () => {
        it("reports a known app", () => {
            const xml = genAppState("dev", false);
            expect(xml).toContain("Test App");
            expect(xml).not.toContain("FAILED");
        });

        it("reports FAILED for an unknown app", () => {
            expect(genAppState("nosuchapp", false)).toContain("FAILED");
        });
    });

    describe("genMediaPlayer", () => {
        it("is well-formed and reports a state", () => {
            const xml = genMediaPlayer(false);
            expect(xml).toMatch(/^<\?xml/);
            expect(xml).toContain("<player");
        });
    });

    describe("genGraphicsFrameRate", () => {
        it("is deterministic under a frozen clock", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-07-25T12:00:00Z"));
            try {
                expect(genGraphicsFrameRate(false)).toBe(genGraphicsFrameRate(false));
                expect(genGraphicsFrameRate(false)).toMatchSnapshot();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("genAppRegistry", () => {
        it("reports the developer id and registry contents", () => {
            const xml = genAppRegistry("dev", false);
            expect(xml).toContain("<dev-id>brs-dev-id</dev-id>");
            expect(xml).toContain("Volume");
        });

        it("reports FAILED for an unknown app", () => {
            expect(genAppRegistry("nosuchapp", false)).toContain("FAILED");
        });

        it("works without menuService having installed hashCode first", () => {
            // Regression guard: ecp.js imports helpers/hash itself rather than relying on
            // another module in the graph having loaded it.
            expect(() => genAppRegistry("dev", false)).not.toThrow();
        });
    });

    describe("genSgRendezvousStatusXml", () => {
        it("reports tracking-enabled true when tracking is on", () => {
            const xml = genSgRendezvousStatusXml(true);
            expect(xml).toContain("<tracking-enabled>true</tracking-enabled>");
            expect(xml).toContain("<status>OK</status>");
        });

        it("reports tracking-enabled false when tracking is off", () => {
            const xml = genSgRendezvousStatusXml(false);
            expect(xml).toContain("<tracking-enabled>false</tracking-enabled>");
            expect(xml).toContain("<status>OK</status>");
        });

        it("does not contain event data elements", () => {
            const xml = genSgRendezvousStatusXml(true);
            expect(xml).not.toContain("<data>");
            expect(xml).not.toContain("<count>");
            expect(xml).not.toContain("<timestamp>");
        });
    });

    describe("genSgRendezvousQueryXml", () => {
        it("reports tracking status and counts with no events", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-08-04T12:00:00Z"));
            try {
                const xml = genSgRendezvousQueryXml([], 0, true);
                expect(xml).toContain("<tracking-enabled>true</tracking-enabled>");
                expect(xml).toContain("<count>0</count>");
                expect(xml).toContain("<drop-count>0</drop-count>");
                expect(xml).toContain("<plugin-id>");
                expect(xml).toContain("<plugin-title>");
                expect(xml).toContain("<timestamp>");
                expect(xml).toContain("<status>OK</status>");
            } finally {
                vi.useRealTimers();
            }
        });

        it("includes event items with the correct fields", () => {
            const events = [
                { id: 1, startTm: 100.5, endTm: 105.3, line: 42, file: "pkg:/components/Task.brs" },
                { id: 2, startTm: 200, endTm: 210.7, line: 99, file: "pkg:/source/main.brs" },
            ];
            const xml = genSgRendezvousQueryXml(events, 3, true);
            expect(xml).toContain("<count>2</count>");
            expect(xml).toContain("<drop-count>3</drop-count>");
            // First event
            expect(xml).toContain("<id>1</id>");
            expect(xml).toContain("<start-tm>100.5</start-tm>");
            expect(xml).toContain("<end-tm>105.3</end-tm>");
            expect(xml).toContain("<line-number>42</line-number>");
            expect(xml).toContain("<file>pkg:/components/Task.brs</file>");
            // Second event
            expect(xml).toContain("<id>2</id>");
            expect(xml).toContain("<start-tm>200</start-tm>");
            expect(xml).toContain("<end-tm>210.7</end-tm>");
            expect(xml).toContain("<line-number>99</line-number>");
            expect(xml).toContain("<file>pkg:/source/main.brs</file>");
        });

        it("reports tracking-enabled false when tracking is off", () => {
            const xml = genSgRendezvousQueryXml([], 0, false);
            expect(xml).toContain("<tracking-enabled>false</tracking-enabled>");
        });
    });

    describe("getModelName", () => {
        it("resolves a known model from the device map", () => {
            expect(getModelName("4200X")).toBe("Roku 3");
        });
    });

    describe("getMacAddress", () => {
        it("returns a colon-separated MAC address", () => {
            expect(getMacAddress()).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i);
        });
    });
});
