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
import { app, screen, Menu } from "electron";
import createWindow from "./helpers/window";
import { enableECP } from "./helpers/ecp"
import { createMenu } from "./menu/menuService"

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

    global.sharedObject = {
        backgroundColor: "#251135"
    };
    const mainWindow = createWindow(
        "main",
        {
            width: 1280,
            height: 770,
            backgroundColor: global.sharedObject.backgroundColor
        },
        argv
    );

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

    if (env.name === "development" || argv.devtools) {
        mainWindow.openDevTools();
    }

    if (argv.ecp) {
        enableECP(mainWindow);
    }
});

app.on("window-all-closed", () => {
    app.quit();
});
