import { app } from "electron";
import { 
    getChannelIds, 
    getPackages, 
    getRecentPackage, 
    getRecentId,
    getRecentName,
    getRecentVersion
} from "../menu/menuService";
import { loadFile } from "../helpers/files";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";
import fs from "fs";
import path from "path";

const WebSocket = require('ws');
const url = require('url');

const DEBUG = false;
const ECPPORT = 8060;
const SSDPPORT = 1900;
const MAC = getMacAddress();
const UDN = "138aedd0-d6ad-11eb-b8bc-" + MAC.replace(/:\s*/g, "");
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
    });
    ecp.get("/", sendDeviceRoot);
    ecp.get("/device-image.png", sendDeviceImage);
    ecp.get("/ecp_SCPD.xml", sendScpdXML)
    ecp.get("/dial_SCPD.xml", sendScpdXML)
    ecp.get("/query/device-info", sendDeviceInfo);
    ecp.get("//query/device-info", sendDeviceInfo);
    ecp.get("/query/apps", sendApps);
    ecp.get("/query/active-app", sendActiveApp);
    ecp.get("/query/icon/:appID", sendAppIcon);
    ecp.post("/launch/:appID", sendLaunchApp);
    ecp.post("/keypress/:key", sendKeyPress);
    ecp.post("/keydown/:key", sendKeyDown);
    ecp.post("/keyup/:key", sendKeyUp);
    if (DEBUG) {
        ecp.use((req, res, next) => {
            console.log(req.url, req.method, req.headers);
            return next();
        });
    }
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
        // Create ECP-2 WebSocket Server
        const wss = new WebSocket.Server({ noServer: true });
        wss.on('connection', function connection(ws) {
            const auth = `{"notify":"authenticate","param-challenge":"jONQirQ3WxSQWdI9Zn0enA==","timestamp":"${process.uptime().toFixed(3)}"}`;
            if (DEBUG) {console.log("received connection!", auth);}
            ws.send(auth);
            ws.on("message", function incoming(message) {
                processRequest(ws, message);
            });
            ws.on('ping', function heartbeat(p) {
                ws.pong();
            });
    	});
        server.on("upgrade", function upgrade(request, socket, head) {
            const pathname = url.parse(request.url).pathname;
            if (pathname === '/ecp-session') {
                if (DEBUG) {console.log("ecp-2 websocket session started!");}
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    wss.emit('connection', ws, request);
                });
            } else {
              socket.destroy();
            }
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

