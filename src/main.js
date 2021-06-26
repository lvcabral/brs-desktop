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
import { app, screen, ipcMain } from "electron";
import { initECP, enableECP } from "./servers/ecp"
import { setPassword, setPort, enableInstaller } from "./servers/installer";
import { enableTelnet } from "./servers/telnet";
import { createMenu } from "./menu/menuService"
import createWindow from "./helpers/window";

// Emulator Device Information Object
const deviceInfo = {
    developerId: "emulator-dev-id", // Unique id to segregate registry among channels
    friendlyName: "BrightScript Emulator",
    serialNumber: "BRSEMUAPP090",
    deviceModel: "4200X",   // Can change according to the display mode in the front-end
    firmwareVersion: "049.10E04111A",
    clientId: "810e74d8-f387-49c2-8644-c72bd0e8e2a1", // Unique identifier of the device
    RIDA: "fad884dd-583f-4753-b694-fd0748152064", // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Options are: 480p (SD), 720p (HD), 1080p (FHD)
    defaultFont: "Asap", // Desktop app only has Asap to reduce the package size
    maxSimulStreams: 2,
    connectionType: "WiFiConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: getLocalIps(),
    startTime: Date.now(),
    audioVolume: 40
}

// Parse CLI parameters
const argv = minimist(process.argv.slice(1), {
    string: [ "o", "p", "m" ],
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
    let winBounds = mainWindow.getBounds();
    let display = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
    mainWindow.setMinimumSize(Math.min(346, display.size.width), Math.min(264, display.size.height));
    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true
        })
    ).then(() => {
        // CLI Switches
        if (argv.ecp) {
            enableECP(mainWindow);
        }
        if (argv.telnet) {
            enableTelnet(mainWindow);
        }
        if (argv.pwd && argv.pwd.trim() !== "") {
            setPassword(argv.pwd.trim());
            mainWindow.webContents.send("setPassword", argv.pwd.trim());
        }
        if (argv.web) {
            enableInstaller(mainWindow, argv.web);
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

        if (env.name === "development" || argv.devtools) {
            mainWindow.openDevTools();
        }
    });
    // Initialize ECP and SSDP servers
    initECP(deviceInfo);
    ipcMain.once("ECPEnabled", (event, enable) => {
        if (enable) {
            enableECP(mainWindow);
        }
    });
    // Initialize Telnet server
    ipcMain.once("telnetEnabled", (event, enable) => {
        if (enable) {
            enableTelnet(mainWindow);
        }
    });
    // Initialize Web Installer server
    ipcMain.once("installerEnabled", (event, enable, password, port) => {
        if (password) {
            setPassword(password);
        }
        if (enable) {
            enableInstaller(mainWindow, port);
        } else {
            setPort(port);
        }
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