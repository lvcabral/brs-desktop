/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { isValidIP } from "../helpers/util";
import { ECP_PORT, SSDP_PORT } from "../constants";
import { Server as SSDP } from "node-ssdp";
import xmlbuilder from "xmlbuilder";
import fs from "node:fs";
import path from "node:path";

const WebSocket = require("ws");
const url = require("node:url");
const DEBUG = false;
const MAC = getMacAddress();
const UDN = "138aedd0-d6ad-11eb-b8bc-" + MAC.replace(/:\s*/g, "");
let window;
let device;
let ecp;
let ssdp;
let currentApp;

ipcMain.on("currentApp", (_, data) => {
    currentApp = data;
});

export let isECPEnabled = false;
export function initECP() {
    device = globalThis.sharedObject.deviceInfo;
}
export function enableECP() {
    window = BrowserWindow.fromId(1);
    if (isECPEnabled) {
        return; // already started do nothing
    }
    // Create ECP Server
    ecp = require("restana")({
        ignoreTrailingSlash: true,
    });
    ecp.getServer().on("error", (error) => {
        window.webContents.send("console", `Failed to start ECP server:${error.message}`, true);
    });
    ecp.get("/", sendDeviceRoot);
    ecp.get("/device-image.png", sendDeviceImage);
    ecp.get("/ecp_SCPD.xml", sendScpdXML);
    ecp.get("/dial_SCPD.xml", sendScpdXML);
    ecp.get("/query/device-info", sendDeviceInfo);
    ecp.get("//query/device-info", sendDeviceInfo);
    ecp.get("/query/apps", sendApps);
    ecp.get("/query/active-app", sendActiveApp);
    ecp.get("/query/icon/:appID", sendAppIcon);
    ecp.get("/query/registry/:appID", sendRegistry);
    ecp.post("/input", sendInput);
    ecp.post("/input/:appID", sendInput);
    ecp.post("/launch/:appID", sendLaunchApp);
    ecp.post("/exit-app/:appID", sendExitApp);
    ecp.post("/keypress/:key", sendKeyPress);
    ecp.post("/keydown/:key", sendKeyDown);
    ecp.post("/keyup/:key", sendKeyUp);
    if (DEBUG) {
        ecp.use((req, res, next) => {
            console.log(req.url, req.method, req.headers);
            return next();
        });
    }
    ecp.start(ECP_PORT)
        .catch((error) => {
            window.webContents.send("console", `ECP server error:${error.message}`, true);
        })
        .then((server) => {
            // Create SSDP Server
            ssdp = new SSDP({
                location: {
                    port: ECP_PORT,
                    path: "/",
                },
                adInterval: 120000,
                ttl: 3600,
                udn: `uuid:roku:ecp:${device.serialNumber}`,
                ssdpSig: "Roku UPnP/1.0 Roku/9.1.0",
                ssdpPort: SSDP_PORT,
                suppressRootDeviceAdvertisements: true,
                headers: { "device-group.roku.com": "46F5CCE2472F2B14D77" },
            });
            ssdp.addUSN("roku:ecp");
            ssdp._usns["roku:ecp"] = `uuid:roku:ecp:${device.serialNumber}`;
            // Start server on all interfaces
            ssdp.start()
                .catch((e) => {
                    window.webContents.send(
                        "console",
                        `Failed to start SSDP server:${e.message}`,
                        true
                    );
                })
                .then(() => {
                    isECPEnabled = true;
                    notifyAll("enabled", true);
                });
            // Create ECP-2 WebSocket Server
            const wss = new WebSocket.Server({ noServer: true });
            wss.on("connection", function connection(ws) {
                const auth = `{"notify":"authenticate","param-challenge":"jONQirQ3WxSQWdI9Zn0enA==","timestamp":"${process
                    .uptime()
                    .toFixed(3)}"}`;
                if (DEBUG) {
                    console.log("received connection!", auth);
                }
                ws.send(auth);
                ws.on("message", function incoming(message) {
                    processRequest(ws, message);
                });
                ws.on("ping", function heartbeat(p) {
                    ws.pong();
                });
            });
            server.on("upgrade", function upgrade(request, socket, head) {
                const pathname = url.parse(request.url).pathname;
                if (pathname === "/ecp-session") {
                    if (DEBUG) {
                        console.log("ecp-2 websocket session started!");
                    }
                    wss.handleUpgrade(request, socket, head, function done(ws) {
                        wss.emit("connection", ws, request);
                    });
                } else {
                    socket.destroy();
                }
            });
        });
}

