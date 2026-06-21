/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow } from "electron";
import { DEBUG_PORT } from "../constants";
import * as telnet from "net";

let server;
let clientId = 0;
let clients = new Map();
let lines = new Map();
let typeQueue = [];
let isTyping = false;

export let isDebugEnabled = false;

const HELP_COMMANDS = [
    { cmd: "?", args: "[str]", desc: "Display the help." },
    { cmd: "brightscript_warnings", args: "<num-warnings>", desc: "Set the maximum number of brightscript warnings displayed" },
    { cmd: "bsprof-pause", args: "", desc: "Pause BS profiling" },
    { cmd: "bsprof-resume", args: "", desc: "Resume BS profiling" },
    { cmd: "bsprof-status", args: "", desc: "Get BS profiling status" },
    { cmd: "chanperf", args: "[-r <repeat-seconds>]", desc: "Show channel CPU and memory usage" },
    { cmd: "clear_launch_caches", args: "", desc: "Clear all caches that can affect channel launch time" },
    { cmd: "exit", args: "", desc: "Exits the debug terminal." },
    { cmd: "fps_display", args: "", desc: "display onscreen graphics statistics [1|0]." },
    { cmd: "free", args: "", desc: "Return the output of the free(1) command" },
    { cmd: "genkey", args: "", desc: "Generate a new developer key." },
    { cmd: "help", args: "[str]", desc: "Display the help." },
    { cmd: "loaded_textures", args: "[overlay]", desc: "Show loaded textures (default main RenderContext)" },
    { cmd: "logrendezvous", args: "[on|off]", desc: "Turn Rendezvous Logging on or off" },
    { cmd: "plugins", args: "", desc: "Show list of all installed plugins." },
    { cmd: "press", args: "{hudrlsp<fb>yikoteacn}", desc: "Simulate a keypress. (no param lists keys)" },
    { cmd: "quit", args: "", desc: "Exits the debug terminal." },
    { cmd: "q", args: "", desc: "Exits the debug terminal." },
    { cmd: "r2d2_bitmaps", args: "", desc: "Enumerate R2D2 bitmaps" },
    { cmd: "remove_plugin", args: "", desc: "Remove a plugin from the account and device." },
    { cmd: "sgnodes", args: "", desc: "List SceneGraph nodes." },
    { cmd: "sgperf", args: "", desc: "SceneGraph node operation performance metrics." },
    { cmd: "showkey", args: "", desc: "Show the current developer key." },
    { cmd: "target", args: "list | <n> | <name> | -p <pid>)", desc: "List or select command execution target" },
    { cmd: "type", args: "", desc: "Send a literal text sequence." }
];

function getHelpText(command) {
    if (!command) {
        return HELP_COMMANDS.map(c => {
            const prefix = c.cmd + (c.args ? ` ${c.args}` : "");
            const padding = prefix.length >= 24 ? " " : " ".repeat(24 - prefix.length);
            return `${prefix}${padding}${c.desc}`;
        }).join("\r\n") + "\r\n";
    }
    const found = HELP_COMMANDS.find(c => c.cmd.toLowerCase() === command.toLowerCase());
    if (found) {
        const prefix = found.cmd + (found.args ? ` ${found.args}` : "");
        const padding = prefix.length >= 24 ? " " : " ".repeat(24 - prefix.length);
        return `${prefix}${padding}${found.desc}\r\n`;
    }
    return `No help found for '${command}'.\r\n`;
}

export function enableDebugServer() {
    if (isDebugEnabled) {
        return;
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
        client.write(`Connected to ${app.getName()} Debug Server\r\n> `);
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
    server.listen(DEBUG_PORT);
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
function processData(data, id) {
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
    if (step.char === null) {
        if (!step.client.destroyed) {
            step.client.write(">");
        }
        processTypeQueue();
    } else {
        if (!step.client.destroyed) {
            step.window.webContents.send("postKeyPress", `lit_${step.char}`);
        }
        setTimeout(processTypeQueue, 50);
    }
}

function sendDebugCommand(line, client) {
    const expr = line.trim().split(/(?<=^\S+)\s/);
    const cmd = expr[0].toLowerCase();
    
    if (cmd === "exit" || cmd === "quit" || cmd === "q") {
        client.write("bye!\r\n");
        client.destroy();
        return;
    } else if (cmd === "help" || cmd === "?") {
        const arg = expr[1] ? expr[1].trim() : "";
        client.write(getHelpText(arg));
    } else if (cmd === "type") {
        const text = expr[1] || "";
        const window = BrowserWindow.fromId(1);
        if (window) {
            for (const char of text) {
                typeQueue.push({ char, window, client });
            }
            typeQueue.push({ char: null, window, client });
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
