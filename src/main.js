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
import { initECP, enableECP, updateECPStatus } from "./servers/ecp"
import { setPassword, setPort, enableInstaller, updateInstallerStatus } from "./servers/installer";
import { enableTelnet, updateTelnetStatus } from "./servers/telnet";
import { createMenu, loadPackage } from "./menu/menuService"
import { loadFile, saveFile } from "./helpers/files";
import { getSettings, updateTimeZone } from "./helpers/settings";
import createWindow from "./helpers/window";

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
    const mainWindow = createWindow(
        "main",
        {
            width: 1280,
            height: 770,
            backgroundColor: global.sharedObject.backgroundColor
        },
        argv
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
        let userTheme = settings.value("emulator.theme") || "purple";
        app.applicationMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
        if (userTheme === "system") {
            userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
        }
        global.sharedObject.theme = userTheme;
    }
    if (settings.preferences.services) {
        startup.ecpEnabled = settings.value("services.ecp").includes("enabled");
        startup.telnetEnabled = settings.value("services.telnet").includes("enabled");
        startup.installerEnabled = settings.value("services.installer").includes("enabled");
        setPassword(settings.value("services.password"));
        setPort(settings.value("services.webPort"));
    }
    if (settings.preferences.localization) {
        const localeId = settings.value("localization.locale");
        if (localeId) {
            deviceInfo.locale = localeId;
            app.applicationMenu.getMenuItemById(localeId).checked = true;    
        }
        const clockFormat  = settings.value("localization.clockFormat");
        if (clockFormat) {
            deviceInfo.clockFormat = clockFormat;
        }
        const countryCode  = settings.value("localization.countryCode");
        if (countryCode) {
            deviceInfo.countryCode = countryCode;
        }
        updateTimeZone();
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
            switch (argv.mode.trim().toLowerCase()) {
                case "sd":
                    mainWindow.webContents.send("setDisplay", "480p");
                    break;
                case "hd":
                    mainWindow.webContents.send("setDisplay", "720p");
                    break;
                case "fhd":
                    mainWindow.webContents.send("setDisplay", "1080p");
                    break;
                default:
                    break;
            }
            mainWindow.webContents.send("updateMenu");
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
            loadPackage(mainWindow, 0, true);
        }
        firstLoad = false;
        mainWindow.show();
        mainWindow.focus();
    });
    mainWindow.webContents.on('dom-ready', () => {
        if (!firstLoad) {
            updateECPStatus(settings.value("services.ecp").includes("enabled"), mainWindow);
            updateTelnetStatus(settings.value("services.telnet").includes("enabled"), mainWindow);
            updateInstallerStatus(settings.value("services.installer").includes("enabled"), mainWindow);
        }
    });
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
// Quit the Application
app.on("window-all-closed", () => {
    app.quit();
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