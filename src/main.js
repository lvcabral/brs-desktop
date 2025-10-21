/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import url from "node:url";
import dns from "node:dns";
import minimist from "minimist";
import jetpack from "fs-jetpack";
import { app, screen, BrowserWindow } from "electron";
import { DateTime } from "luxon";
import { setPassword, setPort, enableInstaller } from "./server/installer";
import { initECP, enableECP } from "./server/ecp";
import { enableTelnet } from "./server/telnet";
import { randomUUID } from "node:crypto";
import { ECP_PORT, TELNET_PORT } from "./constants";
import {
    createMenu,
    enableMenuItem,
    checkMenuItem,
    isMenuItemEnabled,
    getAppList,
    updateAppList,
} from "./menu/menuService";
import { loadFile } from "./helpers/files";
import {
    getPeerRoku,
    getSettings,
    setDeviceInfo,
    setDisplayOption,
    setRemoteKeys,
    setThemeSource,
    setTimeZone,
    saveCaptionStyle,
    updateServerStatus,
} from "./helpers/settings";
import {
    createWindow,
    openCodeEditor,
    openDevTools,
    setAspectRatio,
    saveWindowState,
} from "./helpers/window";
import { subscribeServerEvents } from "./helpers/events";
import { getGateway, getLocalIps } from "./helpers/util";
import { setupTitlebar, attachTitlebarToWindow } from "custom-electron-titlebar/main";

const isMacOS = process.platform === "darwin";

require("@electron/remote/main").initialize();

// Device Information Object
const dt = DateTime.now().setZone("system");
const localIps = getLocalIps();
const deviceInfo = {
    developerId: "brs-dev-id", // Unique id to segregate registry data
    friendlyName: app.getName(),
    deviceModel: "4200X",
    clientId: randomUUID(), // Unique identifier of the device
    RIDA: randomUUID(), // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: dt.zoneName,
    timeZoneIANA: dt.zoneName,
    timeZoneAuto: true,
    timeZoneOffset: dt.offset,
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Options are: 480p (SD), 720p (HD), 1080p (FHD)
    captionMode: "Off",
    captionStyle: [],
    captionLanguage: "en",
    connectionInfo: {
        type: "WiredConnection",
        name: localIps[0].split(",")[0],
        gateway: "127.0.0.1",
        dns: dns.getServers(),
        quality: "Excellent",
    },
    localIps: localIps,
    startTime: Date.now(),
    maxSimulStreams: 2,
    audioVolume: 50,
    audioLanguage: "en",
    appList: getAppList(),
};

// Get Network Gateway
getGateway().then((gateway) => {
    if (gateway.ip !== "") {
        deviceInfo.connectionInfo.gateway = gateway.ip;
        deviceInfo.connectionInfo.name = gateway.name;
        deviceInfo.connectionInfo.type = gateway.type;
        deviceInfo.connectionInfo.ssid = gateway.ssid;
        const window = BrowserWindow.fromId(1);
        window?.webContents.send("setDeviceInfo", "connectionInfo", deviceInfo.connectionInfo);
    }
});

// Parse CLI parameters
const argv = minimist(process.argv.slice(1), {
    string: ["o", "p", "m"],
    boolean: ["c", "d", "e", "f", "r"],
    alias: {
        c: "console",
        d: "devtools",
        e: "ecp",
        f: "fullscreen",
        w: "web",
        p: "pwd",
        m: "mode",
        r: "rc",
    },
});

