/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import * as telnet from "net";
import { setPreference } from "../helpers/settings";
import { checkMenuItem } from "../menu/menuService";

const PORT = 8085;
const BUFFER_SIZE = 700;
let server;
let clientId = 0;
let clients = new Map();
let buffer = [];

export let isTelnetEnabled = false;
export function enableTelnet() {
    if (isTelnetEnabled) {
        return;
    }
    const window = BrowserWindow.fromId(1);
    server = telnet.createServer();
    server.on("connection", (client) => {
        let id = clientId;
        clientId++;
        // listen for the actual data from the client
        client.on("data", (data) => {
            if (data !== undefined && data.length > 0) {
                let expr = data
                    .toString()
                    .trim()
                    .split(/(?<=^\S+)\s/);
                let cmd = expr[0].toLowerCase();
                if (cmd.toLowerCase() === "close") {
                    client.write("bye!\r\n");
                    client.destroy();
                } else if (cmd === "quit") {
                    window.webContents.send("closeChannel", "EXIT_BRIGHTSCRIPT_STOP");
                } else if (cmd === "\x03") {
                    window.webContents.send("debugCommand", "break");
                } else {
                    window.webContents.send("debugCommand", expr.join(" "));
                }
            }
        });
        // Handle exceptions from the client
        client.on("error", (e) => {
            console.error(`Remote console client error: ${e.message}`);
            client.destroy();
        });
        client.on("close", function () {
            clients.delete(id);
        });
        client.write(`Connected to ${app.getName()}\r\n`);
        buffer.forEach((value) => {
            client.write(value);
        });
        clients.set(id, client);
    });
    server.on("listening", () => {
        isTelnetEnabled = true;
        updateTelnetStatus(isTelnetEnabled);
        ipcMain.on("telnet", (event, text) => {
            if (text !== undefined) {
                if (buffer.length > BUFFER_SIZE) {
                    buffer.shift();
                }
                buffer.push(text);
                clients.forEach((client, id) => {
                    client.write(text);
                });
            }
        });
    });
    server.on("error", (error) => {
        ipcMain.removeAllListeners("telnet");
        window.webContents.send("console", `Remote console server error: ${error.message}`, true);
    });
    server.listen(PORT);
}

export function disableTelnet() {
    if (isTelnetEnabled) {
        if (server) {
            server.close();
            clients.forEach((client, id) => {
                client.destroy();
            });
            ipcMain.removeAllListeners("telnet");
            clientId = 0;
            clients = new Map();
            buffer = [];
        }
        isTelnetEnabled = false;
        updateTelnetStatus(isTelnetEnabled);
    }
}

export function updateTelnetStatus(enabled) {
    setPreference("services.telnet", enabled ? ["enabled"] : []);
    checkMenuItem("telnet", enabled);
    const window = BrowserWindow.fromId(1);
    window.webContents.send("serverStatus", "Telnet", enabled, PORT);
    window.webContents.send("refreshMenu");
}
