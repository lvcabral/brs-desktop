import { app } from "electron";
import { 
    getChannelIds, 
    getPackages, 
    getRecentPackage, 
    getRecentId,
    getRecentName,
    getRecentVersion
} from "../menu/menuService";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";
import fs from "fs";
import path from "path";

const ECPPORT = 8060;
const SSDPPORT = 1900;
const UDN = "404d7944-8d29-45e3-8ef3-873eaa9f7770";
let window;
let device;
let ecp;
let ssdp;

export let isECPEnabled = false;
export function initECP(mainWindow, deviceInfo) {
    window = mainWindow;
    device = deviceInfo;    
}
export function enableECP() {
    if (isECPEnabled) {
        return; // already started do nothing
    }
    // Create ECP Server
    ecp = require("restana")({
        ignoreTrailingSlash: true
    });
    ecp.get("/", getDeviceRoot);
    ecp.get("/device-image.png", getDeviceImage);
    ecp.get("/ecp_SCPD.xml", getScpdXML)
    ecp.get("/dial_SCPD.xml", getScpdXML)
    ecp.get("/ecp-session", getScpdXML)
    ecp.get("/query/device-info", getDeviceInfo);
    ecp.get("//query/device-info", getDeviceInfo);
    ecp.get("/query/apps", getApps);
    ecp.get("/query/active-app", getActiveApp);
    ecp.get("/query/icon/:appID", getAppIcon);
    ecp.post("/launch/:appID", postLaunchApp);
    ecp.post("/keypress/:key", postKeyPress);
    ecp.post("/keydown/:key", postKeyDown);
    ecp.post("/keyup/:key", postKeyUp);
    ecp.start(ECPPORT)
    .catch(e => {
        console.error("Failed to start ECP server:", e);
    })
    .then((server)=>{
        console.log(`ECP server started listening port ${server.address().port}`);
        // Create SSDP Server
        ssdp = new SSDP({
            location: {
                port: ECPPORT,
                path: "/",            
            },
            adInterval: 120000,
            ttl: 3600,
            udn: `uuid:roku:ecp:${device.serialNumber}`,
            ssdpSig: "Roku UPnP/1.0 Roku/9.1.0",
            ssdpPort: SSDPPORT,
            suppressRootDeviceAdvertisements: true,
            headers: {"device-group.roku.com": "46F5CCE2472F2B14D77"},
            // customLogger(text, ...args) {
            //     if (text.substr(0,13) === "Sending a 200") {
            //         console.log(text, ...args);
            //     }
            // }
        });
        ssdp.addUSN("roku:ecp");
        ssdp._usns["roku:ecp"] = `uuid:roku:ecp:${device.serialNumber}`;
        // Start server on all interfaces
        ssdp.start()
        .catch(e => {
            console.error("Failed to start SSDP server:", e);
        })
        .then(() => {
            console.log(`SSDP server started listening port ${SSDPPORT}`);
            isECPEnabled = true;
        });
    });
}

export function disableECP() {
    if (ecp) {
        ecp.close();
    }
    if (ssdp) {
        ssdp.stop();
    }
    isECPEnabled = false;
    console.log("ECP and SSDP Servers disabled.");
}

// REST API Methods
function getDeviceRoot(req, res) {
    let xml = xmlbuilder.create("root").att("xmlns", "urn:schemas-upnp-org:device-1-0");
    let spec = xml.ele("specVersion");
    spec.ele("major", {}, 1);
    spec.ele("minor", {}, 0);
    let xmlDevice = xml.ele("device");
    xmlDevice.ele("deviceType", {}, "urn:roku-com:device:player:1-0");
    xmlDevice.ele("friendlyName", {}, device.friendlyName);
    xmlDevice.ele("manufacturer", {}, "Roku");
    xmlDevice.ele("manufacturerURL", {}, "http://www.roku.com/");
    xmlDevice.ele("modelDescription", {}, app.getName());
    xmlDevice.ele("modelName", {}, getModelName(device.deviceModel));
    xmlDevice.ele("modelNumber", {}, device.deviceModel);
    xmlDevice.ele("modelURL", {}, "http://www.lvcabral.com/brs/");
    xmlDevice.ele("serialNumber", {}, device.serialNumber);
    xmlDevice.ele("UDN", {}, `uuid:${UDN}`);
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
    res.setHeader("content-type", "application/xml");
    res.send(xml.end({ pretty: true }));
}