app.on("ready", () => {
    // setup the titlebar main process
    setupTitlebar();
    createMenu();
    // Shared Object with Front End
    globalThis.sharedObject = {
        theme: "purple",
        backgroundColor: "#251135",
        deviceInfo: deviceInfo,
    };
    updateAppList();
    // Create Main Window
    let mainWindow = createWindow("main", {
        width: 1280,
        height: 770,
        backgroundColor: globalThis.sharedObject.backgroundColor,
    });
    // Configure Window and load content
    const winBounds = mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
    mainWindow.setMinimumSize(
        Math.min(346, display.size.width),
        Math.min(264, display.size.height)
    );
    let firstLoad = true;
    // Load application settings
    const startup = {
        devTools: false,
        console: false,
        runLastChannel: false,
        ecpEnabled: false,
        telnetEnabled: false,
        installerEnabled: false,
    };
    loadSettings(mainWindow, startup);
    // Initialize ECP and SSDP servers
    initECP();
    // Load Renderer
    mainWindow
        .loadURL(
            url.format({
                pathname: path.join(__dirname, "index.html"),
                protocol: "file:",
                slashes: true,
            })
        )
        .then(() => {
            firstLoad = false;
            attachTitlebarToWindow(mainWindow);
            processArgv(mainWindow, startup);
            mainWindow.show();
            mainWindow.focus({ steal: true });
        });
    mainWindow.webContents.on("dom-ready", () => {
        let settings = getSettings(mainWindow);
        const status = "enabled";
        if (!firstLoad) {
            updateServerStatus(
                "ECP",
                "ecp-api",
                settings.value("services.ecp").includes(status),
                ECP_PORT
            );
            updateServerStatus(
                "Telnet",
                "telnet",
                settings.value("services.telnet").includes(status),
                TELNET_PORT
            );
            updateServerStatus(
                "Installer",
                "web-installer",
                settings.value("services.installer").includes(status),
                settings.value("services.webPort")
            );
        }
        if (settings.preferences.remote) {
            setRemoteKeys(settings.defaults.remote, settings.preferences.remote);
        }
    });
    setupEvents(mainWindow);
    subscribeServerEvents();
});

// Load Settings
function loadSettings(mainWindow, startup) {
    // Load Simulator Settings
    const settings = getSettings(mainWindow);
    if (settings.preferences.simulator) {
        if (settings.value("simulator.options")) {
            const options = settings.value("simulator.options");
            const onTop = options.includes("alwaysOnTop");
            checkMenuItem("on-top", onTop);
            mainWindow.setAlwaysOnTop(onTop);
            checkMenuItem("status-bar", options.includes("statusBar"));
            startup.runLastChannel = options.includes("runLastChannel");
            startup.devTools = options.includes("devToolsStartup");
            startup.console = options.includes("consoleStartup");
        }
        setThemeSource();
    }
    if (settings.preferences.services) {
        startup.ecpEnabled = settings.value("services.ecp").includes("enabled");
        startup.telnetEnabled = settings.value("services.telnet").includes("enabled");
        startup.installerEnabled = settings.value("services.installer").includes("enabled");
        setPassword(settings.value("services.password"));
        setPort(settings.value("services.webPort"));
    }
    if (settings.preferences.device) {
        setDeviceInfo("device", "deviceModel");
        setDeviceInfo("device", "clientId");
        setDeviceInfo("device", "RIDA");
        setDeviceInfo("device", "developerId");
    }
    if (settings.preferences.display) {
        setDisplayOption("displayMode");
        setAspectRatio(settings.value("display.displayMode"), false);
        const overscanMode = settings.value("display.overscanMode");
        checkMenuItem(overscanMode, true);
        setDeviceInfo("display", "maxFps");
    }
    if (settings.preferences.audio) {
        setDeviceInfo("audio", "maxSimulStreams");
        setDeviceInfo("audio", "audioVolume");
        setDeviceInfo("audio", "audioLanguage");
    }
    if (settings.preferences.localization) {
        const localeId = settings.value("localization.locale");
        if (localeId) {
            deviceInfo.locale = localeId;
            checkMenuItem(localeId, true);
        }
        setDeviceInfo("localization", "clockFormat");
        setDeviceInfo("localization", "countryCode");
        setTimeZone();
    }
    if (settings.preferences.captions) {
        setDeviceInfo("captions", "captionMode");
        setDeviceInfo("captions", "captionLanguage");
        saveCaptionStyle();
    }
    if (settings.preferences.peerRoku) {
        checkMenuItem("peer-roku-deploy", getPeerRoku().deploy);
        checkMenuItem("peer-roku-control", getPeerRoku().syncControl);
    }
}

