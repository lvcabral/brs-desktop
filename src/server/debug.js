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
import { isLocalhostAddress, getRokuOS } from "../helpers/util";
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
let localOnly = false;

export let isDebugEnabled = false;

export function setDebugLocalOnly(value) {
    localOnly = value;
}
export function enableDebugServer(win, prefs, port = DEBUG_PORT, { localOnly: lo = false } = {}) {
    if (isDebugEnabled) {
        return;
    }
    localOnly = lo;
    if (!window && win) {
        window = win;
    }
    if (!settings && prefs) {
        settings = prefs;
    }
    server = telnet.createServer();
    server.on("connection", (client) => {
        if (localOnly && !isLocalhostAddress(client.remoteAddress)) {
            client.destroy();
            return;
        }
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
        device ||= globalThis.sharedObject.deviceInfo;
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
        const hexData = data.toString("hex");

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

// Handlers return SUPPRESS_PROMPT when they take responsibility for writing the prompt
// themselves -- the key queue emits it once the last key has been sent, and quitting emits
// none at all. Anything else gets the trailing ">" from sendDebugCommand.
const SUPPRESS_PROMPT = Symbol("suppress-prompt");

/**
 * Handlers for the dev-console command set, keyed by command name. Aliases point at the
 * same function. Each receives the trimmed argument, the client socket, and the raw
 * (untrimmed) argument for the commands that treat whitespace as data.
 */
const commandHandlers = {
    exit: handleQuit,
    quit: handleQuit,
    q: handleQuit,
    help: handleHelp,
    "?": handleHelp,
    genkey: handleGenkey,
    showkey: handleShowkey,
    fps_display: handleFpsDisplay,
    clear_launch_caches: handleClearLaunchCaches,
    "bsprof-status": handleBsprof,
    "bsprof-pause": handleBsprof,
    "bsprof-resume": handleBsprof,
    loaded_textures: handleLoadedTextures,
    logrendezvous: handleLogRendezvous,
    plugins: handlePlugins,
    remove_plugin: handleRemovePlugin,
    press: handlePress,
    type: handleType,
};

export function sendDebugCommand(line, client) {
    const expr = line.trim().split(/(?<=^\S+)\s/);
    const cmd = expr[0];
    const raw = expr[1] ?? "";
    const arg = raw.trim();

    const handler = commandHandlers[cmd];
    if (handler) {
        if (handler(arg, client, raw) === SUPPRESS_PROMPT) {
            return;
        }
    } else if (cmd !== "") {
        handleUnknown(cmd, client);
    }
    client.write(">");
}

function handleQuit(arg, client) {
    client.write("Quit command received, exiting.\r\n");
    client.destroy();
    return SUPPRESS_PROMPT;
}

function handleHelp(arg, client) {
    client.write(getHelpText(arg));
}

function handleGenkey(arg, client) {
    client.write("Setup your Developer Id in Settings->Device.\r\n");
}

function handleShowkey(arg, client) {
    client.write(`Dev ID: ${device?.developerId ?? "<unkeyed>"}\r\n`);
}

function handleFpsDisplay(arg) {
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
}

function handleClearLaunchCaches(arg, client) {
    client.write("Done.\r\n");
}

function handleBsprof(arg, client) {
    client.write("No profiling session\r\n");
}

function handleLoadedTextures(arg, client) {
    client.write("loaded_textures only works when a Scene Graph screen is displayed\r\n");
}

function handleLogRendezvous(arg, client) {
    let state = arg;
    if (state && ["on", "off"].includes(state)) {
        rendezvousTrackingEnabled = state === "on";
    } else {
        state ||= rendezvousTrackingEnabled ? "on" : "off";
    }
    if (["on", "off"].includes(state)) {
        client.write(`logrendezvous: rendezvous logging is ${state}\r\n`);
    } else {
        client.write("usage: logrendezvous [on|off]\r\n");
    }
}

function handlePlugins(arg, client) {
    if (device?.appList) {
        for (const app of device.appList) {
            const idStr = app.id.toString().padStart(20, " ");
            client.write(` F-C + S - S6 ${idStr} [usg     0] [ref  0]       ${app.title}, ${app.version}\r\n`);
        }
    }
}

function handleRemovePlugin(arg, client) {
    if (!arg) {
        client.write("Usage: remove_plugin <channel id>\r\n");
    } else if (device?.appList) {
        const index = device.appList.findIndex((app) => app.id === arg || app.id.toString() === arg);
        if (index > -1) {
            const title = device.appList[index].title;
            device.appList.splice(index, 1);
            client.write(`Removed plugin id: ${arg}, name: ${title}\r\n`);
            reloadDevice();
        } else {
            client.write(
                `Failed to remove plugin id: ${arg}, name: unknown. Plugin is NOT installed on the device\r\n`
            );
        }
    }
}

function handlePress(arg, client) {
    if (!arg) {
        client.write(PRESS_HELP + "\r\n");
        return undefined;
    }
    // Resolved per call rather than using the cached module-level window, matching the
    // original: the key queue needs whatever window is current.
    const pressWindow = BrowserWindow.fromId(1);
    if (!pressWindow) {
        return undefined;
    }
    for (const char of arg) {
        const key = getPressKey(char);
        if (key) {
            typeQueue.push({ key, window: pressWindow, client });
        }
    }
    return queueTerminator(pressWindow, client);
}

function handleType(arg, client, raw) {
    if (!window) {
        return undefined;
    }
    // Uses the untrimmed argument: trailing spaces are part of the text to send.
    for (const char of raw) {
        typeQueue.push({ key: `lit_${char}`, window, client });
    }
    return queueTerminator(window, client);
}

/**
 * Close a run of queued keys and start draining, if not already draining
 * @param {object} target - The window the keys are sent to
 * @param {object} client - The client socket awaiting the prompt
 * @returns {symbol} - SUPPRESS_PROMPT, since the queue writes the prompt when it drains
 */
function queueTerminator(target, client) {
    typeQueue.push({ key: null, window: target, client });
    if (!isTyping) {
        processTypeQueue();
    }
    return SUPPRESS_PROMPT;
}

function handleUnknown(cmd, client) {
    const isValid = HELP_COMMANDS.some((c) => c.cmd.toLowerCase() === cmd);
    if (isValid) {
        client.write(`Command not implemented yet: ${cmd}\r\n`);
    } else {
        client.write("Command not recognized\r\n");
    }
}
