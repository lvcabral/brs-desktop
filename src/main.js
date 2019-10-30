/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import url from "url";
import env from "env";
import minimist from "minimist";
import { app, screen } from "electron";
import createWindow from "./helpers/window";
import { enableECP } from "./helpers/ecp"
import { createMenu } from "./menu/menuService"

// Emulator Device Information Object
const deviceInfo = {
    developerId: "emulator-dev-id", // Unique id to segregate registry among channels
    friendlyName: "BrightScript Emulator",
    serialNumber: "BRSEMUAPP070",
    deviceModel: "8000X",   // Can change according to the display mode in the front-end
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364", // Unique identifier of the device
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: "US/Arizona",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Options are: 480p (SD), 720p (HD), 1080p (FHD)
    defaultFont: "Asap", // Desktop app only has Asap to reduce the package size
    maxSimulStreams: 2
}

// Parse CLI parameters
const argv = minimist(process.argv.slice(1), {
    string: [ "o" ],
    alias: { d: "devtools", e: "ecp", f: "fullscreen" }
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
    mainWindow.setMinimumSize(Math.min(900, display.size.width), Math.min(550, display.size.height));
    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true
        })
    );
    // Open DevTools
    if (env.name === "development" || argv.devtools) {
        mainWindow.openDevTools();
    }
    // Enable ECP and SSDP servers
    if (argv.ecp) {
        enableECP(mainWindow, deviceInfo);
    }
});
// Quit the Application
app.on("window-all-closed", () => {
    app.quit();
});