// Process Command Line switches
function processArgv(mainWindow, startup) {
    let settings = getSettings(mainWindow);
    const options = settings?.value("simulator.options");
    if (argv?.fullscreen || options?.includes("fullScreen")) {
        mainWindow.setFullScreen(true);
    }
    if (argv?.ecp || startup.ecpEnabled) {
        enableECP(mainWindow);
    }
    if (argv?.telnet || startup.telnetEnabled) {
        enableTelnet(mainWindow);
    }
    if (argv?.pwd && argv.pwd.trim() !== "") {
        setPassword(argv.pwd.trim());
        settings.value("services.password", argv.pwd.trim());
    }
    if (argv?.web) {
        setPort(argv.web);
        settings.value("services.webPort", Number.parseInt(argv.web));
        enableInstaller(mainWindow);
    } else if (startup.installerEnabled) {
        enableInstaller(mainWindow);
    }
    if (argv?.mode && argv.mode.trim() !== "") {
        let displayMode = "720p";
        switch (argv.mode.trim().toLowerCase()) {
            case "sd":
                displayMode = "480p";
                break;
            case "fhd":
                displayMode = "1080p";
                break;
            default:
                break;
        }
        setDisplayOption("displayMode", displayMode, true);
    }
    if (startup.devTools || argv.devtools) {
        openDevTools(mainWindow);
    }
    if (startup.console || argv.console) {
        openCodeEditor();
    }
    let openFile;
    if (argv?.o) {
        openFile = argv.o.trim();
    } else {
        try {
            let index = argv._.length - 1;
            if (index && argv._[index]) {
                if (jetpack.exists(argv._[index])) {
                    openFile = argv._[index];
                }
            }
        } catch (error) {
            console.error("Invalid parameters!", error);
        }
    }
    if (openFile) {
        const fileExt = path.parse(openFile).ext.toLowerCase();
        if (fileExt === ".zip" || fileExt === ".bpk" || fileExt === ".brs") {
            loadFile([openFile]);
        } else {
            console.log("File format not supported: ", fileExt);
        }
    }
}

// Setup Application Window events
function setupEvents(mainWindow) {
    if (isMacOS) {
        app.on("before-quit", function (evt) {
            app.quitting = true;
        });
        app.on("activate", function () {
            mainWindow.show();
        });
        mainWindow.on("close", function (evt) {
            if (app.quitting) {
                mainWindow = null;
            } else {
                evt.preventDefault();
                if (mainWindow.isFullScreen()) {
                    mainWindow.once("leave-full-screen", () => mainWindow.hide());
                    mainWindow.setFullScreen(false);
                }
                mainWindow.hide();
            }
        });
        mainWindow.on("minimize", function () {
            enableMenuItem("copy-screen", false);
            enableMenuItem("on-top", false);
        });
        mainWindow.on("hide", function () {
            enableMenuItem("copy-screen", false);
        });
        mainWindow.on("restore", function () {
            enableMenuItem("copy-screen", isMenuItemEnabled("save-screen"));
            enableMenuItem("on-top", true);
        });
        mainWindow.on("show", function () {
            enableMenuItem("copy-screen", isMenuItemEnabled("save-screen"));
        });
    } else {
        app.on("window-all-closed", () => {
            app.quit();
        });
    }
    app.on("browser-window-created", (_, window) => {
        window.on("close", (evt) => {
            if (window.webContents?.getURL()?.endsWith("editor.html")) {
                const stateStoreFile = "window-state-editor.json";
                saveWindowState(stateStoreFile, {}, window);
                evt.preventDefault();
                window.hide();
            }
        });
    });
}