function getDeviceInfo(req, res) {
    const mac = getMacAddress();
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, UDN);
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "Roku");
    xml.ele("model-name", {}, getModelName(device.deviceModel));
    xml.ele("model-number", {}, device.deviceModel);
    xml.ele("model-region", {}, "US");
    xml.ele("is-tv", {}, false);
    xml.ele("is-stick", {}, false);
    xml.ele("wifi-mac", {}, mac);
    xml.ele("ethernet-mac", {}, mac);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "Local");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, getModelName(device.deviceModel));
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
    xml.ele("support-rva", {}, true);
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
    xml.ele("search-enabled", {}, true);
    xml.ele("search-channels-enabled", {}, true);
    xml.ele("voice-search-enabled", {}, true);
    xml.ele("notifications-enabled", {}, true);
    xml.ele("notifications-first-use", {}, false);
    xml.ele("supports-private-listeninig", {}, false);
    xml.ele("headphones-connected", {}, false);
    xml.ele("supports-ecs-textedit", {}, true);
    xml.ele("supports-ecs-microphone", {}, true);
    xml.ele("supports-wake-on-wlan", {}, false);
    xml.ele("has-play-on-roku", {}, true);
    xml.ele("has-mobile-screensaver", {}, false);
    res.setHeader("content-type", "application/xml");
    res.send(xml.end({ pretty: true }));
}

function getApps(req, res) {
    const xml = xmlbuilder.create("apps");
    getPackages().forEach((value, index) => {
        xml.ele(
            "app", 
            {id: getRecentId(index), 
                subtype: "sdka", 
                type: "appl", 
                version: getRecentVersion(index)}, 
                getRecentName(index)
        );
    });
    res.setHeader("content-type", "application/xml");
    res.send(xml.end({ pretty: true }));
}

function getActiveApp(req, res) {
    const xml = xmlbuilder.create("apps");
    const id = getRecentId(0);
    const appMenu = app.getApplicationMenu();
    if (id && appMenu.getMenuItemById("close-channel").enabled) {
        xml.ele(
            "app", 
            {id: id, 
                subtype: "sdka", 
                type: "appl", 
                version: getRecentVersion(0)}, 
                getRecentName(0)
        );
    } else {
        xml.ele("app", {}, app.getName());
    }    
    res.setHeader("content-type", "application/xml");
    res.send(xml.end({ pretty: true }));
}

function getDeviceImage(req, res) {
    let image = fs.readFileSync(path.join(__dirname, "images", "device-image.png"));
    res.setHeader("content-type", "image/png");
    res.send(image);
}

function getScpdXML(req, res) {
    let file = fs.readFileSync(path.join(__dirname, "web", "ecp_SCPD.xml"));
    res.setHeader("content-type", "application/xml");
    res.send(file);
}

function getAppIcon(req, res) {
    let image;
    let index = getChannelIds().indexOf(req.params.appID);
    if (index >= 0) {
        const iconPath = path.join(app.getPath("userData"), getRecentId(index) + ".png");
        if (fs.existsSync(iconPath)) {
            image = fs.readFileSync(iconPath);
        }
    } 
    if (image === undefined) {
        image = fs.readFileSync(path.join(__dirname, "images", "channel-icon.png"));
    }    
    res.setHeader("content-type", "image/png");
    res.send(image);
}

function postLaunchApp(req, res) {
    let index = getChannelIds().indexOf(req.params.appID);
    if (index >= 0) {
        let zip = getRecentPackage(index);
        if (zip) {
            window.webContents.send("fileSelected", [zip]);
        }    
    } else {
        console.error("ECP Launch: File not found!");
    }
    res.end();
}

function postKeyDown(req, res) {
    window.webContents.send("postKeyDown", req.params.key);
    res.end();
}

function postKeyUp(req, res) {
    window.webContents.send("postKeyUp", req.params.key);
    res.end();
}

function postKeyPress(req, res) {
    window.webContents.send("postKeyPress", req.params.key);
    res.end();
}

// Helper Functions
function getModelName(model) {
    return `Roku ${model === "4640X" ? "Ultra" : model === "4200X" ? "3" : "2"}`;
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
