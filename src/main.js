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
import { restoreRecentFiles } from "./helpers/recent"
import { fileMenuTemplate } from "./menu/fileMenuTemplate";
import { editMenuTemplate } from "./menu/editMenuTemplate";
import { deviceMenuTemplate } from "./menu/deviceMenuTemplate";
import { viewMenuTemplate } from "./menu/viewMenuTemplate";
import { helpMenuTemplate } from "./menu/helpMenuTemplate";

const argv = minimist(process.argv.slice(1), {
    string: [ "o" ],
    alias: { f: "fullscreen", d: "devtools" }
});

const setApplicationMenu = () => {
    const menus = [ fileMenuTemplate, editMenuTemplate, deviceMenuTemplate, viewMenuTemplate, helpMenuTemplate ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
    restoreRecentFiles();
};

// Save userData in separate folders for each environment.
if (env.name !== "production") {
    const userDataPath = app.getPath("userData");
    app.setPath("userData", `${userDataPath} (${env.name})`);
}

app.on("ready", () => {
    setApplicationMenu();

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
});

app.on("window-all-closed", () => {
    app.quit();
});
