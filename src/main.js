/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import url from "url";
import env from "env";
import os from "os";
import minimist from "minimist";
import jetpack from "fs-jetpack";
import { app, screen, ipcMain, nativeTheme } from "electron";
import { DateTime } from "luxon";
import { setPassword, setPort, enableInstaller, updateInstallerStatus } from "./servers/installer";
import { initECP, enableECP, updateECPStatus } from "./servers/ecp"
import { enableTelnet, updateTelnetStatus } from "./servers/telnet";
import { createMenu, enableMenuItem, isMenuItemEnabled, loadPackage } from "./menu/menuService"
import { loadFile, saveFile } from "./helpers/files";
import { getSettings, setDeviceInfo, setDisplayOption, setThemeSource, setTimeZone } from "./helpers/settings";
import { createWindow, setAspectRatio } from "./helpers/window";

const isMacOS = process.platform === "darwin";

// Emulator Device Information Object
const dt = DateTime.now().setZone("system");
const deviceInfo = {
    developerId: "emulator-dev-id", // Unique id to segregate registry among channels
    friendlyName: "BrightScript Emulator",
    serialNumber: "BRSEMUAPP091",
    deviceModel: "4200X",
    firmwareVersion: "46A.00E04209A",
    clientId: "810e74d8-f387-49c2-8644-c72bd0e8e2a1", // Unique identifier of the device
    RIDA: "fad884dd-583f-4753-b694-fd0748152064", // Unique identifier for advertisement tracking
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
    audioVolume: 40
}

// Parse CLI parameters
const argv = minimist(process.argv.slice(1), {
    string: ["o", "p", "m"],
    boolean: ["d", "e", "f", "r"],
    alias: { d: "devtools", e: "ecp", f: "fullscreen", w: "web", p: "pwd", m: "mode", r: "rc" }
});

// Save userData in separate folders for each environment.
if (env.name !== "production") {
    const userDataPath = app.getPath("userData");
    app.setPath("userData", `${userDataPath} (${env.name})`);
}

app.on("ready", () => {
    createMenu();
    // Shared Object with Front End
    global.sharedObject = {
        theme: "purple",
        backgroundColor: "#251135",
        deviceInfo: deviceInfo
    };
    // Create Main Window
    let mainWindow = createWindow(
        "main",
        {
            width: 1280,
            height: 770,
            backgroundColor: global.sharedObject.backgroundColor
        }
    );
    // Configure Window and load content
    let firstLoad = true;
    let winBounds = mainWindow.getBounds();
    let display = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
    mainWindow.setMinimumSize(Math.min(346, display.size.width), Math.min(264, display.size.height));
    // Load Emulator Settings
    let settings = getSettings(mainWindow);
    let startup = {
        devTools: false,
        runLastChannel: false,
        ecpEnabled: false,
        telnetEnabled: false,
        installerEnabled: false,
    }
    if (settings.preferences.emulator) {
        if (settings.value("emulator.options")) {
            const options = settings.value("emulator.options");
            const onTop = options.includes("alwaysOnTop");
            app.applicationMenu.getMenuItemById("on-top").checked = onTop;
            mainWindow.setAlwaysOnTop(onTop);
            mainWindow.setFullScreen(argv.fullscreen || options.includes("fullScreen"));
            app.applicationMenu.getMenuItemById("status-bar").checked = options.includes("statusBar");
            startup.runLastChannel = options.includes("runLastChannel");
            startup.devTools = options.includes("devTools");
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
        setDeviceInfo("device", "serialNumber");
        setDeviceInfo("device", "clientId");
        setDeviceInfo("device", "RIDA");
        setDeviceInfo("device", "developerId");
    }
    if (settings.preferences.display) {
        setDisplayOption("displayMode");
        setAspectRatio(settings.value("display.displayMode"));
        const overscanMode = settings.value("display.overscanMode");
        app.applicationMenu.getMenuItemById(overscanMode).checked = true;
    }
    if (settings.preferences.audio) {
        setDeviceInfo("audio", "maxSimulStreams");
        setDeviceInfo("audio", "audioVolume");
    }
    if (settings.preferences.localization) {
        const localeId = settings.value("localization.locale");
        if (localeId) {
            deviceInfo.locale = localeId;
            app.applicationMenu.getMenuItemById(localeId).checked = true;    
        }
        setDeviceInfo("localization", "clockFormat");
        setDeviceInfo("localization", "countryCode");
        setTimeZone();
    }
    // Initialize ECP and SSDP servers
    initECP(deviceInfo);
    // Load Renderer
    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true
        })
    ).then(() => {
        // CLI Switches
        if (argv.ecp || startup.ecpEnabled) {
            enableECP(mainWindow);
        }
        if (argv.telnet || startup.telnetEnabled) {
            enableTelnet(mainWindow);
        }
        if (argv.pwd && argv.pwd.trim() !== "") {
            setPassword(argv.pwd.trim());
            settings.value("services.password", argv.pwd.trim());
        }
        if (argv.web) {
            setPort(argv.web);
            settings.value("services.webPort", parseInt(argv.web));
            enableInstaller(mainWindow);
        } else if (startup.installerEnabled) {
            enableInstaller(mainWindow);
        }
        if (argv.mode && argv.mode.trim() !== "") {
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
        if (argv && argv.o) {
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
            if (fileExt === ".zip" || fileExt === ".brs") {
                loadFile([openFile]);
            } else {
                console.log("File format not supported: ", fileExt);
            }
        } else if (startup.runLastChannel) {
            loadPackage(0);
        }
        firstLoad = false;
        mainWindow.show();
        mainWindow.focus();
    });
    mainWindow.webContents.on('dom-ready', () => {
        if (!firstLoad) {
            updateECPStatus(settings.value("services.ecp").includes("enabled"));
            updateTelnetStatus(settings.value("services.telnet").includes("enabled"));
            updateInstallerStatus(settings.value("services.installer").includes("enabled"));
        }
    });
    if (isMacOS) {
        app.on("before-quit", function (evt) {
            app.quitting = true;
        });
        app.on("activate", function() {
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
    // Open Developer Tools
    ipcMain.on("openDevTools", (event, data) => {
        mainWindow.openDevTools();
    });
    // Save Files
    ipcMain.on("saveFile", (event, data) => {
        saveFile(data[0], data[1]);
    });
    ipcMain.on("saveIcon", (event, data) => {
        const iconPath = path.join(
            app.getPath("userData"),
            data[0] + ".png"
        );
        saveFile(iconPath, data[1]);
    });
    // Reset device
    ipcMain.on("reset", () => {
        mainWindow.reload();
    });
});

// Helper Functions
function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    Object.keys(ifaces).forEach(function (ifname) {
        let alias = 0;
        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
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