import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";

const ECPPORT = 8060;
const SSDPPORT = 1900;
let window;
let device;

export function enableECP(mainWindow, deviceInfo) {
    window = mainWindow;
    device = deviceInfo;
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
    const mac = getMacAddress();
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, "404d7944-8d29-45e3-8ef3-873eaa9f7769");
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("model-number", {}, device.deviceModel);
    xml.ele("model-region", {}, "US");
    xml.ele("is-tv", {}, false);
    xml.ele("is-stick", {}, false);
    xml.ele("wifi-mac", {}, mac);
    xml.ele("ethernet-mac", {}, mac);
    xml.ele("locale", {}, device.locale);
    xml.ele("time-zone", {}, device.timeZone);
    xml.ele("clock-format", {}, device.clockFormat);
    xml.ele("uptime", {}, Math.round(process.uptime()));
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
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

function getMacAddress() {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    let mac = "";
    Object.keys(ifaces).forEach(function (ifname) {   
        if (mac !== "" ) {
            return;
        }
        ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
          // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
          return;
        }
        mac = iface.mac;
        return;
      });
    });
    return mac;
}