// ECP-2 WebSocket API
function processRequest(ws, message) {
    if (message) {
        if (DEBUG) {console.log('received: %s', message);}
        let reply = "";
        let msg;
        try {
            msg = JSON.parse(message);            
        } catch (error) {
            console.warn("invalid ecp-2 message:", message);
            return;
        }
        const statusOK = `"response":"${msg["request"]}","response-id":"${msg["request-id"]}","status":"200","status-msg":"OK"`;
        if (msg["request"] == "authenticate" && msg["param-response"]) {
            reply = `{${statusOK}}`;
        } else if (msg["request"] == "query-device-info") {
            reply = `{"content-data":"${genDeviceInfoXml(true)}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-themes") {
            reply = `{"content-data":"${genThemesXml(true)}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-screensavers") {
            reply = `{"content-data":"${genScrsvXml(true)}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-apps") {
            reply = `{"content-data":"${genAppsXml(true)}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-icon") {
            reply = `{"content-data":"${genAppIcon(msg["param-channel-id"], true)}","content-type":"image/png",${statusOK}}`;
        } else if (msg["request"] == "query-tv-active-channel") {
            reply = `{"content-data":"${genActiveApp(true)}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "launch") {
            launchApp(msg["param-channel-id"]);
            reply = `{${statusOK}}`;
        } else if (msg["request"] == "request-events") {
            reply = `{${statusOK}}`;
        } else if (msg["request"] == "query-media-player") {
            const content = Buffer.from(`<?xml version="1.0" encoding="UTF-8" ?>`).toString('base64');
            reply = `{"content-data":"${content}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-audio-device") {
            const content = Buffer.from(`<?xml version="1.0" encoding="UTF-8" ?>`).toString('base64');
            reply = `{"content-data":"${content}","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
        } else if (msg["request"] == "query-textedit-state") {
            const content = Buffer.from(`{"textedit-state":{"textedit-id":"none"}}`).toString('base64');
            reply = `{"content-data":"${content}","content-type":"application/json",${statusOK}}`;
        } else if (msg["request"] == "key-press") {
            window.webContents.send("postKeyPress", msg["param-key"]);
            reply = `{${statusOK}}`;
        }
        if (reply !== "") {
            if (DEBUG) {console.log(`replying: %s`, reply)}
            ws.send(reply);
        } else if (DEBUG) {
            console.log(`no reply for: %s`, msg["request-id"]);
        }
    }
}

// ECP REST API Methods
function sendDeviceRoot(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genDeviceRootXml());
}

function sendDeviceInfo(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genDeviceInfoXml(false));
}

function sendApps(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppsXml(false));
}

function sendActiveApp(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genActiveApp(false));
}

function sendDeviceImage(req, res) {
    let image = fs.readFileSync(path.join(__dirname, "images", "device-image.png"));
    res.setHeader("content-type", "image/png");
    res.send(image);
}

function sendScpdXML(req, res) {
    let file = fs.readFileSync(path.join(__dirname, "web", "ecp_SCPD.xml"));
    res.setHeader("content-type", "application/xml");
    res.send(file);
}

function sendAppIcon(req, res) {
    res.setHeader("content-type", "image/png");
    res.send(genAppIcon(req.params.appID, false));
}

function sendLaunchApp(req, res) {
    launchApp(req.params.appID);
    res.end();
}

function sendKeyDown(req, res) {
    window.webContents.send("postKeyDown", req.params.key);
    res.end();
}

function sendKeyUp(req, res) {
    window.webContents.send("postKeyUp", req.params.key);
    res.end();
}

function sendKeyPress(req, res) {
    window.webContents.send("postKeyPress", req.params.key);
    res.end();
}

// Content Generation Functions
function genDeviceRootXml() {
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
    return xml.end({ pretty: true });
}

function genDeviceInfoXml(encrypt) {
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, UDN);
    if (encrypt) {xml.ele("virtual-device-id", {}, device.serialNumber);}
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
    xml.ele("has-play-on-roku", {}, false);
    xml.ele("has-mobile-screensaver", {}, false);
    xml.ele("support-url", {}, "roku.com/support");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString('base64') : strXml;
}

function genThemesXml(encrypt) {
    const xml = xmlbuilder.create("themes");
    xml.ele("theme", {id: "brand", selected: true }, "Roku (default)");
    xml.ele("theme", {id: "Graphene"}, "Graphene");
    xml.ele("theme", {id: "Brown"}, "Decaf");
    xml.ele("theme", {id: "Space"}, "Nebula");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString('base64') : strXml;
}

function genScrsvXml(encrypt) {
    const xml = xmlbuilder.create("screensavers");
    xml.ele("screensaver", {default: true, id: "5533", selected: true }, "Roku Digital Clock");
    xml.ele("screensaver", {id: "5534"}, "Roku Analog Clock");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString('base64') : strXml;
}

function genAppsXml(encrypt) {
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
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString('base64') : strXml;
}

function genAppIcon(appID, encrypt) {
    let image;
    let index = getChannelIds().indexOf(appID);
    if (index >= 0) {
        const iconPath = path.join(app.getPath("userData"), getRecentId(index) + ".png");
        if (fs.existsSync(iconPath)) {
            image = fs.readFileSync(iconPath);
        }
    } 
    if (image === undefined) {
        image = fs.readFileSync(path.join(__dirname, "images", "channel-icon.png"));
    }
    return encrypt ? image.toString('base64') : image;
}

function genActiveApp(encrypt) {
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
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString('base64') : strXml;
}

// Helper Functions
function launchApp(appID) {
    let index = getChannelIds().indexOf(appID);
    if (index >= 0) {
        let zip = getRecentPackage(index);
        if (zip) {
            loadFile([zip]);
        }    
    } else {
        window.webContents.send("console", `ECP Launch: File not found! App Id=${appID}`, true);
    }
}

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
