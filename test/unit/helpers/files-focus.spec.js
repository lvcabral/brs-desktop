/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createFakeWindow, __registerWindow } from "../../mocks/electron.js";
import { getTestUserData } from "../../setup/global.js";
import { getSettings, getSimulatorOption, setSimulatorOption } from "../../../src/helpers/settings";
import { loadFile } from "../../../src/helpers/files";
import { BRS_HOME_APP_PATH } from "../../../src/constants";

/**
 * `focusWindow()` in src/helpers/files.js raises the simulator window whenever an app other than
 * the home screen is launched. `disableFocusOnLaunch` turns that off, for users who keep the
 * simulator minimized or behind other windows while a remote launch deploys to it.
 *
 * The option is phrased negatively on purpose: @lvcabral/electron-preferences merges a persisted
 * section over the defaults key by key, so a newly default-on id would never reach an existing
 * brs-settings.json. Absence has to mean "current behavior" -- which is what the last test here pins.
 */

let appZip;

beforeAll(() => {
    // Any real file with a supported extension will do: executeFile() only reads its length before
    // handing the bytes to the renderer, and peer-Roku deploy is off by default.
    appZip = path.join(getTestUserData(), "focus-test-app.zip");
    fs.writeFileSync(appZip, Buffer.alloc(16));
});

beforeEach(() => {
    // The settings singleton is built once per spec file (the forks pool isolates files), but the
    // options array is shared across tests, so reset both flags every time.
    getSettings(__registerWindow(createFakeWindow(1)));
    setSimulatorOption("disableFocusOnLaunch", false);
    // loadFile()'s error path falls back to loadFile([BRS_HOME_APP_PATH]), and under vite-node that
    // relative path resolves against src/helpers/ rather than the webpack bundle's app/, so it does
    // not exist and the fallback re-enters itself forever. Home screen mode off avoids it entirely.
    setSimulatorOption("disableHomeScreen", true);
});

describe("focusWindow on app launch", () => {
    it("restores a minimized window by default", () => {
        const window = __registerWindow(createFakeWindow(1));
        window.isMinimized.mockReturnValue(true);

        loadFile([appZip]);

        expect(window.restore).toHaveBeenCalledTimes(1);
        expect(window.sentOn("executeFile")).toHaveLength(1);
    });

    it("steals focus from a background window by default", () => {
        // isMinimized/isVisible defaults put the fake window in the third branch: an always-on-top
        // flip around focus(), which is how the window gets raised on macOS.
        const window = __registerWindow(createFakeWindow(1));

        loadFile([appZip]);

        expect(window.focus).toHaveBeenCalledWith({ steal: true });
        expect(window.setAlwaysOnTop.mock.calls).toEqual([[true], [false]]);
    });

    it("leaves the window alone when disableFocusOnLaunch is set, and still runs the app", () => {
        setSimulatorOption("disableFocusOnLaunch", true);
        const window = __registerWindow(createFakeWindow(1));
        window.isMinimized.mockReturnValue(true);

        loadFile([appZip]);

        expect(window.restore).not.toHaveBeenCalled();
        expect(window.show).not.toHaveBeenCalled();
        expect(window.focus).not.toHaveBeenCalled();
        expect(window.setAlwaysOnTop).not.toHaveBeenCalled();
        // Suppressing the raise must not suppress the launch.
        expect(window.sentOn("executeFile")).toHaveLength(1);
    });

    it("never raises the window for the home app, whatever the option says", () => {
        const window = __registerWindow(createFakeWindow(1));
        window.isMinimized.mockReturnValue(true);

        loadFile([BRS_HOME_APP_PATH]);

        expect(window.restore).not.toHaveBeenCalled();
        expect(window.show).not.toHaveBeenCalled();
        expect(window.focus).not.toHaveBeenCalled();
    });
});

describe("disableFocusOnLaunch preference", () => {
    it("is offered as a General checkbox option", () => {
        // Reads the real schema rather than a copy, so renaming the value on one side fails here.
        const fields = getSettings(__registerWindow(createFakeWindow(1)))
            .getSectionByName("simulator")
            .form.groups.flatMap((group) => group.fields);
        const options = fields.find((field) => field.key === "options" && field.type === "checkbox");
        expect(options.options.map((option) => option.value)).toContain("disableFocusOnLaunch");
    });

    it("defaults to off so existing settings files keep the focus-on-launch behavior", () => {
        const settings = getSettings(__registerWindow(createFakeWindow(1)));
        expect(settings.defaults.simulator.options).not.toContain("disableFocusOnLaunch");
        settings.value("simulator.options", settings.defaults.simulator.options);
        expect(getSimulatorOption("disableFocusOnLaunch")).toBe(false);
    });
});
