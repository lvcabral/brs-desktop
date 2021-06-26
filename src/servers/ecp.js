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
const MAC = getMacAddress();
const UDN = "404d7944-8d29-45e3-8ef3-" + MAC.replace(/:\s*/g, "");
let window;
let device;
let ecp;
let ssdp;

export let isECPEnabled = false;
export function initECP(deviceInfo) {
    device = deviceInfo;    
}
export function enableECP(mainWindow) {
    window = mainWindow;
    if (isECPEnabled) {
        return; // already started do nothing
    }
    // Create ECP Server
    ecp = require("restana")({
        ignoreTrailingSlash: true
    });
    ecp.getServer().on("error", (error)=>{
        window.webContents.send("console",`Failed to start ECP server:${error.message}`, true);
    })
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
    // ecp.use((req, res, next) => {
    //     console.log(req.url, req.method, req.headers);
    //     return next();
    //   });
    ecp.start(ECPPORT)
    .catch((error)=>{
        window.webContents.send("console",`ECP server error:${error.message}`, true);
    })
    .then((server)=>{
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
        .catch((e) => {
            window.webContents.send("console",`Failed to start SSDP server:${e.message}`, true);
        })
        .then(() => {
            isECPEnabled = true;
            window.webContents.send("toggleECP", true, ECPPORT);
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
    window.webContents.send("toggleECP", false);    
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
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, UDN);
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "Roku");
    xml.ele("model-name", {}, getModelName(device.deviceModel));
    xml.ele("model-number", {}, device.deviceModel);
    xml.ele("model-region", {}, device.countryCode);
    xml.ele("is-tv", {}, false);
    xml.ele("is-stick", {}, false);
    xml.ele("ui-resolution", {}, device.displayMode);
    xml.ele("wifi-mac", {}, MAC);
    xml.ele("ethernet-mac", {}, MAC);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "Local");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, getModelName(device.deviceModel));
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, device.firmwareVersion);
    xml.ele("software-version", {}, "9.1.0");
    xml.ele("software-build", {}, "4111");
    xml.ele("secure-device", {}, true);
    xml.ele("language", {}, device.locale.split("_")[0]);
    xml.ele("country", {}, device.locale.split("_")[1]);
    xml.ele("locale", {}, device.locale);
    xml.ele("time-zone-auto", {}, true);
    xml.ele("time-zone", {}, device.timeZone);
    xml.ele("time-zone-name", {}, device.timeZone);
    xml.ele("time-zone-tz", {}, device.timeZone);
    xml.ele("time-zone-offset", {}, -(new Date().getTimezoneOffset()));
    xml.ele("clock-format", {}, device.clockFormat);
    xml.ele("uptime", {}, Math.round(process.uptime()));
    xml.ele("power-mode", {}, "PowerOn");
    xml.ele("support-suspend", {}, false);
    xml.ele("support-find-remote", {}, false);
    xml.ele("support-audio-guide", {}, false);
    xml.ele("support-rva", {}, true);
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
    xml.ele("search-enabled", {}, false);
    xml.ele("search-channels-enabled", {}, false);
    xml.ele("voice-search-enabled", {}, false);
    xml.ele("notifications-enabled", {}, true);
    xml.ele("notifications-first-use", {}, false);
    xml.ele("supports-private-listeninig", {}, false);
    xml.ele("headphones-connected", {}, false);
    xml.ele("supports-ecs-textedit", {}, true);
    xml.ele("supports-ecs-microphone", {}, false);
    xml.ele("supports-wake-on-wlan", {}, false);
    xml.ele("has-play-on-roku", {}, true);
    xml.ele("has-mobile-screensaver", {}, false);
    xml.ele("support-url", {}, "roku.com/support");
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
    const appMenu = app.applicationMenu;
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
        window.webContents.send("console", `ECP Launch: File not found! App Id=${req.params.appID}`, true);
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
        } else if (ifname.substr(0, 6).toLowerCase() === "vmware" ||
        ifname.substr(0, 10).toLowerCase() === "virtualbox") {
            return;
        }
        mac = iface.mac;
        return;
      });
    });   
    if (mac === "") {
        mac = "87:3e:aa:9f:77:70";
    }
    return mac;
}
