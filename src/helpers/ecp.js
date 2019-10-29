import { BrowserWindow } from "electron";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";

const ECPPORT = 8060;
const SSDPPORT = 1900;
let window;

export function enableECP(mainWindow) {
    window = mainWindow;

    // Create ECP Server
    const restana = require("restana")({
        ignoreTrailingSlash: true
    });
    restana.get("/query/device-info", getDeviceInfo);
    restana.get("//query/device-info", getDeviceInfo);
    restana.post("/keypress/:key", postKeyPress);
    restana.post("/keydown/:key", postKeyDown);
    restana.post("/keyup/:key", postKeyUp);
    restana.start(ECPPORT).then((server)=>{
        console.log(`ECP server started listening port ${server.address().port}`);
    });
    // Create SSDP Server
    const ssdp = new SSDP({
        location: {
            port: ECPPORT,
            path: "/",            
            adInterval: 120000,
            udn: "uuid:roku:ecp:BRSEMUAPP070"
        },
        ssdpPort: SSDPPORT,
        suppressRootDeviceAdvertisements: true
    });
    ssdp.addUSN("roku:ecp");
    // Start server on all interfaces
    ssdp.start()
    .catch(e => {
        console.error("Failed to start SSDP server:", e);
    })
    .then(() => {
        console.log(`SSDP Server started listening port ${SSDPPORT}`);
    });
}

function getDeviceInfo(req, res) {
    let xml = xmlbuilder.create("device-info");
    xml.ele("device-id",{},"BRSEMUAPP070");
    xml.ele("default-device-name",{},"BrightScript Emulator - BRSEMUAPP070");
    xml.ele("model-number",{},"8000X");
    res.send(xml.end({ pretty: true }));
}

function postKeyDown(req, res) {
    window.webContents.send("postKeyDown", req.params.key);
}

function postKeyUp(req, res) {
    window.webContents.send("postKeyUp", req.params.key);
}

function postKeyPress(req, res) {
    window.webContents.send("postKeyPress", req.params.key);
}