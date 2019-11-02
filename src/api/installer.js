import { app } from "electron";
import xmlbuilder from "xmlbuilder";
import fs from "fs";
import path from "path";
import { enableTelnet } from "./telnet";

const PORT = 80;
let server;

export let hasInstaller = false;
export function enableInstaller() {
    if (hasInstaller) {
        return; // already started do nothing
    }
    // Create Web Server
    server = require("restana")({
        ignoreTrailingSlash: true
    });
    server.get("/", getWebRoot);
    server.post("/plugin_install", postWebInstall);
    server.start(PORT)
    .catch(e => {
        console.error("Failed to start Installer server:", e);
    })
    .then((server)=>{
        console.log(`Installer server started listening port ${server.address().port}`);
        enableTelnet();
        hasInstaller = true;
    });
}

export function disableinstaller() {
    if (server) {
        server.close();
    }
    hasInstaller = false
    console.log("Installer server disabled.");
}

// REST API Methods
function getWebRoot(req, res) {
    res.setHeader("content-type", "text/plain");
    res.send("BrightScript Emulator Web Installer is enabled!");
}

function postWebInstall(req, res) {
    console.log(req.params);
    if (req.body) {
        const zipPath = path.join(app.getPath("userData"), "dev.zip");
        console.log("Installing zip package...", zipPath);
        fs.writeFileSync(zipPath, req.body);    
    } else {
        console.log("Empty body on Request!");
    }
    res.send("OK");
}
