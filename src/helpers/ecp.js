import { app } from "electron";
import { getPackages, getRecentPackage } from "../menu/menuService";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";
import fs from "fs";
import path from "path";

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
    restana.get("/", getDeviceRoot);
    restana.get("/device-image.png", getDeviceImage);
    restana.get("/ecp_SCPD.xml", getScpdXML)
    restana.get("/ecp-session", getScpdXML)
    restana.get("/query/device-info", getDeviceInfo);
    restana.get("//query/device-info", getDeviceInfo);
    restana.get("/query/apps", getApps);
    restana.get("/query/active-app", getActiveApp);
    restana.get("/query/icon/:appID", getAppIcon);
    restana.post("/launch/:appID", postLaunchApp);
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
        },
        adInterval: 120000,
        ttl: 3600,
        udn: "uuid:roku:ecp:1GN397202670",
        ssdpSig: "Roku UPnP/1.0 Roku/9.1.0",
        ssdpPort: SSDPPORT,
        suppressRootDeviceAdvertisements: true,
        headers: {"device-group.roku.com": "46F5CCE2472F2B14D77"},
        customLogger(text, ...args) {
            if (text.substr(0,13)==="Sending a 200") {
                console.log(text, args);
            }
        }
    });
    ssdp.addUSN("roku:ecp");
    ssdp._usns["roku:ecp"] = "uuid:roku:ecp:1GN397202670";
    // Start server on all interfaces
    ssdp.start()
    .catch(e => {
        console.error("Failed to start SSDP server:", e);
    })
    .then(() => {
        console.log(`SSDP Server started listening port ${SSDPPORT}`);
    });
}
// REST API Functions
function getDeviceRoot(req, res) {
    console.log("Requested root");
    let xml = xmlbuilder.create("root").att("xmlns", "urn:schemas-upnp-org:device-1-0");
    let spec = xml.ele("specVersion");
    spec.ele("major", {}, 1);
    spec.ele("minor", {}, 0);
    let xmlDevice = xml.ele("device");
    xmlDevice.ele("deviceType", {}, "urn:roku-com:device:player:1-0");
    xmlDevice.ele("friendlyName", {}, device.friendlyName);
    xmlDevice.ele("manufacturer", {}, "Roku");
    xmlDevice.ele("manufacturerURL", {}, "http://www.roku.com/");
    xmlDevice.ele("modelDescription", {}, "Roku Streaming Player Network Media");
    xmlDevice.ele("modelName", {}, "Roku 3");
    xmlDevice.ele("modelNumber", {}, "4200X");
    xmlDevice.ele("modelURL", {}, "http://www.roku.com/");
    xmlDevice.ele("serialNumber", {}, "1GN397202670");
    xmlDevice.ele("UDN", {}, "uuid:404d7944-8d29-45e3-8ef3-873eaa9f7770");
    let xmlList = xmlDevice.ele("serviceList");
    let xmlService = xmlList.ele("service");
    xmlService.ele("serviceType", {}, "urn:roku-com:service:ecp:1");
    xmlService.ele("serviceId", {}, "urn:roku-com:serviceId:ecp1-0");
    xmlService.ele("controlURL");
    xmlService.ele("eventSubURL");
    xmlService.ele("SCPDURL", {}, "ecp_SCPD.xml");
    let xmlDial = xmlList.ele("service");
    xmlDial.ele("serviceType", {}, "urn:dial-multiscreen-org:service:dial:1");
    xmlDial.ele("serviceId", {}, "urn:dial-multiscreen-org:serviceId:dial1-0");
    xmlDial.ele("controlURL");
    xmlDial.ele("eventSubURL");
    xmlDial.ele("SCPDURL", {}, "dial_SCPD.xml");
    res.send(xml.end({ pretty: true }));
}

