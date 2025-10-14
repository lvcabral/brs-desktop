/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { consoleBuffer } from "../helpers/console";
import { TELNET_PORT } from "../constants";
import * as telnet from "net";
let server;
let clientId = 0;
let clients = new Map();
let lines = new Map();

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
            processData(data, id, window);
        });
        // Handle exceptions from the client
        client.on("error", (e) => {
            console.error(`Remote console client error: ${e.message}`);
            client.destroy();
        });
        client.on("close", function () {
            clients.delete(id);
            lines.delete(id);
        });
        client.write(`Connected to ${app.getName()}\r\n`);
        consoleBuffer.forEach((value) => {
            client.write(value);
        });
        clients.set(id, client);
        lines.set(id, "");
    });
    server.on("listening", () => {
        isTelnetEnabled = true;
        notifyAll("enabled", true);
        ipcMain.on("telnet", (event, text) => {
            if (text !== undefined) {
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
    server.listen(TELNET_PORT);
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
        }
        isTelnetEnabled = false;
        notifyAll("enabled", false);
    }
}

// Observers Handling
const observers = new Map();
export function subscribeTelnet(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeTelnet(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Data Processing

function processData(data, id, window) {
    if (data?.length > 0) {
        const client = clients.get(id);
        let line = lines.get(id);
        const hexData = data.toString('hex');
        if (data[0] === 0xff) {
            // Telnet command
            if (hexData === "fff4fffd06") {
                // Interrupt - Ctrl+Break
                client.write(Buffer.from("fffc06", "hex"));
                window.webContents.send("debugCommand", "break");
            } else if (hexData === "fffd03fffd01") {
                // Will not enter Character at a time mode
                client.write(Buffer.from("fffc03fffc01", "hex"));
            } else if (hexData === "fffd12") {
                // Won't logout
                client.write(Buffer.from("fffc12", "hex"));
            }
            return;
        } else if (data[0] === 0x03) {
            // Break - Ctrl+C
            window.webContents.send("debugCommand", "break");
            return;
        }
        line += data.toString();
        if (!hexData.endsWith("0d") && !hexData.endsWith("0a")) {
            lines.set(id, line);
            return;
        }
        sendDebugCommand(line, client, window);
        lines.set(id, "");
    }
}

function sendDebugCommand(line, client, window) {
    const expr = line.trim().split(/(?<=^\S+)\s/);
    const cmd = expr[0].toLowerCase();
    if (cmd.toLowerCase() === "close") {
        client.write("bye!\r\n");
        client.destroy();
    } else if (cmd === "quit") {
        window.webContents.send("closeChannel", "EXIT_BRIGHTSCRIPT_STOP");
    } else if (cmd === "") {
        window.webContents.send("debugCommand", String.fromCharCode(10));
    } else {
        window.webContents.send("debugCommand", expr.join(" "));
    }
}
