/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect } from "vitest";
import * as constants from "../../src/constants";

describe("service ports", () => {
    // These are not arbitrary. External tools speak to the simulator on these ports —
    // notably the VS Code BrightScript extension, which discovers it as a real Roku over
    // ECP on 8060 and SSDP on 1900. Changing one is a breaking change for those clients.
    it("matches the ports real Roku devices use", () => {
        expect(constants.ECP_PORT).toBe(8060);
        expect(constants.SSDP_PORT).toBe(1900);
        expect(constants.TELNET_PORT).toBe(8085);
        expect(constants.DEBUG_PORT).toBe(8080);
        expect(constants.WEB_INSTALLER_PORT).toBe(80);
    });

    it("assigns a distinct port to every service", () => {
        const ports = [
            constants.ECP_PORT,
            constants.SSDP_PORT,
            constants.TELNET_PORT,
            constants.DEBUG_PORT,
            constants.WEB_INSTALLER_PORT,
        ];
        expect(new Set(ports).size).toBe(ports.length);
    });
});

describe("other shared constants", () => {
    it("defaults the web installer credentials to Roku's", () => {
        expect(constants.DEFAULT_USRPWD).toBe("rokudev");
    });

    it("exposes the app and editor paths", () => {
        expect(constants.BRS_HOME_APP_PATH).toBe("./assets/brs-home.zip");
        expect(constants.EDITOR_CODE_BRS).toBe("editor_code.brs");
    });

    it("caps package uploads and schedules update checks", () => {
        expect(constants.MAX_PACKAGE_SIZE_MB).toBe(7);
        expect(constants.UPDATE_CHECK_STARTUP).toBe(15000);
        expect(constants.UPDATE_CHECK_INTERVAL).toBe(24 * 60 * 60 * 1000);
        expect(constants.UPDATE_CHECK_STARTUP).toBeLessThan(constants.UPDATE_CHECK_INTERVAL);
    });
});
