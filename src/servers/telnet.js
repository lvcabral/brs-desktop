import { app, ipcMain } from "electron";
import telnet, { Server } from "telnet";
const PORT = 8085;
let server;

export let isTelnetEnabled = false;
export function enableTelnet(window) {
    if (isTelnetEnabled) {
        return;
    }
    server = telnet.createServer(function (client) {
        // listen for the actual data from the client
        client.on("data", (data) => {
            client.write("\n");
        });
        // Handle exceptions from the client
        client.on("error", (e) => {
            if(e.code === "ECONNRESET" || e.code ==="ECONNABORTED") {
                window.webContents.send("console", "Telnet client quit unexpectedly.");
            } else {
                window.webContents.send("console", `Telnet server error: ${e.message}`, true);
            }
        });
        client.write(`Connected to ${app.getName()}\n`);
        ipcMain.on("telnet", (event, text)=>{
            client.write(`${text}\n`);
        })
    });
    server.on("listening", () => {
        isTelnetEnabled = true;
        window.webContents.send("toggleTelnet", true, PORT);
    })
    server.on("error", (error) => {
        window.webContents.send("console", `Telnet server error: ${error.message}`, true);
    });
    server.listen(PORT);
}

export function disableTelnet(window) {
    if (server) {
        server.close();
    }
    isTelnetEnabled = false;
    window.webContents.send("toggleTelnet", false);
}