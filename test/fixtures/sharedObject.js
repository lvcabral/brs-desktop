/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Fixtures for `globalThis.sharedObject`, the shared-state backbone between the main
 * process and the renderer.
 *
 * There are deliberately two device-info factories because the object has two lifecycle
 * shapes. `makeDeviceInfo()` is what `src/main.js` builds at startup; `models` and
 * `registry` are absent from it and only arrive later, from the renderer, via the
 * `deviceData` IPC handler in `src/helpers/settings.js`. ECP reads those two fields, so
 * anything exercising ECP needs `makeEngineDeviceInfo()`.
 */

/**
 * Build the startup device info, matching the literal in `src/main.js`
 * @param {object} [overrides] - Fields to merge over the defaults
 * @returns {object} - The device info object
 */
export function makeDeviceInfo(overrides = {}) {
    return {
        developerId: "brs-dev-id",
        friendlyName: "BrightScript Simulator",
        deviceModel: "4200X",
        clientId: "11111111-2222-3333-4444-555555555555",
        RIDA: "66666666-7777-8888-9999-000000000000",
        autoPlayEnabled: true,
        countryCode: "US",
        timeZone: "America/New_York",
        timeZoneIANA: "America/New_York",
        timeZoneAuto: true,
        timeZoneOffset: -240,
        locale: "en_US",
        clockFormat: "12h",
        displayMode: "720p",
        captionMode: "Off",
        captionStyle: [],
        captionLanguage: "en",
        connectionInfo: {
            type: "WiredConnection",
            name: "eth1",
            gateway: "127.0.0.1",
            dns: ["192.0.2.53"], // TEST-NET-1, reserved by RFC 5737
            quality: "Excellent",
        },
        localIps: ["eth1,127.0.0.1"],
        startTime: 1700000000000,
        maxSimulStreams: 2,
        audioVolume: 50,
        audioLanguage: "en",
        tmpVolSize: 100 * 1024 * 1024,
        cacheFSVolSize: 100 * 1024 * 1024,
        appList: [],
        customFeatures: [],
        ...overrides,
    };
}

/**
 * Build the post-`deviceData` device info: what the renderer adds once the engine
 * has reported in. Required by everything under `src/server/`.
 * @param {object} [overrides] - Fields to merge over the defaults
 * @returns {object} - The device info object
 */
export function makeEngineDeviceInfo(overrides = {}) {
    return makeDeviceInfo({
        serialNumber: "BRSDESKTOP070",
        firmwareVersion: "BSC.30E04170A",
        models: new Map([
            ["4200X", ["Roku 3", "STB", "1080p", "1GB", "armv7l"]],
            ["8000X", ["Roku TV", "TV", "1080p", "1GB", "armv7l"]],
        ]),
        registry: new Map([
            ["brs-dev-id.Prefs.Volume", "50"],
            ["brs-dev-id.Prefs.Theme", "dark"],
        ]),
        appList: [
            {
                id: "dev",
                title: "Test App",
                version: "1.0.0",
                path: "/fixtures/apps/dev.zip",
                icon: "file:///fixtures/apps/dev.png",
            },
        ],
        ...overrides,
    });
}

/**
 * Build a complete `globalThis.sharedObject`
 * @param {object} [deviceInfo] - The device info to embed; defaults to the engine shape
 * @returns {object} - The shared object
 */
export function makeSharedObject(deviceInfo = makeEngineDeviceInfo()) {
    return {
        theme: "purple",
        backgroundColor: "#251135",
        deviceInfo,
    };
}
