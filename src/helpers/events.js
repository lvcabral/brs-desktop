/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow } from "electron";
import { subscribeInstaller } from "../server/installer";
import { subscribeECP } from "../server/ecp";
import { subscribeTelnet } from "../server/telnet";
import { ECP_PORT, TELNET_PORT } from "../constants";
import { getRecentPackage, getAppList } from "../menu/menuService";
import { updateServerStatus } from "./settings";
import { loadFile } from "./files";
import path from "node:path";
import fs from "node:fs";

// Server Events

export function subscribeServerEvents() {
    subscribeECP("events", ecpEvents);
    subscribeInstaller("events", installerEvents);
    subscribeTelnet("events", telnetEvents);
}

function ecpEvents(event, data) {
    if (event === "enabled") {
        updateServerStatus("ECP", "ecp-api", data, ECP_PORT);
    } else if (event === "launch") {
        const appID = data.appID;
        const query = data.query;
        let zipPath;
        if (appID.toLowerCase() === "dev") {
            zipPath = path.join(app.getPath("userData"), "dev.zip");
        } else {
            const appList = getAppList();
            const index = appList.findIndex((app) => app.id.toLowerCase() === appID.toLowerCase());
            zipPath = getRecentPackage(index);
        }
        if (zipPath && fs.existsSync(zipPath)) {
            const input = new Map();
            input.set("source", "external-control");
            if (query) {
                for (let key in query) {
                    input.set(key, query[key]);
                }
            }
            loadFile([zipPath], input);
        } else {
            const window = BrowserWindow.fromId(1);
            window?.webContents.send(
                "console",
                `ECP Launch: File not found! App Id=${appID}`,
                true
            );
        }
    } else {
        console.warn("ECP Unknown Event:", event, data);
    }
}

function installerEvents(event, data) {
    if (event === "enabled") {
        updateServerStatus("Installer", "web-installer", data.enabled, data.port);
    } else if (event === "install") {
        const input = new Map();
        input.set("source", data.source);
        setTimeout(() => {
            loadFile([data.file], input);
        }, 500);
    }
}

function telnetEvents(event, enabled) {
    if (event === "enabled") {
        updateServerStatus("Telnet", "telnet", enabled, TELNET_PORT);
    }
}
