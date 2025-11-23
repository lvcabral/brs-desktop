/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, nativeTheme, ipcMain } from "electron";
import { DateTime } from "luxon";
import path from "node:path";
import http from "node:http";
import ElectronPreferences from "@lvcabral/electron-preferences";
import { Client as SSDPClient } from "@lvcabral/node-ssdp";
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
import { WEB_INSTALLER_PORT, DEFAULT_USRPWD } from "../constants";
import { getLocalIps } from "./util";

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const timeZoneLabels = new Map();
const discoveredDevices = new Map();
const pendingMetadataRequests = new Set();
const w = 800;
const h = 650;
let settings;
let settingsWindow;
let statusBarVisible = true;
let ssdpClient;
let localIps = [];
let peerRokuOptionsTimer = null;

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
            simulator: {
                options: ["statusBar", "debugOnCrash"],
                theme: "purple",
            },
            services: {
                installer: isLinux ? [] : ["enabled"],
                webPort: WEB_INSTALLER_PORT,
                password: DEFAULT_USRPWD,
                ecp: ["enabled"],
                telnet: ["enabled"],
            },
            device: {
                deviceModel: globalThis.sharedObject.deviceInfo.deviceModel,
                clientId: globalThis.sharedObject.deviceInfo.clientId,
                RIDA: globalThis.sharedObject.deviceInfo.RIDA,
                developerId: globalThis.sharedObject.deviceInfo.developerId,
                developerPwd: "",
            },
            display: {
                displayMode: "720p",
                overscanMode: "disabled",
                maxFps: 60,
                options: [],
            },
            remote: {
                keyBack: "Escape",
                keyHome: "Home",
                keyInfo: "Insert",
                keyReplay: "Backspace",
                keyPlayPause: "End",
                keyRev: "PageUp",
                keyFwd: "PageDown",
                keyMute: "F10"
            },
            audio: {
                maxSimulStreams: globalThis.sharedObject.deviceInfo.maxSimulStreams,
                audioVolume: globalThis.sharedObject.deviceInfo.audioVolume,
                muted: [false],
                audioLanguage: globalThis.sharedObject.deviceInfo.audioLanguage,
            },
            localization: {
                locale: globalThis.sharedObject.deviceInfo.locale,
                countryCode: globalThis.sharedObject.deviceInfo.countryCode,
                clockFormat: globalThis.sharedObject.deviceInfo.clockFormat,
                timeZone: "system",
            },
            captions: {
                captionMode: globalThis.sharedObject.deviceInfo.captionMode,
                textFont: "default",
                textEffect: "default",
                textSize: "default",
                textColor: "default",
                textOpacity: "default",
                backgroundColor: "default",
                backgroundOpacity: "default",
                captionLanguage: globalThis.sharedObject.deviceInfo.captionLanguage,
            },
            peerRoku: {
                ip: "",
                manualIp: "",
                password: DEFAULT_USRPWD,
            },
            editor: {
                indentationType: "spaces",
                indentationSize: 4,
                fontSize: 14,
            },
            deepLinking: {
                sendInput: [],
                inputMap: {},
            },
        },
        browserWindowOverrides: {
            title: "Settings",
            titleBarStyle: isWindows || isMacOS ? "hidden" : null,
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
                id: "simulator",
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
                                            label: "Open Editor and Console on Startup",
                                            value: "consoleStartup",
                                        },
                                        {
                                            label: "Open Console when the Micro Debugger starts",
                                            value: "consoleOnDebug",
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
                                            label: "Make the Simulator Window Always on Top",
                                            value: "alwaysOnTop",
                                        },
                                        {
                                            label: "Show the Status Bar",
                                            value: "statusBar",
                                        },
                                        {
                                            label: "Disable Splash Video on Startup",
                                            value: "disableSplashVideo",
                                        },
                                        {
                                            label: "Disable Home Screen mode",
                                            value: "disableHomeScreen",
                                        },
                                        {
                                            label: "Disable Warning to use Keyboard or Gamepad on Display Click",
                                            value: "disableClickToast",
                                        },
                                        {
                                            label: "Disable Check for Updates on Startup",
                                            value: "disableCheckForUpdates",
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
                id: "editor",
                label: "Code Editor",
                icon: __dirname + "/images/svg/coding.svg",
                form: {
                    groups: [
                        {
                            label: "Code Editor Settings",
                            fields: [
                                {
                                    label: "Indentation Type",
                                    key: "indentationType",
                                    type: "radio",
                                    options: [
                                        {
                                            label: "Spaces",
                                            value: "spaces",
                                        },
                                        {
                                            label: "Tabs",
                                            value: "tabs",
                                        },
                                    ],
                                    help: "Choose whether to use spaces or tabs for indentation in the code editor",
                                },
                                {
                                    label: "Indentation Size",
                                    key: "indentationSize",
                                    type: "slider",
                                    style: { width: "50%" },
                                    min: 2,
                                    max: 8,
                                    help: "Set the number of spaces per indentation level",
                                },
                                {
                                    key: "placeholder1",
                                    type: "message",
                                    style: { width: "40%" },
                                },
                                {
                                    label: "Font Size",
                                    key: "fontSize",
                                    type: "slider",
                                    style: { width: "50%" },
                                    min: 10,
                                    max: 24,
                                    help: "Set the font size for the code editor",
                                },
                                {
                                    key: "placeholder2",
                                    type: "message",
                                    style: { width: "40%" },
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
                                    help: "This service allows to remotely side load an app, to change port and password restart the service",
                                },
                                {
                                    label: "Port (default: 80)",
                                    key: "webPort",
                                    type: "number",
                                },
                                {
                                    label: "Password (default: rokudev)",
                                    key: "password",
                                    type: "text",
                                    inputType: "password",
                                },
                                {
                                    key: "placeholder1",
                                    type: "message",
                                    style: { width: "20%" },
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
                icon: __dirname + "/images/svg/roku-box.svg",
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
                label: "Control",
                icon: __dirname + "/images/svg/roku-remote.svg",
                form: {
                    groups: [
                        {
                            label: "Remote Control Keyboard Mapping - Customize Keys",
                            fields: [
                                {
                                    label: "Button: Back",
                                    key: "keyBack",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `back` button.",
                                    modifierRequired: false,
                                },
                                {
                                    label: "Button: Home",
                                    key: "keyHome",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `home` button.",
                                },
                                {
                                    label: "Button: Instant Replay",
                                    key: "keyReplay",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `replay` button.",
                                },
                                {
                                    label: "Button: Info",
                                    key: "keyInfo",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `(*)` button.",
                                },
                                {
                                    label: "Button: Rewind",
                                    key: "keyRev",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `rewind` button.",
                                },
                                {
                                    label: "Button: Forward",
                                    key: "keyFwd",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `forward` button.",
                                },
                                {
                                    label: "Button: Play/Pause",
                                    key: "keyPlayPause",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `play` button.",
                                },
                                {
                                    label: "Button: Mute",
                                    key: "keyMute",
                                    type: "accelerator",
                                    style: { width: "40%" },
                                    help: "Select a keyboard shortcut for the `mute` button.",
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
                            label: "Display Settings",
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
                                            label: "Low: 15 fps",
                                            value: 15,
                                        },
                                        {
                                            label: "Medium: 30 fps",
                                            value: 30,
                                        },
                                        {
                                            label: "High: 60 fps (default)",
                                            value: 60,
                                        },
                                    ],
                                    help: "The maximum # of frames per second (fps) to be generated by the simulator.",
                                },
                                {
                                    label: "Options",
                                    key: "options",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Keep Last Display Image when the App is Closed",
                                            value: "keepDisplayOnExit",
                                        },
                                        {
                                            label: "Show Performance Statistics Overlay",
                                            value: "perfStats",
                                        },
                                    ],
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
                                    style: { width: "60%" },
                                    min: 1,
                                    max: 2,
                                    help: "Maximum number of audio streams that can be mixed together",
                                },
                                {
                                    key: "placeholder1",
                                    type: "message",
                                    style: { width: "30%" },
                                },
                                {
                                    label: "Sound Effects Volume",
                                    key: "audioVolume",
                                    type: "slider",
                                    style: { width: "60%" },
                                    min: 0,
                                    max: 100,
                                    help: "Volume level of the app sound effects",
                                },
                                {
                                    key: "placeholder2",
                                    type: "message",
                                    style: { width: "30%" },
                                },
                                {
                                    label: "Audio Preferred Language",
                                    key: "audioLanguage",
                                    type: "dropdown",
                                    style: { width: "50%" },
                                    options: getTracksLanguageArray(),
                                    help: "Sets the preferred language for audio tracks in video playback",
                                },
                                {
                                    key: "placeholder3",
                                    type: "message",
                                    style: { width: "30%" },
                                },
                                {
                                    label: "Mute Audio",
                                    key: "muted",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Mute Video, Audio and Sound Effects",
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
                            label: "Localization Settings",
                            fields: [
                                {
                                    label: "Language",
                                    key: "locale",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getLocaleIdArray(),
                                    help: "Configure the current locale, this setting only affects BrightScript apps not the simulator UI",
                                },
                                {
                                    key: "placeholder1",
                                    type: "message",
                                    style: { width: "30%" },
                                },
                                {
                                    label: "Device Country",
                                    key: "countryCode",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getCountryArray(),
                                    help: "Configure the device country (app store), this is returned by ifDeviceInfo.GetCountryCode()",
                                },
                                {
                                    key: "placeholder2",
                                    type: "message",
                                    style: { width: "30%" },
                                },
                                {
                                    label: "Time Zone",
                                    key: "timeZone",
                                    style: { width: "40%" },
                                    type: "dropdown",
                                    options: getTimezoneArray(),
                                },
                                {
                                    key: "placeholder3",
                                    type: "message",
                                    style: { width: "30%" },
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
                            ],
                        },
                    ],
                },
            },
            {
                id: "captions",
                label: "Captioning",
                icon: "closed-caption",
                form: {
                    groups: [
                        {
                            fields: [
                                {
                                    label: "Captions Mode",
                                    key: "captionMode",
                                    type: "radio",
                                    style: { width: "25%" },
                                    options: [
                                        {
                                            value: "Off",
                                            label: "Off",
                                        },
                                        {
                                            value: "On",
                                            label: "On Always",
                                        },
                                        {
                                            value: "Instant replay",
                                            label: "On Replay",
                                        },
                                        {
                                            value: "When mute",
                                            label: "On Mute",
                                        },
                                    ],
                                },
                                {
                                    label: "Preferred Language",
                                    key: "captionLanguage",
                                    type: "dropdown",
                                    style: { width: "70%" },
                                    options: getTracksLanguageArray(),
                                    help: "Sets the preferred language for closed caption tracks in video playback",
                                },
                                {
                                    label: "Text Style",
                                    key: "textFont",
                                    type: "dropdown",
                                    options: getTextFontArray(),
                                },
                                {
                                    label: "Text Edge Effect",
                                    key: "textEffect",
                                    type: "dropdown",
                                    options: getTextEffectArray(),
                                },
                                {
                                    label: "Text Size",
                                    key: "textSize",
                                    type: "dropdown",
                                    options: getTextSizeArray(),
                                },
                                {
                                    label: "Text Color",
                                    key: "textColor",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getCaptionColorArray(),
                                },
                                {
                                    label: "Text Opacity",
                                    key: "textOpacity",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getTextOpacityArray(),
                                },
                                {
                                    label: "Background Color",
                                    key: "backgroundColor",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getCaptionColorArray(),
                                },
                                {
                                    label: "Background Opacity",
                                    key: "backgroundOpacity",
                                    type: "dropdown",
                                    style: { width: "40%" },
                                    options: getBackgroundOpacityArray(),
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "peerRoku",
                label: "Peer Roku",
                icon: __dirname + "/images/svg/roku-logo.svg",
                form: {
                    groups: [
                        {
                            label: "Peer Roku Device",
                            fields: [
                                {
                                    key: "deploy",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Deploy App to peer Roku device",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "If enabled, the simulator will side load the app on the peer Roku device in parallel",
                                },
                                {
                                    label: "Roku Device",
                                    key: "ip",
                                    type: "dropdown",
                                    style: { width: "100%" },
                                    options: getRokuDeviceOptions(),
                                    help: "Select a discovered Roku device or choose manual entry",
                                },
                                {
                                    label: "Manual IP Address",
                                    key: "manualIp",
                                    type: "text",
                                    style: { width: "40%" },
                                    help: "Enter the IP address when Manual Entry is selected",
                                },
                                {
                                    key: "placeholder1",
                                    type: "message",
                                    style: { width: "40%" },
                                },
                                {
                                    label: "Installer Password (default: rokudev)",
                                    key: "password",
                                    type: "text",
                                    inputType: "password",
                                    style: { width: "40%" },
                                },
                                {
                                    key: "placeholder2",
                                    type: "message",
                                    style: { width: "40%" },
                                },
                                {
                                    key: "syncControl",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Synchronize Remote Control with Roku device",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "If enabled, the simulator will replicate all pressed control keys on the peer Roku device",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                id: "deepLinking",
                label: "Deep Linking",
                icon: __dirname + "/images/svg/deep-link.svg",
                form: {
                    groups: [
                        {
                            label: "Deep Linking",
                            fields: [
                                {
                                    key: "sendInput",
                                    type: "checkbox",
                                    options: [
                                        {
                                            label: "Send Deep Linking input parameters when executing an app",
                                            value: "enabled",
                                        },
                                    ],
                                    help: "If enabled, the simulator will send the input parameters listed below, as deep links, when an app is launched",
                                },
                                {
                                    label: "Input Parameters Map",
                                    key: "inputMap",
                                    type: "map",
                                    keyLabel: "Key",
                                    valueLabel: "Value",
                                    addButtonLabel: "Add Parameter",
                                    help: "Key-value pairs for deep linking input parameters",
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });
    updatePeerRokuFieldOptions();
    settings.on("save", (preferences) => {
        saveSimulatorSettings(preferences.simulator.options, window);
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
            setDeviceInfo("audio", "audioLanguage", true);
            window.webContents.send("setAudioMute", preferences.audio.muted[0]);
        }
        if (preferences.localization) {
            const localeId = preferences.localization.locale;
            if (localeId === "") {
                setPreference("localization.locale", globalThis.sharedObject.deviceInfo.locale);
            } else if (globalThis.sharedObject.deviceInfo.locale !== localeId) {
                setDeviceInfo("localization", "locale", true);
                checkMenuItem(localeId, true);
            }
            setDeviceInfo("localization", "clockFormat", true);
            setDeviceInfo("localization", "countryCode", true);
            setTimeZone(true);
        }
        if (preferences.captions) {
            setDeviceInfo("captions", "captionMode", true);
            setDeviceInfo("captions", "captionLanguage", true);
            saveCaptionStyle();
        }
    });
    nativeTheme.on("updated", () => {
        if (settings.value("simulator.theme") === "system") {
            const userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
            window.webContents.send("setTheme", userTheme);
            globalThis.sharedObject.theme = userTheme;
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
    if (remote.keyRev === "") {
        settings.value("remote.keyRev", defaults.keyRev);
    } else if (defaults.keyRev !== remote.keyRev) {
        customKeys.set(convertKey(remote.keyRev), "rev");
    }
    if (remote.keyFwd === "") {
        settings.value("remote.keyFwd", defaults.keyFwd);
    } else if (defaults.keyFwd !== remote.keyFwd) {
        customKeys.set(convertKey(remote.keyFwd), "fwd");
    }
    if (remote.keyMute === "") {
        settings.value("remote.keyMute", defaults.keyMute);
    } else if (defaults.keyMute !== remote.keyMute) {
        customKeys.set(convertKey(remote.keyMute), "volumemute");
    }
    if (customKeys.size > 0) {
        const window = BrowserWindow.fromId(1);
        if (window) {
            window.webContents.send("setCustomKeys", customKeys);
        }
    }
}

export async function showSettings() {
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
        const userTheme = globalThis.sharedObject.theme;
        if (isWindows) {
            settings.browserWindowOverrides.titleBarOverlay = getTitleOverlayTheme(userTheme);
        }
    }

    updatePeerRokuFieldOptions();
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
            const options = settings.value("simulator.options");
            if (options) {
                checkMenuItem("on-top", options.includes("alwaysOnTop"));
                checkMenuItem("status-bar", options.includes("statusBar"));
            }
            const userTheme = settings.value("simulator.theme");
            checkMenuItem(`theme-${userTheme}`, true);
            const peerRoku = getPeerRoku();
            checkMenuItem("peer-roku-deploy", peerRoku.deploy);
            checkMenuItem("peer-roku-control", peerRoku.syncControl);
        }
    });
}

export function closeSettings() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close();
    }
}

export function setPreference(key, value) {
    settings.value(key, value);
}

export function setDeviceInfo(section, key, notifyApp) {
    const oldValue = globalThis.sharedObject.deviceInfo[key];
    const newValue = settings.value(`${section}.${key}`);
    if (newValue && newValue !== oldValue) {
        globalThis.sharedObject.deviceInfo[key] = newValue;
        if (notifyApp) {
            const window = BrowserWindow.fromId(1);
            window?.webContents.send("setDeviceInfo", key, newValue);
        }
    }
}

export function saveCaptionStyle() {
    const window = BrowserWindow.fromId(1);
    const captionStyle = globalThis.sharedObject.deviceInfo.captionStyle;
    if (Array.isArray(captionStyle)) {
        // Map of caption preference keys to their corresponding style IDs
        const captionStyleMappings = [
            { id: "text/font", preference: "textFont" },
            { id: "text/effect", preference: "textEffect" },
            { id: "text/size", preference: "textSize" },
            { id: "text/color", preference: "textColor" },
            { id: "text/opacity", preference: "textOpacity" },
            { id: "background/color", preference: "backgroundColor" },
            { id: "background/opacity", preference: "backgroundOpacity" },
        ];
        // Update or add each caption style setting
        for (const mapping of captionStyleMappings) {
            const preferenceValue = settings.preferences.captions[mapping.preference];
            if (preferenceValue) {
                const index = captionStyle.findIndex((style) => style.id === mapping.id);
                if (index !== -1) {
                    captionStyle[index].style = preferenceValue;
                } else {
                    captionStyle.push({ id: mapping.id, style: preferenceValue });
                }
            }
        }
        window.webContents.send("setCaptionStyle", captionStyle);
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
    if (option in globalThis.sharedObject.deviceInfo) {
        globalThis.sharedObject.deviceInfo[option] = mode;
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
        settings.value("simulator.theme", userTheme);
    } else {
        userTheme = settings.value("simulator.theme");
    }
    checkMenuItem(`theme-${userTheme}`, true);
    let systemTheme = userTheme === "purple" ? "system" : userTheme;
    nativeTheme.themeSource = systemTheme;
    if (userTheme === "system") {
        userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    globalThis.sharedObject.theme = userTheme;
    if (notifyApp) {
        const window = BrowserWindow.fromId(1);
        window.webContents.send("setTheme", userTheme);
        window.webContents.send("refreshMenu");

        if (isWindows) {
            const titleTheme = getTitleOverlayTheme(userTheme);
            settingsWindow?.setTitleBarOverlay(titleTheme);
            const allWindows = BrowserWindow.getAllWindows();
            allWindows.some((window) => {
                if (window.getURL().endsWith("editor.html")) {
                    window.setTitleBarOverlay(titleTheme);
                    return true;
                }
            });
        }
    }
    return userTheme;
}

export function getSimulatorOption(key) {
    const options = settings.value("simulator.options");
    return options?.includes(key) ?? false;
}

export function getDeepLink() {
    const sendInput = settings.value("deepLinking.sendInput");
    if (!sendInput?.includes("enabled")) {
        return {};
    }
    return settings.value("deepLinking.inputMap") || {};
}

export function setSimulatorOption(key, enable, menuId) {
    let options = settings.value("simulator.options");
    if (options) {
        if (enable && !options.includes(key)) {
            options.push(key);
        } else if (!enable && options.includes(key)) {
            options = options.filter((item) => item !== key);
        }
        settings.value("simulator.options", options);
        if (menuId) {
            checkMenuItem(menuId, enable);
        }
    }
}

export function getDisplayOption(key) {
    const options = settings.value("display.options");
    return options?.includes(key) ?? false;
}

export function setDisplayCheckboxOption(key, enable, menuId) {
    let options = settings.value("display.options");
    if (options) {
        if (enable && !options.includes(key)) {
            options.push(key);
        } else if (!enable && options.includes(key)) {
            options = options.filter((item) => item !== key);
        }
        settings.value("display.options", options);
        if (menuId) {
            checkMenuItem(menuId, enable);
        }
    }
}

export function setPeerRoku(key, enable, menuId) {
    let options = settings.value("peerRoku");
    if (options) {
        if (enable && !options[key]?.length) {
            settings.value(`peerRoku.${key}`, ["enabled"]);
        } else if (!enable && options[key]?.length) {
            settings.value(`peerRoku.${key}`, []);
        }
        if (menuId) {
            checkMenuItem(menuId, enable);
        }
    }
}

export function getPeerRoku() {
    const selectedIp = settings.value("peerRoku.ip");
    const manualIp = settings.value("peerRoku.manualIp");
    const resolvedIp = !selectedIp || selectedIp === "manual" ? manualIp : selectedIp;
    return {
        deploy: settings.value("peerRoku.deploy")?.includes("enabled") || false,
        ip: resolvedIp || "",
        friendlyName: getRokuDeviceNameByIp(resolvedIp),
        username: DEFAULT_USRPWD,
        password: settings.value("peerRoku.password"),
        syncControl: settings.value("peerRoku.syncControl")?.includes("enabled") || false,
    };
}

export function getRokuDeviceNameByIp(ip) {
    const device = discoveredDevices.get(ip);
    return device ? device.friendlyName || device.deviceModel : "";
}

export function setLocaleId(locale) {
    setPreference("localization.locale", locale);
    setDeviceInfo("localization", "locale", true);
}

export function setTimeZone(notifyApp) {
    let timeZone = settings.value("localization.timeZone");
    if (timeZone) {
        const di = globalThis.sharedObject.deviceInfo;
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

ipcMain.on("setCaptionMode", (event, mode) => {
    globalThis.sharedObject.deviceInfo.captionMode = mode;
    setPreference("captions.captionMode", mode);
});

ipcMain.on("deviceData", (_, deviceData) => {
    if (deviceData) {
        const appDeviceInfo = globalThis.sharedObject.deviceInfo;
        for (const key of Object.keys(deviceData)) {
            const ignoreKeys = ["audioCodecs", "fonts", "fontPath", "defaultFont", "appList"];
            if (!ignoreKeys.includes(key) && !(key in appDeviceInfo)) {
                appDeviceInfo[key] = deviceData[key];
                if (key === "models" && appDeviceInfo.models?.size) {
                    const deviceSection = settings.options.sections.find((s) => s.id === "device");
                    if (deviceSection) {
                        const deviceModelField = deviceSection.form.groups
                            .flatMap((g) => g.fields)
                            .find((f) => f.key === "deviceModel");
                        if (deviceModelField) {
                            deviceModelField.options = getRokuModelArray();
                        }
                    }
                }
            }
        }
    }
});

ipcMain.on("serialNumber", (_, serialNumber) => {
    globalThis.sharedObject.deviceInfo.serialNumber = serialNumber;
});

export function getModelName(model) {
    const modelName = globalThis.sharedObject.deviceInfo.models.get(model);
    return modelName ? modelName[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`;
}

export function updateServerStatus(service, menuItem, enabled, port) {
    setPreference(`services.${service.toLowerCase()}`, enabled ? ["enabled"] : []);
    checkMenuItem(menuItem, enabled);
    const window = BrowserWindow.fromId(1);
    window?.webContents.send("serverStatus", service, enabled, port);
    window?.webContents.send("refreshMenu");
}

// Settings Helper Functions

function saveSimulatorSettings(options, window) {
    if (options) {
        const onTop = options.includes("alwaysOnTop");
        const statusBar = options.includes("statusBar");
        const homeScreenMode = !options.includes("disableHomeScreen");
        checkMenuItem("on-top", onTop);
        window.setAlwaysOnTop(onTop);
        if (statusBarVisible != statusBar) {
            checkMenuItem("status-bar", statusBar);
            setStatusBar(statusBar);
        }
        window.webContents.send("setHomeScreenMode", homeScreenMode);
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
    const oldValue = globalThis.sharedObject.deviceInfo.displayMode;
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

    // Handle display options (perfStats, keepDisplayOnExit)
    const displayOptions = settings.value("display.options");
    if (displayOptions) {
        const perfStats = displayOptions.includes("perfStats");
        window.webContents.send("setPerfStats", perfStats);
    }
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
            ["`", "Backquote"],
            ["-", "Minus"],
            ["=", "Equal"],
            ["[", "BracketLeft"],
            ["]", "BracketRight"],
            [";", "Semicolon"],
            ["'", "quote"],
            [",", "Comma"],
            [".", "Period"],
            ["\\", "Backslash"],
            ["/", "Slash"],
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

export function getTitleOverlayTheme(userTheme) {
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
    if (globalThis.sharedObject.deviceInfo?.models?.size) {
        for (const [key, value] of globalThis.sharedObject.deviceInfo.models) {
            modelArray.push({ label: `${value[0]} - ${key}`, value: key });
        }
    }
    return modelArray;
}

function getLocaleIdArray() {
    return [
        { label: "US English (en-US)", value: "en_US" },
        { label: "British English (en-GB)", value: "en_GB" },
        { label: "Australian English (en-AU)", value: "en_AU" },
        { label: "Canadian English (en-CA)", value: "en_CA" },
        { label: "Canadian French (fr-CA)", value: "fr_CA" },
        { label: "International Spanish (es-ES)", value: "es_ES" },
        { label: "Mexican Spanish (es-MX)", value: "es_MX" },
        { label: "German (de-DE)", value: "de_DE" },
        { label: "Italian (it-IT)", value: "it_IT" },
        { label: "Brazilian Portuguese (pt-BR)", value: "pt_BR" },
    ];
}
function getTextFontArray() {
    return [
        { label: "Default", value: "default" },
        { label: "Serif fixed width", value: "serif fixed width" },
        { label: "Serif proportional", value: "serif proportional" },
        { label: "Sans Serif fixed width", value: "sans serif fixed width" },
        { label: "Sans Serif proportional", value: "sans serif proportional" },
        { label: "Casual", value: "casual" },
        { label: "Cursive", value: "cursive" },
        { label: "Small Caps", value: "small caps" },
    ];
}
function getTextEffectArray() {
    return [
        { label: "Default", value: "default" },
        { label: "None", value: "none" },
        { label: "Raised", value: "raised" },
        { label: "Depressed", value: "depressed" },
        { label: "Uniform", value: "uniform" },
        { label: "Drop shadow (left)", value: "drop shadow (left)" },
        { label: "Drop shadow (right)", value: "drop shadow (right)" },
    ];
}
function getTextSizeArray() {
    return [
        { label: "Default", value: "default" },
        { label: "Extra Large", value: "extra large" },
        { label: "Large", value: "large" },
        { label: "Medium", value: "medium" },
        { label: "Small", value: "small" },
        { label: "Small", value: "small" },
        { label: "Extra Small", value: "extra small" },
    ];
}
function getCaptionColorArray() {
    return [
        { label: "Default", value: "default" },
        { label: "Bright White", value: "bright white" },
        { label: "White", value: "white" },
        { label: "Black", value: "black" },
        { label: "Red", value: "red" },
        { label: "Green", value: "green" },
        { label: "Blue", value: "blue" },
        { label: "Yellow", value: "yellow" },
        { label: "Magenta", value: "magenta" },
        { label: "Cyan", value: "cyan" },
    ];
}
function getTextOpacityArray() {
    return [
        { label: "Default", value: "default" },
        { label: "25%", value: "25%" },
        { label: "50%", value: "50%" },
        { label: "75%", value: "75%" },
        { label: "100%", value: "100%" },
    ];
}
function getBackgroundOpacityArray() {
    return [
        { label: "Default", value: "default" },
        { label: "Off", value: "off" },
        { label: "25%", value: "25%" },
        { label: "50%", value: "50%" },
        { label: "75%", value: "75%" },
        { label: "100%", value: "100%" },
    ];
}

function getTracksLanguageArray() {
    return [
        { label: "English", value: "en" },
        { label: "Spanish (español)", value: "es" },
        { label: "French (français)", value: "fr" },
        { label: "German (deutsch)", value: "de" },
        { label: "Italian (italiano)", value: "it" },
        { label: "Portuguese (português)", value: "pt" },
        { label: "Russian (русский)", value: "ru" },
        { label: "Turkish (Türkçe)", value: "tr" },
        { label: "Polish (polski)", value: "pl" },
        { label: "Ukrainian (українська)", value: "uk" },
        { label: "Romansh (rumantsch)", value: "rm" },
        { label: "Dutch (Nederlands)", value: "nl" },
        { label: "Croatian (hrvatski)", value: "hr" },
        { label: "Hungarian (magyar)", value: "hu" },
        { label: "Greek (ελληνικά)", value: "el" },
        { label: "Czech (čeština)", value: "cs" },
        { label: "Swedish (svenska)", value: "sv" },
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

function getTimezoneArray() {
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
    for (const item of tzArray) {
        timeZoneLabels.set(item.value || item.label, item.label);
    }
    return tzArray;
}

// Peer Roku Device Discovery
function updatePeerRokuFieldOptions() {
    if (peerRokuOptionsTimer) {
        return;
    }
    peerRokuOptionsTimer = setTimeout(() => {
        peerRokuOptionsTimer = null;
        applyPeerRokuFieldOptions();
    }, 50);
}

function applyPeerRokuFieldOptions() {
    if (!settings?.options?.sections) {
        return;
    }
    const peerSection = settings.options.sections.find((section) => section.id === "peerRoku");
    if (!peerSection?.form?.groups) {
        return;
    }
    const targetField = peerSection.form.groups
        .flatMap((group) => group.fields || [])
        .find((field) => field.key === "ip");
    if (targetField) {
        const newOptions = getRokuDeviceOptions();
        const previousOptions = targetField.options || [];
        const optionsChanged = JSON.stringify(previousOptions) !== JSON.stringify(newOptions);
        targetField.options = newOptions;
        if (optionsChanged && typeof settings?.broadcastSections === "function") {
            settings.broadcastSections();
        }
    }
}

// SSDP discovery helpers
function getRokuDeviceOptions() {
    const options = [{ label: "Manual Entry", value: "manual" }];

    for (const [ip, device] of discoveredDevices) {
        const friendlyName = device.friendlyName?.trim();
        const primaryName = (friendlyName || device.modelName || "Roku Device").trim();
        const detailParts = [];
        if (device.modelNumber) {
            const modelNumber = device.modelNumber.trim();
            if (modelNumber) {
                detailParts.push(modelNumber);
            }
        }
        if (device.firmware) {
            const firmwareTrimmed = device.firmware.trim();
            if (firmwareTrimmed) {
                detailParts.push(`OS ${firmwareTrimmed}`);
            }
        }
        if (device.serialNumber) {
            const serialTrimmed = device.serialNumber.trim();
            if (serialTrimmed) {
                detailParts.push(serialTrimmed);
            }
        }

        const detailSuffix = detailParts.length ? ` · ${detailParts.join(" · ")}` : "";
        const label = `${primaryName}${detailSuffix} (${ip})`;
        if (!app.isPackaged) {
            console.log(`Discovered Roku device: ${label}`);
        }
        options.push({ label, value: ip });
    }

    return options;
}

function extractFirmwareFromServer(serverHeader) {
    if (!serverHeader) {
        return "";
    }
    const match = serverHeader.match(/Roku\/[\d.]+\s+UPnP\/[\d.]+\s+Roku\/([^(]+)/);
    return match ? match[1].trim() : "";
}

function extractSerialNumberFromUSN(usnHeader) {
    if (!usnHeader) {
        return "";
    }
    const match = usnHeader.match(/uuid:roku:ecp:([^:]+)/i);
    return match ? match[1] : "";
}

function normalizeIpAddress(ipAddress) {
    if (!ipAddress) {
        return "";
    }
    return ipAddress.startsWith("::ffff:") ? ipAddress.slice(7) : ipAddress;
}

function stopSsdpClient(client) {
    if (!client) {
        return;
    }
    try {
        client.stop();
    } catch (error) {
        console.warn(`Unable to stop SSDP client: ${error.message}`);
    }
}

function isRokuDiscoveryResponse(headers) {
    if (!headers) {
        return false;
    }
    const serviceType = headers.ST?.toLowerCase() ?? "";
    const uniqueServiceName = headers.USN?.toLowerCase() ?? "";
    return serviceType.includes("roku:ecp") || uniqueServiceName.includes("roku:ecp");
}

async function discoverRokuDevices() {
    return new Promise((resolve) => {
        const metadataFetches = [];
        try {
            localIps = getLocalIps()
                .map((entry) => entry.split(",")[1])
                .filter(Boolean);
        } catch (error) {
            console.error(`Unable to read local IP addresses: ${error.message}`);
            localIps = [];
        }

        discoveredDevices.clear();
        pendingMetadataRequests.clear();
        if (!app.isPackaged) {
            console.log("Searching for Roku devices on the local network...");
        }

        if (ssdpClient) {
            stopSsdpClient(ssdpClient);
            ssdpClient = undefined;
        }

        const client = new SSDPClient();
        ssdpClient = client;

        client.on("response", (headers, _statusCode, rinfo) => {
            if (!headers?.LOCATION || !isRokuDiscoveryResponse(headers)) {
                return;
            }
            const deviceIP = normalizeIpAddress(rinfo.address);
            if (!deviceIP) {
                return;
            }
            if (localIps.includes(deviceIP)) {
                return;
            }

            const previousDevice = discoveredDevices.get(deviceIP);
            const hadMetadata = Boolean(previousDevice?.metadataFetched);
            const serialNumber = extractSerialNumberFromUSN(headers.USN);
            const firmwareFromServer = extractFirmwareFromServer(headers.SERVER);

            const mergedDevice = {
                ...previousDevice,
                ip: deviceIP,
                location: headers.LOCATION ?? previousDevice?.location,
                server: headers.SERVER ?? previousDevice?.server,
                usn: headers.USN ?? previousDevice?.usn,
                serialNumber: serialNumber || previousDevice?.serialNumber,
                firmware: firmwareFromServer,
                metadataFetched: hadMetadata,
            };

            discoveredDevices.set(deviceIP, mergedDevice);

            if (
                !previousDevice &&
                !mergedDevice.metadataFetched &&
                !pendingMetadataRequests.has(deviceIP)
            ) {
                pendingMetadataRequests.add(deviceIP);
                const metadataPromise = getDeviceMetadata(deviceIP, serialNumber)
                    .then((details) => {
                        updateDeviceMetadata(deviceIP, mergedDevice, details);
                    })
                    .finally(() => {
                        pendingMetadataRequests.delete(deviceIP);
                    });
                metadataFetches.push(metadataPromise);
            }
        });

        client.on("error", (error) => {
            const message = `SSDP discovery error: ${error.message}`;
            console.error(message);
            sendRokuDiscoveryLog(message, true);
        });

        client.search("roku:ecp");
        setTimeout(() => {
            try {
                client.search("urn:roku-com:device:player:1");
            } catch (error) {
                console.error(`SSDP discovery retry failed: ${error.message}`);
            }
        }, 1000);

        setTimeout(() => {
            stopSsdpClient(client);
            if (ssdpClient === client) {
                ssdpClient = undefined;
            }
            const finalize = () => {
                if (peerRokuOptionsTimer) {
                    clearTimeout(peerRokuOptionsTimer);
                    peerRokuOptionsTimer = null;
                }
                applyPeerRokuFieldOptions();
                if (discoveredDevices.size === 0 && !app.isPackaged) {
                    console.warn("No Roku devices found on the local network.");
                }
                resolve(discoveredDevices.size);
            };
            if (metadataFetches.length > 0) {
                Promise.allSettled(metadataFetches).then(finalize).catch(finalize);
            } else {
                finalize();
            }
        }, 5000);
    });
}

export async function initRokuDeviceDiscovery() {
    try {
        return await discoverRokuDevices();
    } catch (error) {
        console.error(`Failed to discover Roku devices: ${error.message}`);
        return 0;
    }
}

// Update the stored device metadata with new details
function updateDeviceMetadata(deviceIP, mergedDevice, details) {
    const normalizedDetailsIp = normalizeIpAddress(details?.ipAddr);
    const deviceKey =
        normalizedDetailsIp && discoveredDevices.has(normalizedDetailsIp)
            ? normalizedDetailsIp
            : deviceIP;
    const baseDevice = discoveredDevices.get(deviceKey) || mergedDevice;
    const nextFriendly = details?.friendlyName?.trim();
    const nextModel = details?.modelName?.trim();
    const nextModelNumber = details?.modelNumber?.trim();
    const storedDevice = {
        ...baseDevice,
        ip: normalizedDetailsIp || deviceKey,
        modelName: nextModel || baseDevice.modelName,
        modelNumber: nextModelNumber || baseDevice.modelNumber,
        friendlyName: nextFriendly || baseDevice.friendlyName || baseDevice.modelName,
        metadataFetched: Boolean(nextModel || nextModelNumber || nextFriendly),
    };
    discoveredDevices.set(deviceKey, storedDevice);
}

// Send an ECP request to the device to get its details and return a promise with the metadata
function getDeviceMetadata(ipAddr, serialNumber) {
    let host = ipAddr;
    let port = 8060;
    const deviceEntry = discoveredDevices.get(ipAddr);
    if (deviceEntry?.location) {
        try {
            const locationUrl = new URL(deviceEntry.location);
            host = locationUrl.hostname || host;
            port = Number(locationUrl.port) || port;
        } catch (error) {
            console.warn(
                `Unable to parse Roku device location ${deviceEntry.location}: ${error.message}`
            );
        }
    }
    const options = {
        host,
        port,
        path: "/query/device-info",
        method: "GET",
        timeout: 2000,
    };
    const bufferList = [];
    return new Promise((resolve) => {
        const request = http.request(options, (res) => {
            res.on("data", (chunk) => {
                bufferList.push(chunk);
            });
            res.on("end", () => {
                const response = Buffer.concat(bufferList).toString("utf8");
                const resolvedIp = normalizeIpAddress(res.socket?.remoteAddress) || ipAddr;
                const details = parseDeviceMetadata(resolvedIp, serialNumber, response);
                resolve(details);
            });
        });

        request.on("timeout", () => {
            request.destroy(new Error("Request timeout"));
        });

        request.on("error", (error) => {
            const message = `Failed to retrieve Roku device details from ${ipAddr}: ${error.message}`;
            console.error(message);
            sendRokuDiscoveryLog(message, true);
            resolve({
                ipAddr,
                serialNumber: serialNumber || "",
                friendlyName: "",
                modelNumber: "",
                modelName: "",
            });
        });

        request.end();
    });
}

function parseDeviceMetadata(ipAddr, sn, data) {
    if (!data) {
        return {
            ipAddr,
            serialNumber: sn || "",
            friendlyName: "",
            modelNumber: "",
            modelName: "",
        };
    }
    const serialNumber =
        sn ||
        extractAny(
            [/<serial-number>(.*?)<\/serial-number>/i, /<serialNumber>(.*?)<\/serialNumber>/i],
            data
        );
    const friendlyName = extractAny(
        [
            /<friendly-device-name>(.*?)<\/friendly-device-name>/i,
            /<user-device-name>(.*?)<\/user-device-name>/i,
        ],
        data
    );
    const modelNumber = extractAny(
        [/<model-number>(.*?)<\/model-number>/i, /<modelNumber>(.*?)<\/modelNumber>/i],
        data
    );
    const modelName = extractAny(
        [/<model-name>(.*?)<\/model-name>/i, /<friendly-model-name>(.*?)<\/friendly-model-name>/i],
        data
    );

    return {
        ipAddr,
        serialNumber,
        friendlyName,
        modelNumber,
        modelName,
    };
}

// Use a regular expression to extract a field from some data,
// returning an empty string if the field is not found
function extract(re, data) {
    const match = re.exec(data);
    return Array.isArray(match) && match.length === 2 ? match[1].trim() : "";
}

function extractAny(patterns, data) {
    for (const pattern of patterns) {
        const value = extract(pattern, data);
        if (value) {
            return value;
        }
    }
    return "";
}
