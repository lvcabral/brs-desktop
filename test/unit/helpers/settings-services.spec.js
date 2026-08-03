/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getSettings, NETWORK_SERVICES } from "../../../src/helpers/settings";

/**
 * The table saveServicesSettings drives every network service from.
 *
 * The failure this guards against is silent: a `key` that does not match the preferences schema
 * makes `services[key]` undefined, which reads as "not enabled", so the service is disabled on
 * every save and its toggle appears to do nothing. Nothing throws, and no other test notices.
 */
describe("NETWORK_SERVICES", () => {
    it("covers every service the preferences schema defines", () => {
        // Mirrors the `services` defaults in getSettings(); password/webPort/remoteAccess are
        // parameters of those services rather than services in their own right.
        expect(NETWORK_SERVICES.map((s) => s.key).sort()).toEqual(
            ["debug", "ecp", "installer", "screen", "telnet"].sort()
        );
    });

    it("keeps a checkbox bound to every service key the save loop drives", () => {
        // The assertion above compares the table against a hand-copied literal, so it cannot catch
        // a key renamed on the schema side. This reads the real form: the Telnet row shares one
        // title across two fields, which is exactly the shape where a key is easy to lose.
        const fields = getSettings(__registerWindow(createFakeWindow(1)))
            .getSectionByName("services")
            .form.groups.flatMap((group) => group.fields);
        const toggles = fields.filter((field) => field.type === "checkbox").map((field) => field.key);
        expect(toggles.sort()).toEqual([...NETWORK_SERVICES.map((s) => s.key), "remoteAccess"].sort());
    });

    it("gives every entry the three operations the save loop calls", () => {
        for (const service of NETWORK_SERVICES) {
            expect(typeof service.enable, service.key).toBe("function");
            expect(typeof service.disable, service.key).toBe("function");
            expect(typeof service.setLocalOnly, service.key).toBe("function");
        }
    });

    it("reads `running` live rather than capturing it at module load", () => {
        // A plain value here would freeze at false, so an already-listening service would be
        // re-enabled on every save instead of just being told the new local-only value.
        for (const service of NETWORK_SERVICES) {
            const descriptor = Object.getOwnPropertyDescriptor(service, "running");
            expect(descriptor?.get, service.key).toBeTypeOf("function");
        }
    });
});
