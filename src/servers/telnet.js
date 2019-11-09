import { app, ipcMain } from "electron";
import telnet from "telnet";
const PORT = 8085
let server;

export function enableTelnet() {
    server = telnet.createServer(function (client) {
        // listen for the actual data from the client
        client.on('data', function (b) {
            console.log(b.toString());
            client.write("\n");
        });
        // Handle exceptions from the client
        client.on('error', function(e) {
            if(e.code === "ECONNRESET" || e.code ==="ECONNABORTED") {
                console.log("Telnet client quit unexpectedly.");
            } else {
                console.error("Telnet server error:", e);
            }
        });
        client.write(`Connected to ${app.getName()}\n`);
        ipcMain.on("telnet", (event, text)=>{
            client.write(`${text}\n`);
        })
    }).listen(PORT);
    if (server) {
        console.log(`Telnet server started listening port ${PORT}`);
    }
}

export function disableTelnet() {
    if (server) {
        server.close();
    }
}