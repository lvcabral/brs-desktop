/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrowserWindow } from "electron";
import { DEBUG_PORT } from "../constants";
import { HELP_COMMANDS, PRESS_HELP, getHelpText } from "./debugHelp";
import { getPressKey } from "./debugKeys";
import { getRokuOS } from "../helpers/util";
import { reloadDevice } from "../helpers/window";
import * as telnet from "net";

let server;
let device;
let window;
let settings;
let clientId = 0;
let clients = new Map();
let lines = new Map();
let typeQueue = [];
let isTyping = false;
let rendezvousTrackingEnabled = false;

export let isDebugEnabled = false;


export function enableDebugServer(win, prefs, port = DEBUG_PORT) {
    if (isDebugEnabled) {
        return;
    }
    if (!window && win) {
        window = win;
    }
    if (!settings && prefs) {
        settings = prefs;
    }
    server = telnet.createServer();
    server.on("connection", (client) => {
        let id = clientId;
        clientId++;
        // listen for the actual data from the client
        client.on("data", (data) => {
            processData(data, id);
        });
        // Handle exceptions from the client
        client.on("error", (e) => {
            console.error(`Debug server client error: ${e.message}`);
            client.destroy();
        });
        client.on("close", function () {
            clients.delete(id);
            lines.delete(id);
        });
        if (!device) {
            device = globalThis.sharedObject.deviceInfo;
        }
        const version = getRokuOS(device.firmwareVersion, true, true);
        client.write(`${device.serialNumber} (${device.friendlyName} - ${version})\r\n>`);
        clients.set(id, client);
        lines.set(id, "");
    });
    server.on("listening", () => {
        isDebugEnabled = true;
        notifyAll("enabled", true);
    });
    server.on("error", (error) => {
        console.error(`Debug server error: ${error.message}`);
    });
    server.listen(port);
}

export function disableDebugServer() {
    if (isDebugEnabled) {
        if (server) {
            server.close();
            clients.forEach((client, id) => {
                client.destroy();
            });
            clientId = 0;
            clients = new Map();
        }
        isDebugEnabled = false;
        notifyAll("enabled", false);
    }
}

// Observers Handling
const observers = new Map();
export function subscribeDebugServer(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeDebugServer(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Data Processing
export function processData(data, id) {
    if (data?.length > 0) {
        const client = clients.get(id);
        let line = lines.get(id);
        const hexData = data.toString('hex');

        // Ignore telnet control characters
        if (data[0] === 0xff || data[0] === 0x03) {
            return;
        }

        line += data.toString();
        if (!hexData.endsWith("0d") && !hexData.endsWith("0a")) {
            lines.set(id, line);
            return;
        }
        sendDebugCommand(line, client);
        lines.set(id, "");
    }
}

function processTypeQueue() {
    if (typeQueue.length === 0) {
        isTyping = false;
        return;
    }
    isTyping = true;
    const step = typeQueue.shift();
    if (step.key === null) {
        if (!step.client.destroyed) {
            step.client.write(">");
        }
        processTypeQueue();
    } else {
        if (!step.client.destroyed) {
            step.window.webContents.send("postKeyPress", step.key);
        }
        setTimeout(processTypeQueue, 300);
    }
}

export function sendDebugCommand(line, client) {
    const expr = line.trim().split(/(?<=^\S+)\s/);
    const cmd = expr[0];

    if (["exit", "quit", "q"].includes(cmd)) {
        client.write("Quit command received, exiting.\r\n");
        client.destroy();
        return;
    } else if (cmd === "help" || cmd === "?") {
        const arg = expr[1] ? expr[1].trim() : "";
        client.write(getHelpText(arg));
    } else if (cmd === "genkey") {
        client.write("Setup your Developer Id in Settings->Device.\r\n");
    } else if (cmd === "showkey") {
        client.write(`Dev ID: ${device?.developerId ?? "<unkeyed>"}\r\n`);
    } else if (cmd === "fps_display") {
        let arg = expr[1]?.trim() ?? "";
        const displayOptions = settings?.value("display.options");
        if (displayOptions && window) {
            if (!displayOptions.includes("perfStats") && arg !== "0") {
                displayOptions.push("perfStats");
                window.webContents.send("setPerfStats", true);
            } else if (arg === "" || arg === "0") {
                displayOptions.splice(displayOptions.indexOf("perfStats"), 1);
                window.webContents.send("setPerfStats", false);
            }
            settings.value("display.options", displayOptions);
        }
    } else if (cmd === "clear_launch_caches") {
        client.write("Done.\r\n");
    } else if (["bsprof-status", "bsprof-pause", "bsprof-resume"].includes(cmd)) {
        client.write("No profiling session\r\n");
    } else if (cmd === "loaded_textures") {
        client.write("loaded_textures only works when a Scene Graph screen is displayed\r\n");
    } else if (cmd === "logrendezvous") {
        let arg = expr[1]?.trim();
        if (arg && ["on", "off"].includes(arg)) {
            rendezvousTrackingEnabled = arg === "on";
        } else if (!arg) {
            arg = rendezvousTrackingEnabled ? "on" : "off";
        }
        if (["on", "off"].includes(arg)) {
            client.write(`logrendezvous: rendezvous logging is ${arg}\r\n`);
        } else {
            client.write("usage: logrendezvous [on|off]\r\n");
        }
    } else if (cmd === "plugins") {
        if (device?.appList) {
            for (const app of device.appList) {
                const idStr = app.id.toString().padStart(20, " ");
                client.write(` F-C + S - S6 ${idStr} [usg     0] [ref  0]       ${app.title}, ${app.version}\r\n`);
            }
        }
    } else if (cmd === "remove_plugin") {
        const arg = expr[1] ? expr[1].trim() : "";
        if (!arg) {
            client.write("Usage: remove_plugin <channel id>\r\n");
        } else if (device?.appList) {
            const index = device.appList.findIndex(app => app.id === arg || app.id.toString() === arg);
            if (index > -1) {
                const title = device.appList[index].title;
                device.appList.splice(index, 1);
                client.write(`Removed plugin id: ${arg}, name: ${title}\r\n`);
                reloadDevice();
            } else {
                client.write(`Failed to remove plugin id: ${arg}, name: unknown. Plugin is NOT installed on the device\r\n`);
            }
        }
    } else if (cmd === "press") {
        const arg = expr[1] ? expr[1].trim() : "";
        if (arg) {
            const window = BrowserWindow.fromId(1);
            if (window) {
                for (const char of arg) {
                    const key = getPressKey(char);
                    if (key) {
                        typeQueue.push({ key, window, client });
                    }
                }
                typeQueue.push({ key: null, window, client });
                if (!isTyping) {
                    processTypeQueue();
                }
                return;
            }
        } else {
            client.write(PRESS_HELP + "\r\n");
        }
    } else if (cmd === "type") {
        const text = expr[1] || "";
        if (window) {
            for (const char of text) {
                typeQueue.push({ key: `lit_${char}`, window, client });
            }
            typeQueue.push({ key: null, window, client });
            if (!isTyping) {
                processTypeQueue();
            }
            return;
        }
    } else if (cmd !== "") {
        const isValid = HELP_COMMANDS.some(c => c.cmd.toLowerCase() === cmd);
        if (isValid) {
            client.write(`Command not implemented yet: ${cmd}\r\n`);
        } else {
            client.write("Command not recognized\r\n");
        }
    }
    client.write(">");
}