export function disableECP() {
    if (isECPEnabled) {
        if (ecp) {
            ecp.close();
        }
        if (ssdp) {
            ssdp.stop();
        }
        isECPEnabled = false;
        notifyAll("enabled", false);
    }
}

// Observers Handling
const observers = new Map();
export function subscribeECP(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeECP(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// ECP-2 WebSocket API
function processRequest(ws, message) {
    if (message) {
        if (DEBUG) {
            console.log("received: %s", message);
        }
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
        } else if (msg["request"]?.startsWith("query")) {
            reply = queryReply(msg, statusOK);
        } else if (msg["request"] == "launch") {
            notifyAll("launch", { appID: msg["param-channel-id"] });
            reply = `{${statusOK}}`;
        } else if (msg["request"] == "key-press") {
            window.webContents.send("postKeyPress", msg["param-key"], 300, 50);
            reply = `{${statusOK}}`;
        } else {
            // Reply OK to any other request, including "request-events"
            reply = `{${statusOK}}`;
        }
        if (DEBUG) {
            console.log(`replying: ${msg["request-id"]}:${msg["request"]} with ${reply}`);
        }
        ws.send(reply);
    }
}

function queryReply(msg, statusOK) {
    const request = msg["request"];
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    const xml64 = Buffer.from(xml).toString("base64");
    const template = `{"content-data":"$data","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
    let reply = `{${statusOK}}`;
    if (request == "query-device-info") {
        reply = template.replace("$data", genDeviceInfoXml(true));
    } else if (request == "query-themes") {
        reply = template.replace("$data", genThemesXml(true));
    } else if (request == "query-screensavers") {
        reply = template.replace("$data", genScrsvXml(true));
    } else if (request == "query-apps") {
        reply = template.replace("$data", genAppsXml(true));
    } else if (request == "query-icon") {
        reply = template.replace("$data", genAppIcon(msg["param-channel-id"], true));
        reply = reply.replace("text/xml", "image/png");
    } else if (request == "query-tv-active-channel") {
        reply = template.replace("$data", genActiveApp(true));
    } else if (msg["request"] == "query-media-player") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] == "query-audio-device") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] == "query-textedit-state") {
        const content = Buffer.from(`{"textedit-state":{"textedit-id":"none"}}`).toString("base64");
        reply = template.replace("$data", content);
        reply = reply.replace("text/xml", "application/json");
    }
    return reply;
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

function sendRegistry(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppRegistry(req.params.appID, false));
}

function sendInput(req, res) {
    const params = req.query ?? {};
    const sourceIp = req.socket.remoteAddress;
    if (sourceIp?.startsWith("::ffff:")) {
        params.source_ip_addr = sourceIp.slice(7);
    } else if (sourceIp?.startsWith("::1")) {
        params.source_ip_addr = "127.0.0.1";
    } else if (isValidIP(sourceIp)) {
        params.source_ip_addr = sourceIp;
    }
    window.webContents.send("postInputParams", params);
    res.end();
}

function sendLaunchApp(req, res) {
    notifyAll("launch", { appID: req.params.appID, query: req.query });
    res.end();
}

function sendExitApp(req, res) {
    window?.webContents.send("closeChannel", "EXIT_USER_NAV", req.params.appID);
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
    const xml = xmlbuilder.create("root").att("xmlns", "urn:schemas-upnp-org:device-1-0");
    const spec = xml.ele("specVersion");
    spec.ele("major", {}, 1);
    spec.ele("minor", {}, 0);
    const xmlDevice = xml.ele("device");
    xmlDevice.ele("deviceType", {}, "urn:roku-com:device:player:1-0");
    xmlDevice.ele("friendlyName", {}, device.friendlyName);
    xmlDevice.ele("manufacturer", {}, "Roku");
    xmlDevice.ele("manufacturerURL", {}, "https://www.roku.com/");
    xmlDevice.ele("modelDescription", {}, app.getName());
    xmlDevice.ele("modelName", {}, getModelName(device.deviceModel));
    xmlDevice.ele("modelNumber", {}, device.deviceModel);
    xmlDevice.ele("modelURL", {}, "https://www.lvcabral.com/brs/");
    xmlDevice.ele("serialNumber", {}, device.serialNumber);
    xmlDevice.ele("UDN", {}, `uuid:${UDN}`);
    const xmlIcons = xmlDevice.ele("iconList");
    const xmlIcon = xmlIcons.ele("icon");
    xmlIcon.ele("mimetype", {}, "image/png");
    xmlIcon.ele("width", {}, "360");
    xmlIcon.ele("height", {}, "219");
    xmlIcon.ele("depth", {}, "8");
    xmlIcon.ele("url", {}, "device-image.png");
    const xmlList = xmlDevice.ele("serviceList");
    const xmlService = xmlList.ele("service");
    xmlService.ele("serviceType", {}, "urn:roku-com:service:ecp:1");
    xmlService.ele("serviceId", {}, "urn:roku-com:serviceId:ecp1-0");
    xmlService.ele("controlURL");
    xmlService.ele("eventSubURL");
    xmlService.ele("SCPDURL", {}, "ecp_SCPD.xml");
    const xmlDial = xmlList.ele("service");
    xmlDial.ele("serviceType", {}, "urn:dial-multiscreen-org:service:dial:1");
    xmlDial.ele("serviceId", {}, "urn:dial-multiscreen-org:serviceId:dial1-0");
    xmlDial.ele("controlURL");
    xmlDial.ele("eventSubURL");
    xmlDial.ele("SCPDURL", {}, "dial_SCPD.xml");
    return xml.end({ pretty: true });
}

function genDeviceInfoXml(encrypt) {
    const xml = xmlbuilder.create("device-info");
    const modelName = getModelName(device.deviceModel);
    xml.ele("udn", {}, UDN);
    if (encrypt) {
        xml.ele("virtual-device-id", {}, device.serialNumber);
    }
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "Roku");
    xml.ele("model-name", {}, modelName);
    xml.ele("model-number", {}, device.deviceModel);
    xml.ele("model-region", {}, device.countryCode);
    xml.ele("is-tv", {}, modelName.toLowerCase().includes("tv"));
    xml.ele("is-stick", {}, modelName.toLowerCase().includes("stick"));
    xml.ele("ui-resolution", {}, device.displayMode);
    xml.ele("wifi-mac", {}, MAC);
    xml.ele("ethernet-mac", {}, MAC);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "Local");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, modelName);
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, device.firmwareVersion);
    xml.ele("software-version", {}, getRokuOS(device.firmwareVersion));
    xml.ele("software-build", {}, getRokuOS(device.firmwareVersion, false));
    xml.ele("secure-device", {}, true);
    xml.ele("language", {}, device.locale.split("_")[0]);
    xml.ele("country", {}, device.countryCode);
    xml.ele("locale", {}, device.locale);
    xml.ele("time-zone-auto", {}, device.timeZoneAuto);
    xml.ele("time-zone", {}, device.timeZone);
    xml.ele("time-zone-name", {}, device.timeZone);
    xml.ele("time-zone-tz", {}, device.timeZoneIANA);
    xml.ele("time-zone-offset", {}, device.timeZoneOffset);
    xml.ele("clock-format", {}, device.clockFormat);
    xml.ele("uptime", {}, Math.round(process.uptime()));
    xml.ele("power-mode", {}, "PowerOn");
    xml.ele("support-suspend", {}, false);
    xml.ele("support-find-remote", {}, false);
    xml.ele("support-audio-guide", {}, false);
    xml.ele("supports-audio-volume-control", {}, true);
    xml.ele("support-power-control", {}, true);
    xml.ele("support-rva", {}, true);
    xml.ele("developer-enabled", {}, true);
    xml.ele("keyed-developer-id", {}, device.developerId);
    xml.ele("search-enabled", {}, false);
    xml.ele("search-channels-enabled", {}, false);
    xml.ele("voice-search-enabled", {}, false);
    xml.ele("notifications-enabled", {}, true);
    xml.ele("notifications-first-use", {}, false);
    xml.ele("supports-private-listening", {}, false);
    xml.ele("headphones-connected", {}, false);
    xml.ele("supports-ecs-textedit", {}, true);
    xml.ele("supports-ecs-microphone", {}, false);
    xml.ele("supports-wake-on-wlan", {}, false);
    xml.ele("has-play-on-roku", {}, false);
    xml.ele("has-mobile-screensaver", {}, false);
    xml.ele("support-url", {}, "roku.com/support");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genThemesXml(encrypt) {
    const xml = xmlbuilder.create("themes");
    xml.ele("theme", { id: "brand", selected: true }, "Roku (default)");
    xml.ele("theme", { id: "Graphene" }, "Graphene");
    xml.ele("theme", { id: "Brown" }, "Decaf");
    xml.ele("theme", { id: "Space" }, "Nebula");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genScrsvXml(encrypt) {
    const xml = xmlbuilder.create("screensavers");
    xml.ele("screensaver", { default: true, id: "5533", selected: true }, "Roku Digital Clock");
    xml.ele("screensaver", { id: "5534" }, "Roku Analog Clock");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genAppsXml(encrypt) {
    const xml = xmlbuilder.create("apps");
    if (device.appList === undefined || device.appList.length < 2) {
        // Dummy app as Roku Deep Linking Tester requires at least 2 apps
        xml.ele("app", { id: "home", type: "appl", version: "1.0.0" }, "Home");
    }
    if (device?.appList.length) {
        for (const app of device.appList) {
            xml.ele("app", { id: app.id, type: "appl", version: app.version }, app.title);
        }
    }
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

function genAppIcon(appID, encrypt) {
    const image = fs.readFileSync(getAppIconPath(appID));
    return encrypt ? image.toString("base64") : image;
}

function genActiveApp(encrypt) {
    try {
        const xml = xmlbuilder.create("apps");
        const firstApp = device.appList[0];
        if (firstApp && currentApp?.id !== "") {
            xml.ele(
                "app",
                {
                    id: firstApp.id ?? "home",
                    type: "appl",
                    version: firstApp.version ?? "1.0.0",
                },
                firstApp.title ?? "Home"
            );
        } else {
            xml.ele("app", { id: "home", type: "appl", version: "1.0.0" }, "Home");
        }
        const strXml = xml.end({ pretty: true });
        return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
    } catch (error) {
        console.log("Error generating active app XML:", error);
        return "";
    }
}

function genAppRegistry(plugin, encrypt) {
    const xml = xmlbuilder.create("plugin-registry");
    const plugins = Array.from(device.appList.values()).map((value) => {
        return value.id;
    });
    let index = plugins.indexOf(plugin);
    if (index >= 0 || plugin.toLowerCase() === "dev") {
        const devId = path.join(app.getPath("userData"), "dev.zip").hashCode();
        const devIdx = plugins.indexOf(devId);
        if (devIdx >= 0) {
            plugins[devIdx] = "dev";
            plugins.sort();
        }
        const regXml = xml.ele("registry");
        regXml.ele("dev-id", {}, device.developerId);
        regXml.ele("plugins", {}, plugins.join());
        regXml.ele("space-available", {}, 32768);
        const secsXml = regXml.ele("sections");
        let curSection = "";
        let scXml, itsXml, itXml;
        const registry = new Map([...device.registry].sort());
        for (const [key, value] of registry) {
            const sections = key.split(".");
            if (sections.length > 2 && sections[0] === device.developerId) {
                if (sections[1] !== curSection) {
                    curSection = sections[1];
                    scXml = secsXml.ele("section");
                    scXml.ele("name", {}, curSection);
                    itsXml = scXml.ele("items");
                }
                itXml = itsXml.ele("item");
                let key = sections[2];
                if (sections.length > 3) {
                    key = sections.slice(2).join(".");
                }
                itXml.ele("key", {}, key);
                itXml.ele("value", {}, value);
            }
        }
        xml.ele("status", {}, "OK");
    } else {
        xml.ele("status", {}, "FAILED");
        xml.ele("error", {}, `Plugin ${plugin} not found`);
    }
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

// Helper Functions

function getMacAddress() {
    const os = require("node:os");
    const ifaces = os.networkInterfaces();
    let mac = "";
    for (const ifname of Object.keys(ifaces)) {
        if (
            mac !== "" ||
            ifname.toLowerCase().startsWith("vmware") ||
            ifname.toLowerCase().startsWith("virtualbox")
        ) {
            continue;
        }
        for (const iface of ifaces[ifname]) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                continue;
            }
            mac = iface.mac;
            break;
        }
    }
    if (mac === "") {
        mac = "87:3e:aa:9f:77:70";
    }
    return mac;
}

function getRokuOS(firmware, version = true) {
    if (firmware && firmware.length > 0) {
        if (version) {
            const versions = "0123456789ACDEFGHJKLMNPRSTUVWXY";
            const major = versions.indexOf(firmware.charAt(2));
            const minor = firmware.slice(4, 5);
            const revision = firmware.slice(5, 6);
            return `${major}.${minor}.${revision}`;
        } else {
            return firmware.slice(8, 12);
        }
    }
}

function getAppIconPath(appID) {
    let iconPath = path.join(__dirname, "images", "channel-icon.png");
    return device.appList.find((app) => app.id === appID)?.icon ?? iconPath;
}

function getModelName(model) {
    const modelName = device.models.get(model);
    return modelName ? modelName[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`;
}
