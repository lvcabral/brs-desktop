/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import url from "url";
import env from "env";
import os from "os";
import minimist from "minimist";
import jetpack from "fs-jetpack";
import { app, screen } from "electron";
import { DateTime } from "luxon";
import { setPassword, setPort, enableInstaller, updateInstallerStatus } from "./server/installer";
import { initECP, enableECP, updateECPStatus } from "./server/ecp";
import { enableTelnet, updateTelnetStatus } from "./server/telnet";
import { createMenu, enableMenuItem, checkMenuItem, isMenuItemEnabled, loadPackage } from "./menu/menuService";
import { loadFile } from "./helpers/files";
import {
    getSettings,
    setDeviceInfo,
    setDisplayOption,
    setRemoteKeys,
    setThemeSource,
    setTimeZone,
} from "./helpers/settings";
import { createWindow, setAspectRatio } from "./helpers/window";
import { setupTitlebar, attachTitlebarToWindow } from "custom-electron-titlebar/main";
import { randomUUID } from "crypto";

const isMacOS = process.platform === "darwin";

// Device Information Object
const dt = DateTime.now().setZone("system");
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
    connectionType: "WiFiConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: getLocalIps(),
    startTime: Date.now(),
    maxSimulStreams: 2,
    audioVolume: 40,
};

require("@electron/remote/main").initialize();

// Parse CLI parameters
const argv = minimist(process.argv.slice(1), {
    string: ["o", "p", "m"],
    boolean: ["d", "e", "f", "r"],
    alias: { d: "devtools", e: "ecp", f: "fullscreen", w: "web", p: "pwd", m: "mode", r: "rc" },
});

// Save userData in separate folders for each environment.
if (env.name !== "production") {
    const userDataPath = app.getPath("userData");
    app.setPath("userData", `${userDataPath} (${env.name})`);
}

app.on("ready", () => {
    // setup the titlebar main process
    setupTitlebar();
    createMenu();
    // Shared Object with Front End
    global.sharedObject = {
        theme: "purple",
        backgroundColor: "#251135",
        deviceInfo: deviceInfo,
    };
    // Create Main Window
    let mainWindow = createWindow("main", {
        width: 1280,
        height: 770,
        backgroundColor: global.sharedObject.backgroundColor,
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
    let startup = {
        devTools: false,
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
            processArgv(mainWindow, startup);
            firstLoad = false;
            attachTitlebarToWindow(mainWindow);
            mainWindow.show();
            mainWindow.focus();
        });
    mainWindow.webContents.on("dom-ready", () => {
        let settings = getSettings(mainWindow);
        if (!firstLoad) {
            updateECPStatus(settings.value("services.ecp").includes("enabled"));
            updateTelnetStatus(settings.value("services.telnet").includes("enabled"));
            updateInstallerStatus(settings.value("services.installer").includes("enabled"));
        }
        if (settings.preferences.remote) {
            setRemoteKeys(settings.defaults.remote, settings.preferences.remote);
        }
    });
    setupEvents(mainWindow);
});

// Load Settings
function loadSettings(mainWindow, startup) {
    // Load Simulator Settings
    let settings = getSettings(mainWindow);
    if (settings.preferences.emulator) {
        if (settings.value("emulator.options")) {
            const options = settings.value("emulator.options");
            const onTop = options.includes("alwaysOnTop");
            checkMenuItem("on-top", onTop);
            mainWindow.setAlwaysOnTop(onTop);
            mainWindow.setFullScreen(argv.fullscreen || options.includes("fullScreen"));
            checkMenuItem("status-bar", options.includes("statusBar"));
            startup.runLastChannel = options.includes("runLastChannel");
            startup.devTools = options.includes("devToolsStartup");
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
}

// Process Command Line switches
function processArgv(mainWindow, startup) {
    let settings = getSettings(mainWindow);
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
        settings.value("services.webPort", parseInt(argv.web));
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
        mainWindow.openDevTools();
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
    } else if (startup.runLastChannel) {
        loadPackage(0);
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
}

// Helper Functions
function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    Object.keys(ifaces).forEach(function (ifname) {
        let alias = 0;
        ifaces[ifname].forEach(function (iface) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(`${ifname}:${alias}`, iface.address);
                ips.push(`${ifname}:${alias},${iface.address}`);
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                ips.push(`${ifname},${iface.address}`);
            }
            ++alias;
        });
    });
    return ips;
}
