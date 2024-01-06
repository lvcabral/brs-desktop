/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, nativeTheme, ipcMain } from "electron";
import { DateTime } from "luxon";
import path from "path";
import ElectronPreferences from "electron-preferences";
import { setAspectRatio } from "./window";
import { enableECP, disableECP } from "../server/ecp";
import { enableTelnet, disableTelnet } from "../server/telnet";
import {
    enableInstaller,
    disableInstaller,
    setPort,
    isInstallerEnabled,
    setPassword,
} from "../server/installer";
import { createMenu, createShortMenu, checkMenuItem } from "../menu/menuService";

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";
const timeZoneLabels = new Map();
const w = 800;
const h = 630;
let settings;
let settingsWindow;
let statusBarVisible = true;

export function getSettings(window) {
    if (settings !== undefined) {
        return settings;
    }
    const bounds = window.getBounds();
    const x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
    const y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);
    settings = new ElectronPreferences({
        debug: false,
        config: {
            css: "app/css/settings.css",
            dataStore: path.resolve(app.getPath("userData"), "brs-settings.json"),
        },
        defaults: {
            emulator: {
                options: ["statusBar", "debugOnCrash"],
                theme: "purple",
            },
            services: {
                installer: ["enabled"],
                webPort: 80,
                password: "rokudev",
                ecp: ["enabled"],
                telnet: ["enabled"],
            },
            device: {
                deviceModel: global.sharedObject.deviceInfo.deviceModel,
                clientId: global.sharedObject.deviceInfo.clientId,
                RIDA: global.sharedObject.deviceInfo.RIDA,
                developerId: global.sharedObject.deviceInfo.developerId,
                developerPwd: "",
            },
            display: {
                displayMode: "720p",
                overscanMode: "disabled",
                maxFps: 60,
            },
            remote: {
                keyBack: "Escape",
                keyHome: "Home",
                keyInfo: "Insert",
                keyReplay: "Backspace",
                keyPlayPause: "End",
            },
            audio: {
                maxSimulStreams: global.sharedObject.deviceInfo.maxSimulStreams,
                audioVolume: global.sharedObject.deviceInfo.audioVolume,
                muted: [false],
            },
            localization: {
                locale: global.sharedObject.deviceInfo.locale,
                countryCode: global.sharedObject.deviceInfo.countryCode,
                clockFormat: global.sharedObject.deviceInfo.clockFormat,
                timeZone: "system",
            },
        },
        browserWindowOverrides: {
            title: "Settings",
            titleBarStyle: isWindows || isMacOS ? "hidden": null,
            titleBarOverlay: getTitleOverlayTheme("purple"),
            frame: false,
            parent: window,
            modal: !isMacOS,
            icon: __dirname + "/images/icon.ico",
            x: x,
            y: y,
            width: w,
            maxWidth: w,
            height: h,
            maxHeight: h,
            minimizable: false,
            maximizable: false,
        },
        sections: [
            {
                id: "emulator",
                label: "General",
                icon: "settings-gear-63",
                form: {
                    groups: [
                        {
                            fields: [
                                {
                                    label: "Simulator Options",
                                    key: "options",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Enter Fullscreen Mode on Startup",
                                            value: "fullScreen",
                                        },
                                        {
                                            label: "Run Last Loaded App on Startup",
                                            value: "runLastChannel",
                                        },
                                        {
                                            label: "Open Developer Tools on Startup",
                                            value: "devToolsStartup",
                                        },
                                        {
                                            label: "Open Developer Tools when the Micro Debugger starts",
                                            value: "devToolsDebug",
                                        },
                                        {
                                            label: "Start the Micro Debugger when the App Crashes",
                                            value: "debugOnCrash",
                                        },
                                        {
                                            label: "Pause App when the Simulator loses the Focus",
                                            value: "pauseOnBlur",
                                        },
                                        {
                                            label: "Keep Last Display Image when the App is Closed",
                                            value: "keepDisplayOnExit",
                                        },
                                        {
                                            label: "Make the Simulator Window Always on Top",
                                            value: "alwaysOnTop",
                                        },
                                        {
                                            label: "Show Performance Statistics Overlay",
                                            value: "perfStats",
                                        },
                                        {
                                            label: "Show the Status Bar",
                                            value: "statusBar",
                                        },
                                    ],
                                    help: "Configure your preferences for the Simulator window and debugging tools",
                                },
                                {
                                    label: "Simulator UI Theme",
                                    key: "theme",
                                    type: "radio",
                                    options: [
                                        {
                                            label: "Purple (default)",
                                            value: "purple",
                                        },
                                        { label: "Light", value: "light" },
                                        { label: "Dark", value: "dark" },
                                        {
                                            label: "System",
                                            value: "system",
                                        },
                                    ],
                                    help: "Select the application theme, 'System' will follow your OS configuration",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "services",
                label: "Services",
                icon: "app-terminal",
                form: {
                    groups: [
                        {
                            label: "Remote Access Services",
                            fields: [
                                {
                                    label: "Application Installer (Web)",
                                    key: "installer",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Service Enabled",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "This service allows to remotely side load an app, to change port and password restart the service ",
                                },
                                {
                                    label: "Port (default: 80)",
                                    key: "webPort",
                                    type: "text",
                                    inputType: "number",
                                },
                                {
                                    label: "Password (default: rokudev)",
                                    key: "password",
                                    type: "text",
                                    inputType: "password",
                                },
                                {
                                    label: "External Control Protocol (ECP)",
                                    key: "ecp",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Service Enabled",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "ECP service allows the simulator to be controlled over the network",
                                },
                                {
                                    label: "BrightScript Remote Console (Telnet)",
                                    key: "telnet",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Service Enabled",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "Remote Console can be accessed using an application such as PuTTY or terminal on Mac and Linux",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "device",
                label: "Device",
                icon: "roku-box",
                form: {
                    groups: [
                        {
                            label: "Device Information",
                            fields: [
                                {
                                    label: "Roku Model",
                                    key: "deviceModel",
                                    type: "dropdown",
                                    options: getRokuModelArray(),
                                    help: "Device model returned by ifDeviceInfo.GetModel(). This setting doesn't affect any behavior of the simulator",
                                },
                                {
                                    label: "Channel Client Id",
                                    key: "clientId",
                                    type: "text",
                                    help: "Unique device identifier returned by ifDeviceInfo.GetChannelClientId()",
                                },
                                {
                                    label: "RIDA",
                                    key: "RIDA",
                                    type: "text",
                                    help: "Unique identifier for advertisement tracking returned by ifDevideInfo.GetRIDA()",
                                },
                                {
                                    label: "Developer Id",
                                    key: "developerId",
                                    type: "text",
                                    help: "Unique id to segregate registry data, the registry only changes after a reset or app restart",
                                },
                                {
                                    label: "Developer Password",
                                    key: "developerPwd",
                                    type: "text",
                                    help: "Password used to encrypt and decrypt the app package source code, needs to be 32 bytes long",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "remote",
                label: "Remote",
                icon: "roku-remote",
                form: {
                    groups: [
                        {
                            label: "Remote Control Emulation - Customize Keys",
                            fields: [
                                {
                                    label: "Button: Back",
                                    key: "keyBack",
                                    type: "accelerator",
                                    help: "Select a keyboard shortcut for the `back` button.",
                                    modifierRequired: false,
                                },
                                {
                                    label: "Button: Home",
                                    key: "keyHome",
                                    type: "accelerator",
                                    help: "Select a keyboard shortcut for the `home` button.",
                                },
                                {
                                    label: "Button: Info",
                                    key: "keyInfo",
                                    type: "accelerator",
                                    help: "Select a keyboard shortcut for the `info` (*) button.",
                                },
                                {
                                    label: "Button: Instant Replay",
                                    key: "keyReplay",
                                    type: "accelerator",
                                    help: "Select a keyboard shortcut for the `instant replay` button.",
                                },
                                {
                                    label: "Button: Play/Pause",
                                    key: "keyPlayPause",
                                    type: "accelerator",
                                    help: "Select a keyboard shortcut for the `play/pause` button.",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "display",
                label: "Display",
                icon: "tv-screen",
                form: {
                    groups: [
                        {
                            fields: [
                                {
                                    label: "Display Mode",
                                    key: "displayMode",
                                    type: "radio",
                                    options: [
                                        {
                                            label: "SD 480p (4:3)",
                                            value: "480p",
                                        },
                                        {
                                            label: "HD 720p (16:9)",
                                            value: "720p",
                                        },
                                        {
                                            label: "FHD 1080p (16:9)",
                                            value: "1080p",
                                        },
                                    ],
                                    help: "Device display mode. Changing this setting will close any running app",
                                },
                                {
                                    label: "TV Overscan",
                                    key: "overscanMode",
                                    type: "radio",
                                    options: [
                                        {
                                            label: "Overscan Disabled",
                                            value: "disabled",
                                        },
                                        {
                                            label: "Show Overscan Guide Lines",
                                            value: "guidelines",
                                        },
                                        {
                                            label: "Enable Overscan Effect",
                                            value: "overscan",
                                        },
                                    ],
                                    help: "Enable overscan to verify potential cuts of the UI on the TV borders",
                                },
                                {
                                    label: "Maximum Display Framerate",
                                    key: "maxFps",
                                    type: "radio",
                                    options: [
                                        {
                                            label: "Slow: 15 fps",
                                            value: 15,
                                        },
                                        {
                                            label: "Average: 30 fps",
                                            value: 30,
                                        },
                                        {
                                            label: "Fast: 60 fps (default)",
                                            value: 60,
                                        },
                                    ],
                                    help: "The maximum # of frames per second (fps) to be generated by the simulator.",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "audio",
                label: "Audio",
                icon: "speaker",
                form: {
                    groups: [
                        {
                            label: "Audio Settings",
                            fields: [
                                {
                                    label: "Maximum Simultaneous Streams",
                                    key: "maxSimulStreams",
                                    type: "slider",
                                    min: 1,
                                    max: 3,
                                    help: "Maximum number of audio streams that can be mixed together and played simultaneously",
                                },
                                {
                                    label: "Sound Effects Volume",
                                    key: "audioVolume",
                                    type: "slider",
                                    min: 0,
                                    max: 100,
                                    help: "Volume level of the app sound effects",
                                },
                                {
                                    key: "muted",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Mute Music and Sound Effects",
                                            value: true,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "localization",
                label: "Localization",
                icon: "world",
                form: {
                    groups: [
                        {
                            fields: [
                                {
                                    label: "Channels UI Locale",
                                    key: "locale",
                                    type: "radio",
                                    options: getLocaleIdArray(),
                                    help: "Configure the localization, this setting only affects apps not the simulator UI",
                                },
                                {
                                    label: "Clock Format",
                                    key: "clockFormat",
                                    type: "radio",
                                    options: [
                                        {
                                            value: "12h",
                                            label: "12-hour AM/PM format",
                                        },
                                        {
                                            value: "24h",
                                            label: "24-hour format",
                                        },
                                    ],
                                },
                                {
                                    label: "Channel Store Country",
                                    key: "countryCode",
                                    type: "dropdown",
                                    options: getCountryArray(),
                                    help: "Configure the country store associated with the device returned by ifDeviceInfo.GetCountryCode()",
                                },
                                {
                                    label: "Time Zone",
                                    key: "timeZone",
                                    type: "dropdown",
                                    options: getTimezonArray(),
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });
    settings.on("save", (preferences) => {
        saveEmulatorSettings(preferences.emulator.options, window);
        saveServicesSettings(preferences.services, window);
        setDeviceInfo("device", "deviceModel", true);
        setDeviceInfo("device", "clientId", true);
        setDeviceInfo("device", "RIDA", true);
        setDeviceInfo("device", "developerId"); // Do not notify app to avoid change registry without reset
        saveDisplaySettings(window);
        setRemoteKeys(settings.defaults.remote, preferences.remote);
        if (preferences.audio) {
            setDeviceInfo("audio", "maxSimulStreams", true);
            setDeviceInfo("audio", "audioVolume", true);
            window.webContents.send("setAudioMute", preferences.audio.muted[0]);
        }
        if (preferences.localization) {
            const localeId = preferences.localization.locale;
            if (global.sharedObject.deviceInfo.locale !== localeId) {
                global.sharedObject.deviceInfo.locale = localeId;
                checkMenuItem(localeId, true);
                window.webContents.send("setLocale", localeId);
            }
            setDeviceInfo("localization", "clockFormat", true);
            setDeviceInfo("localization", "countryCode", true);
            setTimeZone(true);
        }
    });
    nativeTheme.on("updated", () => {
        if (settings.value("emulator.theme") === "system") {
            const userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
            window.webContents.send("setTheme", userTheme);
            global.sharedObject.theme = userTheme;
        }
    });
    return settings;
}

export function setRemoteKeys(defaults, remote) {
    const customKeys = new Map();
    if (remote.keyBack === "") {
        settings.value("remote.keyBack", defaults.keyBack);
    } else if (defaults.keyBack !== remote.keyBack) {
        customKeys.set(convertKey(remote.keyBack), "back");
    }
    if (remote.keyHome === "") {
        settings.value("remote.keyHome", defaults.keyHome);
    } else if (defaults.keyHome !== remote.keyHome) {
        customKeys.set(convertKey(remote.keyHome), "home");
    }
    if (remote.keyInfo === "") {
        settings.value("remote.keyInfo", defaults.keyInfo);
    } else if (defaults.keyInfo !== remote.keyInfo) {
        customKeys.set(convertKey(remote.keyInfo), "info");
    }
    if (remote.keyReplay === "") {
        settings.value("remote.keyReplay", defaults.keyReplay);
    } else if (defaults.keyReplay !== remote.keyReplay) {
        customKeys.set(convertKey(remote.keyReplay), "instantreplay");
    }
    if (remote.keyPlayPause === "") {
        settings.value("remote.keyPlayPause", defaults.keyPlayPause);
    } else if (defaults.keyPlayPause !== remote.keyPlayPause) {
        customKeys.set(convertKey(remote.keyPlayPause), "play");
    }
    if (customKeys.size > 0) {
        const window = BrowserWindow.fromId(1);
        if (window) {
            window.webContents.send("setCustomKeys", customKeys);
        }
    }
}

export function showSettings() {
    const window = BrowserWindow.fromId(1);
    if (window.isFullScreen()) {
        window.setFullScreen(false);
    } else if (window.isMinimized()) {
        window.restore();
    } else if (!window.isVisible()) {
        window.show();
    }
    const bounds = window.getBounds();
    let x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
    let y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);

    if (isMacOS) {
        createShortMenu();
    } else {
        const userTheme = global.sharedObject.theme;
        if (isWindows) {
            settings.browserWindowOverrides.titleBarOverlay = getTitleOverlayTheme(userTheme);
        }
    }

    settingsWindow = settings.show();
    if (window.isAlwaysOnTop()) {
        settingsWindow.setAlwaysOnTop(true);
    }
    settingsWindow.setBounds({ x: x, y: y });
    settingsWindow.on("closed", () => {
        settingsWindow = null;
        if (isMacOS) {
            createMenu();
            const displayMode = settings.value("display.displayMode");
            checkMenuItem(displayMode, true);
            const overscanMode = settings.value("display.overscanMode");
            checkMenuItem(overscanMode, true);
            const localeId = settings.value("localization.locale");
            checkMenuItem(localeId, true);
            const installerEnabled = settings.value("services.installer").includes("enabled");
            checkMenuItem("web-installer", installerEnabled);
            const ecpEnabled = settings.value("services.ecp").includes("enabled");
            checkMenuItem("ecp-api", ecpEnabled);
            const telnetEnabled = settings.value("services.telnet").includes("enabled");
            checkMenuItem("telnet", telnetEnabled);
            const options = settings.value("emulator.options");
            if (options) {
                checkMenuItem("on-top", options.includes("alwaysOnTop"));
                checkMenuItem("status-bar", options.includes("statusBar"));
            }
            const userTheme = settings.value("emulator.theme");
            checkMenuItem(`theme-${userTheme}`, true);
        }
    });
}

export function setPreference(key, value) {
    settings.value(key, value);
}

export function setDeviceInfo(section, key, notifyApp) {
    const oldValue = global.sharedObject.deviceInfo[key];
    const newValue = settings.value(`${section}.${key}`);
    if (newValue && newValue !== oldValue) {
        global.sharedObject.deviceInfo[key] = newValue;
        if (notifyApp) {
            const window = BrowserWindow.fromId(1);
            window.webContents.send("setDeviceInfo", key, newValue);
        }
    }
}

export function setStatusBar(visible) {
    const window = BrowserWindow.fromId(1);
    if (window) {
        setAspectRatio(false);
        if (isMacOS) {
            if (visible) {
                window.setBounds({ height: window.getBounds().height + 20 });
            } else {
                window.setBounds({ height: window.getBounds().height - 20 });
            }
        }
        window.webContents.send("toggleStatusBar");
    }
    statusBarVisible = visible;
}

export function setDisplayOption(option, mode, notifyApp) {
    const current = settings.value(`display.${option}`);
    if (mode) {
        settings.value(`display.${option}`, mode);
    } else {
        mode = current;
    }
    if (option in global.sharedObject.deviceInfo) {
        global.sharedObject.deviceInfo[option] = mode;
    }
    if (mode !== current && (mode === "480p" || current === "480p")) {
        setAspectRatio();
    }
    checkMenuItem(mode, true);
    if (notifyApp) {
        const window = BrowserWindow.fromId(1);
        const msg = option === "displayMode" ? "setDisplay" : "setOverscan";
        window.webContents.send(msg, mode);
    }
}

export function setThemeSource(userTheme, notifyApp) {
    if (userTheme) {
        settings.value("emulator.theme", userTheme);
    } else {
        userTheme = settings.value("emulator.theme");
    }
    checkMenuItem(`theme-${userTheme}`, true);
    let systemTheme = userTheme === "purple" ? "system" : userTheme;
    nativeTheme.themeSource = systemTheme;
    if (userTheme === "system") {
        userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    global.sharedObject.theme = userTheme;
    if (notifyApp) {
        const window = BrowserWindow.fromId(1);
        window.webContents.send("setTheme", userTheme);
        window.webContents.send("refreshMenu");

        if (isWindows && settingsWindow) {
            settingsWindow.setTitleBarOverlay(getTitleOverlayTheme(userTheme));
        }
    }
    return userTheme;
}

export function getEmulatorOption(key) {
    let options = settings.value("emulator.options");
    return options ? options.includes(key) : false;
}

export function setEmulatorOption(key, enable, menuId) {
    let options = settings.value("emulator.options");
    if (options) {
        if (enable && !options.includes(key)) {
            options.push(key);
        } else if (!enable && options.includes(key)) {
            options = options.filter((item) => item !== key);
        }
        settings.value("emulator.options", options);
        if (menuId) {
            checkMenuItem(menuId, enable);
        }
    }
}

export function setLocaleId(locale) {
    const window = BrowserWindow.fromId(1);
    setPreference("localization.locale", locale);
    global.sharedObject.deviceInfo.locale = locale;
    window.webContents.send("setLocale", locale);
}

export function setTimeZone(notifyApp) {
    let timeZone = settings.value("localization.timeZone");
    if (timeZone) {
        const di = global.sharedObject.deviceInfo;
        const dt = DateTime.now().setZone(timeZone.replace("Other/", ""));
        if (dt.invalidReason) {
            console.warn(`Warning: ${dt.invalidReason} - ${dt.invalidExplanation}`);
            return;
        }
        const timeZoneIANA = timeZone === "system" ? dt.zoneName : timeZone;
        if (di.timeZoneIANA !== timeZoneIANA) {
            di.timeZone = timeZoneLabels.get(timeZoneIANA) || timeZoneIANA;
            di.timeZoneIANA = timeZoneIANA;
            di.timeZoneAuto = timeZone === "system";
            di.timeZoneOffset = dt.offset;
            if (notifyApp) {
                const window = BrowserWindow.fromId(1);
                window.webContents.send("setDeviceInfo", "timeZone", di.timeZone);
                window.webContents.send("setDeviceInfo", "timeZoneIANA", di.timeZoneIANA);
                window.webContents.send("setDeviceInfo", "timeZoneAuto", di.timeZoneAuto);
                window.webContents.send("setDeviceInfo", "timeZoneOffset", di.timeZoneOffset);
            }
        }
    }
}

export function getAudioMuted() {
    let muted = settings.value("audio.muted");
    return muted[0] ? muted[0] : false;
}

ipcMain.on("setAudioMute", (event, mute) => {
    settings.value("audio.muted", mute ? [mute] : []);
});

ipcMain.on("deviceData", (_, deviceData) => {
    if (deviceData) {
        const appDeviceInfo = global.sharedObject.deviceInfo;
        Object.keys(deviceData).forEach((key) => {
            const ignoreKeys = ["audioCodecs", "fonts", "fontPath", "defaultFont"];
            if (!ignoreKeys.includes(key) && !(key in appDeviceInfo)) {
                appDeviceInfo[key] = deviceData[key];
                if (key === "models" && appDeviceInfo.models?.size) {
                    settings.options.sections[2].form.groups[0].fields[0].options =
                        getRokuModelArray();
                }
            }
        });
    }
});

ipcMain.on("serialNumber", (_, serialNumber) => {
    global.sharedObject.deviceInfo.serialNumber = serialNumber;
});

export function getModelName(model) {
    const modelName = global.sharedObject.deviceInfo.models.get(model);
    return modelName ? modelName[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`;
}

// Settings Helper Functions

function saveEmulatorSettings(options, window) {
    if (options) {
        const onTop = options.includes("alwaysOnTop");
        const statusBar = options.includes("statusBar");
        checkMenuItem("on-top", onTop);
        window.setAlwaysOnTop(onTop);
        if (statusBarVisible != statusBar) {
            checkMenuItem("status-bar", statusBar);
            setStatusBar(statusBar);
        }
        setThemeSource(undefined, true);
    }
}

function saveServicesSettings(services, window) {
    if (services) {
        if (services.installer.includes("enabled")) {
            if (!isInstallerEnabled) {
                setPort(services.webPort);
                setPassword(services.password);
                enableInstaller(window);
            }
        } else {
            disableInstaller(window);
        }
        if (services.ecp.includes("enabled")) {
            enableECP(window);
        } else {
            disableECP(window);
        }
        if (services.telnet.includes("enabled")) {
            enableTelnet(window);
        } else {
            disableTelnet(window);
        }
    }
}

function saveDisplaySettings(window) {
    const oldValue = global.sharedObject.deviceInfo.displayMode;
    const newValue = settings.value("display.displayMode");
    if (newValue && newValue !== oldValue) {
        setDisplayOption("displayMode", undefined, true);
        if (newValue === "480p" || oldValue === "480p") {
            setAspectRatio();
        }
    }
    const overscanMode = settings.value("display.overscanMode");
    checkMenuItem(overscanMode, true);
    window.webContents.send("setOverscan", overscanMode);
    setDeviceInfo("display", "maxFps", true);
}

function convertKey(keyCode) {
    const arrows = new Set(["Left", "Right", "Up", "Down"]);
    let newCode = keyCode.replaceAll(" ", "");
    if (keyCode.includes("+")) {
        const leftKey = keyCode.split("+")[0];
        const rightKey = keyCode.split("+")[1];
        if (rightKey.length === 1) {
            newCode = `${leftKey}+${convertChar(rightKey)}`;
        } else if (arrows.has(rightKey)) {
            newCode = `${leftKey}+Arrow${rightKey}`;
        }
    } else if (keyCode.length === 1) {
        newCode = convertChar(keyCode);
    } else if (arrows.has(keyCode)) {
        newCode = `Arrow${keyCode}`;
    }
    return newCode;
}

function convertChar(keyChar) {
    if (isNumber(keyChar)) {
        return `Digit${keyChar}`;
    } else if (isLetter(keyChar)) {
        return `Key${keyChar}`;
    } else {
        const keyMap = new Map([
            ["`", "Backquote"], ["-", "Minus"], ["=", "Equal"], ["[", "BracketLeft"],
            ["]", "BracketRight"], [";", "Semicolon"], ["'", "quote"], [",", "Comma"],
            [".", "Period"], ["\\", "Backslash"], ["/", "Slash"]
        ]);
        return keyMap.get(keyChar) ?? keyChar;
    }
}

function isNumber(str) {
    return str.length === 1 && str.match(/[0-9]/i);
}

function isLetter(str) {
    return str.length === 1 && str.match(/[a-z]/i);
}

// Title Overlay Theme

function getTitleOverlayTheme(userTheme) {
    if (userTheme === "purple") {
        return { color: "#3d1b56", symbolColor: "#dac7ea", height: 28 };
    } else if (userTheme === "dark") {
        return { color: "#252526", symbolColor: "#cccccc", height: 28 };
    } else {
        return { color: "#dddddd", symbolColor: "#333333", height: 28 };
    }
}

// Data Arrays

function getRokuModelArray() {
    const modelArray = [];
    if (global.sharedObject.deviceInfo?.models?.size) {
        global.sharedObject.deviceInfo.models.forEach(function (value, key) {
            modelArray.push({ label: `${value[0]} - ${key}`, value: key });
        });
    }
    return modelArray;
}

function getLocaleIdArray() {
    return [
        { value: "en_US", label: "US English (en-US)" },
        { value: "en_GB", label: "British English (en-GB)" },
        { value: "fr_CA", label: "Canadian French (fr-CA)" },
        { value: "es_ES", label: "International Spanish (es-ES)" },
        { value: "es_MX", label: "Mexican Spanish (es-MX)" },
        { value: "de_DE", label: "German (de-DE)" },
        { value: "it_IT", label: "Italian (it-IT)" },
        { value: "pt_BR", label: "Brazilian Portuguese (pt-BR)" },
    ];
}

function getCountryArray() {
    return [
        { label: "United States (US)", value: "US" },
        { label: "Argentina (AR)", value: "AR" },
        { label: "Brazil (BR)", value: "BR" },
        { label: "Canada (CA)", value: "CA" },
        { label: "Chile (CL)", value: "CL" },
        { label: "Colombia (CO)", value: "CO" },
        { label: "Costa Rica (CR)", value: "CR" },
        { label: "El Salvador (SV)", value: "SV" },
        { label: "France (FR)", value: "FR" },
        { label: "Guatemala (GT)", value: "GT" },
        { label: "Germany (DE)", value: "DE" },
        { label: "Honduras (HN)", value: "HN" },
        { label: "Ireland (IE)", value: "IE" },
        { label: "Mexico (MX)", value: "MX" },
        { label: "Nicaragua (NI)", value: "NI" },
        { label: "Panama (PA)", value: "PA" },
        { label: "Peru (PE)", value: "PE" },
        { label: "United Kingdom (GB)", value: "GB" },
        { label: "Rest of the World (OT)", value: "OT" },
    ];
}

function getTimezonArray() {
    const dt = DateTime.now().setZone("system");
    const tzArray = [
        { label: `System: ${dt.zoneName}`, value: "system" },
        { label: "US/Puerto Rico-Virgin Islands", value: "America/Antigua" },
        { label: "US/Guam", value: "Pacific/Truk" },
        { label: "US/Samoa ", value: "Pacific/Pago_Pago" },
        { label: "US/Hawaii" },
        { label: "US/Aleutian" },
        { label: "US/Alaska" },
        { label: "US/Pacific" },
        { label: "US/Arizona", value: "America/Phoenix" },
        { label: "US/Mountain" },
        { label: "US/Central" },
        { label: "US/Eastern" },
        { label: "Canada/Pacific" },
        { label: "Canada/Mountain" },
        { label: "Canada/Central" },
        { label: "Canada/Eastern" },
        { label: "Canada/Mountain Standard", value: "America/Creston" },
        { label: "Canada/Central Standard", value: "America/Regina" },
        { label: "Canada/Atlantic" },
        { label: "Canada/Newfoundland" },
        { label: "Mexico/Pacific", value: "America/Santa_Isabel" },
        { label: "Mexico/Mountain", value: "America/Chihuahua" },
        { label: "Mexico/Central", value: "America/Bahia_Banderas" },
        { label: "Mexico/Eastern", value: "America/Cancun" },
        { label: "America/Argentina/Buenos_Aires" },
        { label: "America/Santiago" },
        { label: "America/Bogota" },
        { label: "America/Costa_Rica" },
        { label: "America/El_Salvador" },
        { label: "America/Guatemala" },
        { label: "America/Tegucigalpa" },
        { label: "America/Managua" },
        { label: "America/Panama" },
        { label: "America/Lima" },
        { label: "America/Campo_Grande" },
        { label: "America/Fortaleza" },
        { label: "America/Manaus" },
        { label: "America/Noronha" },
        { label: "America/Rio_Branco" },
        { label: "America/Sao_Paulo" },
        { label: "Europe/Iceland", value: "Atlantic/Reykjavik" },
        { label: "Europe/Ireland", value: "Europe/Dublin" },
        { label: "Europe/United Kingdom", value: "Europe/Guernsey" },
        { label: "Europe/Portugal", value: "Europe/Lisbon" },
        { label: "Europe/Central European Time", value: "Europe/Amsterdam" },
        { label: "Europe/France", value: "Europe/Paris" },
        { label: "Europe/Greece/Finland", value: "Europe/Athens" },
        { label: "Australia/WA", value: "Australia/Perth" },
        { label: "Australia/Eucla" },
        { label: "Australia/NT", value: "Australia/Darwin" },
        { label: "Australia/SA", value: "Australia/Adelaide" },
        { label: "Australia/QLD", value: "Australia/Brisbane" },
        { label: "Australia/Lord Howe", value: "Australia/LHI" },
        { label: "Australia/NSW" },
        { label: "Australia/VIC", value: "Australia/Melbourne" },
        { label: "Australia/TAS", value: "Australia/Currie" },
        { label: "Australia/ACT" },
        { label: "Africa/CAT", value: "Africa/Bujumbura" },
        { label: "Africa/CET", value: "Africa/Algiers" },
        //{ label: "Africa/CVT" },
        { label: "Africa/EAT", value: "Africa/Asmera" },
        { label: "Africa/EET", value: "Africa/Cairo" },
        { label: "Africa/GMT", value: "Africa/Abidjan" },
        { label: "Africa/MUT", value: "Indian/Mauritius" },
        { label: "Africa/RET", value: "Indian/Reunion" },
        { label: "Africa/SAST", value: "Africa/Johannesburg" },
        // { label: "Africa/SCT" },
        // { label: "Africa/WAST" },
        { label: "Africa/WAT", value: "Africa/Bangui" },
        { label: "Africa/WEST", value: "Atlantic/Madeira" },
        { label: "Africa/WET", value: "Africa/Casablanca" },
        // { label: "Africa/WST" },
        // { label: "Africa/WT" },
        { label: "Asia/Arabia", value: "Asia/Aden" },
        { label: "Asia/Afghanistan", value: "Asia/Kabul" },
        { label: "Asia/Alma-Ata", value: "Asia/Almaty" },
        { label: "Asia/Anadyr" },
        { label: "Asia/Aqtobe" },
        { label: "Asia/Armenia", value: "Asia/Yerevan" },
        { label: "Asia/Azerbaijan", value: "Asia/Baku" },
        { label: "Asia/Bangladesh", value: "Asia/Dhaka" },
        { label: "Asia/Bhutan", value: "Asia/Thimphu" },
        { label: "Asia/Brunei" },
        { label: "Asia/China", value: "Asia/Chongqing" },
        { label: "Asia/Choibalsan" },
        { label: "Asia/EastTimor", value: "Asia/Dili" },
        { label: "Asia/Georgia", value: "Asia/Tbilisi" },
        { label: "Asia/Gulf", value: "Asia/Dubai" },
        { label: "Asia/Hong_Kong" },
        { label: "Asia/Hovd" },
        { label: "Asia/India", value: "Asia/Calcutta" },
        { label: "Asia/Indochina", value: "Asia/Bangkok" },
        { label: "Asia/Irkutsk" },
        { label: "Asia/Japan", value: "Asia/Tokyo" },
        { label: "Asia/Kamchatka" },
        { label: "Asia/Korea", value: "Asia/Pyongyang" },
        { label: "Asia/Krasnoyarsk" },
        { label: "Asia/Kyrgyzstan", value: "Asia/Bishkek" },
        { label: "Asia/Malaysia", value: "Asia/Kuala_Lumpur" },
        { label: "Asia/Magadan" },
        { label: "Asia/Myanmar", value: "Asia/Rangoon" },
        { label: "Asia/Nepal", value: "Asia/Kathmandu" },
        { label: "Asia/Novosibirsk" },
        { label: "Asia/Omsk" },
        { label: "Asia/Oral" },
        { label: "Asia/Pakistan", value: "Asia/Karachi" },
        { label: "Asia/Philippines", value: "Asia/Manila" },
        { label: "Asia/Qyzylorda" },
        { label: "Asia/Sakhalin" },
        { label: "Asia/Singapore" },
        { label: "Asia/Tajikistan", value: "Asia/Dushanbe" },
        { label: "Asia/Turkmenistan", value: "Asia/Ashgabat" },
        { label: "Asia/Uzbekistan", value: "Asia/Samarkand" },
        { label: "Asia/Ulaanbaatar" },
        { label: "Asia/Vladivostok" },
        { label: "Asia/Yakutsk" },
        { label: "Asia/Yekaterinburg" },
        { label: "Asia/Eastern Indonesia", value: "Asia/Jayapura" },
        { label: "Asia/Central Indonesia", value: "Asia/Makassar" },
        { label: "Asia/Western Indonesia", value: "Asia/Jakarta" },
        { label: "Asia/Beirut" },
        { label: "Asia/Damascus" },
        { label: "Asia/Gaza" },
        { label: "Asia/Nicosia" },
        { label: "Other/UTC-11" },
        { label: "Other/UTC-10" },
        { label: "Other/UTC-9" },
        { label: "Other/UTC-8" },
        { label: "Other/UTC-7" },
        { label: "Other/UTC-6" },
        { label: "Other/UTC-5" },
        { label: "Other/UTC-4" },
        { label: "Other/UTC-3" },
        { label: "Other/UTC-2" },
        { label: "Other/UTC-1" },
        { label: "Other/UTC+0" },
        { label: "Other/UTC+1" },
        { label: "Other/UTC+2" },
        { label: "Other/UTC+3" },
        { label: "Other/UTC+4" },
        { label: "Other/UTC+5" },
        { label: "Other/UTC+6" },
        { label: "Other/UTC+7" },
        { label: "Other/UTC+8" },
        { label: "Other/UTC+9" },
        { label: "Other/UTC+10" },
        { label: "Other/UTC+11" },
        { label: "Other/UTC+12" },
        { label: "Other/UTC+13" },
        { label: "Other/UTC+14" },
    ];
    tzArray.forEach(function (item) {
        timeZoneLabels.set(item.value || item.label, item.label);
    });
    return tzArray;
}
