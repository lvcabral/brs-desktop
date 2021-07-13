import { app, ipcMain } from "electron";
import * as telnet from "net";
const PORT = 8085;
const BUFFER_SIZE = 700;
let server;
let clientId = 0;
let clients = new Map();
let buffer = [];

export let isTelnetEnabled = false;
export function enableTelnet(window) {
    app.applicationMenu.getMenuItemById("telnet").checked = true;
    if (isTelnetEnabled) {
        return;
    }
    server = telnet.createServer();

    server.on("connection", (client) => {
        let id = clientId;
        clientId++;
        // listen for the actual data from the client
        client.on("data", (data) => {
            // TODO: Handle debug commands
            let cmd = data.toString().toLowerCase();
            if (cmd.toLowerCase() === "close\r\n") {
                client.destroy();
            } else if (cmd === "exit\r\n" || cmd === "quit\r\n") {
                window.webContents.send("closeChannel", "Remote");
            } else if (cmd === "\x03\r\n" || cmd === "help\r\n") {
                client.write("BrightScript Emulator Remote Console");
                client.write("\r\nDebug features are not implemented yet.\r\n");
                client.write("\r\nCommands available are:\r\nhelp - show this commands list");
                client.write("\r\nclose - disconnects the console\r\nexit or quit - finish current channel execution\r\n>");
            } else {
                client.write(">");
            }
        });
        // Handle exceptions from the client
        client.on("error", (e) => {
            window.webContents.send("console", `Remote console client error: ${e.message}`, true);
            client.destroy();
        });
        client.on('close', function () {
            clients.delete(id);
        });
        client.write(`Connected to ${app.getName()}\r\n`);
        buffer.map((value) => {
            client.write(`${value.replace(/\r?\n/g, '\r\n')}\r\n`);
        });
        clients.set(id, client);
    });
    server.on("listening", () => {
        isTelnetEnabled = true;
        window.webContents.send("toggleTelnet", true, PORT);
        ipcMain.on("telnet", (event, text) => {
            if (buffer.length > BUFFER_SIZE) {
                buffer.shift();
            }
            buffer.push(text);
            clients.forEach((client, id) => {
                client.write(`${text.replace(/\r?\n/g, '\r\n')}\r\n`);
            });
        });
    });
    server.on("error", (error) => {
        window.webContents.send("console", `Remote console server error: ${error.message}`, true);
    });
    server.listen(PORT);
}

export function disableTelnet(window) {
    app.applicationMenu.getMenuItemById("telnet").checked = false;
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
        window.webContents.send("toggleTelnet", false);
    }
}