function getDeviceInfo(req, res) {
    console.log("Requested info");
    const mac = getMacAddress();
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, "404d7944-8d29-45e3-8ef3-873eaa9f7770");
    xml.ele("serial-number", {}, "1GN397202670");
    xml.ele("device-id", {}, "1GN397202670");
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "Roku");
    xml.ele("model-name", {}, "Roku 3");
    xml.ele("model-number", {}, "4200X");
    xml.ele("model-region", {}, "US");
    xml.ele("is-tv", {}, false);
    xml.ele("is-stick", {}, false);
    xml.ele("wifi-mac", {}, mac);
    xml.ele("ethernet-mac", {}, mac);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "Embratel");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, "Roku 3");
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, "049.20E04131A");
    xml.ele("software-version", {}, "9.1.0");
    xml.ele("software-build", {}, "4111");
    xml.ele("secure-device", {}, true);
    xml.ele("language", {}, device.locale.split("_")[0]);
    xml.ele("country", {}, device.locale.split("_")[1]);
    xml.ele("locale", {}, device.locale);
    xml.ele("time-zone-auto", {}, true);
    xml.ele("time-zone", {}, device.timeZone);
    xml.ele("time-zone-name", {}, "United States/Arizona");
    xml.ele("time-zone-tz", {}, "America/Phoenix");
    xml.ele("time-zone-offset", {}, "-420");
    xml.ele("clock-format", {}, device.clockFormat);
    xml.ele("uptime", {}, Math.round(process.uptime()));
    xml.ele("power-mode", {}, "PowerOn");
    xml.ele("support-suspend", {}, false);
    xml.ele("support-find-remote", {}, false);
    xml.ele("support-audio-guide", {}, false);
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
    xml.ele("search-enabled", {}, false);
    xml.ele("search-channels-enabled", {}, false);
    xml.ele("voice-search-enabled", {}, false);
    xml.ele("notifications-enabled", {}, false);
    xml.ele("supports-private-listeninig", {}, false);
    res.send(xml.end({ pretty: true }));
}

function getApps(req, res) {
    let xml = xmlbuilder.create("apps");
    getPackages().forEach((value, index) => {
        xml.ele("app", {id: index > 0 ? 100+index : "dev", subtype: "sdka", type: "appl", version: "1.0.0"}, `dev${index}`);
    });
    res.send(xml.end({ pretty: true }));
}

function getActiveApp(req, res) {
    const xml = xmlbuilder.create("apps");
    const zip = getRecentPackage(0);
    const appMenu = app.getApplicationMenu();
    if (zip && appMenu.getMenuItemById("close-channel").enabled) {
        xml.ele("app", {id: "dev", subtype: "sdka", type: "appl", version: "1.0.0"}, zip);
    } else {
        xml.ele("app", {}, app.getName());
    }    
    res.send(xml.end({ pretty: true }));
}

function getDeviceImage(req, res) {
    let image = fs.readFileSync(path.join(__dirname, "images/device-image.png"));
    res.send(image);
}

function getScpdXML(req, res) {
    let file = fs.readFileSync(path.join(__dirname, "ecp_SCPD.xml"));
    res.send(file);
}

function getAppIcon(req, res) {
    console.log("Get App Icon:", req.params.appID);
    let image = fs.readFileSync(path.join(__dirname, "images/channel-icon.png"));
    res.send(image);
}

function postLaunchApp(req, res) {
    let index = parseInt(req.params.appID.substr(-1));
    if (req.params.appID === "dev") {
        index = 0;
    }
    let zip = getRecentPackage(index);
    if (zip) {
        window.webContents.send("fileSelected", [zip]);
    }    
    res.send("OK");
}

function postKeyDown(req, res) {
    window.webContents.send("postKeyDown", req.params.key);
    res.send("OK");
}

function postKeyUp(req, res) {
    window.webContents.send("postKeyUp", req.params.key);
    res.send("OK");
}

function postKeyPress(req, res) {
    window.webContents.send("postKeyPress", req.params.key);
    res.send("OK");
}

// Helper Functions
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
