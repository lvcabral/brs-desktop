/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { isValidIP, isLocalhostAddress, getRokuOS } from "../helpers/util";
import { ECP_PORT, SSDP_PORT } from "../constants";
import "../helpers/hash"; // installs String.prototype.hashCode, used by genAppRegistry
import { Server as SSDP } from "@lvcabral/node-ssdp";
import xmlbuilder from "xmlbuilder";
import fs from "node:fs";
import path from "node:path";

// Bundled, this module lives at app/main.js so __dirname is app/, alongside the copied
// images/ and web/ directories. Loaded directly from source -- by the tests -- __dirname
// is src/server/ and the same assets sit in src/app/. Resolve once, preferring the
// bundled layout, so both arrangements use one code path.
const ASSET_BASE =
    [__dirname, path.join(__dirname, "..", "app")].find((base) => fs.existsSync(path.join(base, "images"))) ??
    __dirname;

const WebSocket = require("ws");
const url = require("node:url");
const DEBUG = false;
const MAC = getMacAddress();
const UDN = "138aedd0-d6ad-11eb-b8bc-" + MAC.replaceAll(/:\s*/g, "");
let window;
let device;
let ecp;
let ssdp;
let currentApp;
let localOnly = false;
let ecpPort = ECP_PORT;
let rendezvousTrackingEnabled = false;
const rendezvousQueue = [];
let rendezvousDropCount = 0;
let pendingRendezvousResolve = null;
let wss;

const APP_ID_UNSAFE = /[^a-zA-Z0-9_\-.]/g;
const sanitizeAppId = (id) => (id ?? "").replaceAll(APP_ID_UNSAFE, "");

ipcMain.on("currentApp", (_, data) => {
    currentApp = data;
});

export let isECPEnabled = false;
export function initECP() {
    device = globalThis.sharedObject.deviceInfo;
}
function startSSDPServer(port) {
    ssdp = new SSDP({
        location: { port: port, path: "/" },
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
    ssdp.start().catch((e) => {
        window.webContents.send("console", `Failed to start SSDP server:${e.message}`, true);
    });
}

function stopSSDPServer() {
    if (ssdp) {
        ssdp.stop();
        ssdp = undefined;
    }
}

/**
 * Closes the ECP-2 sessions opened from other machines. The upgrade handler only filters new
 * connections, so a session established while remote access was allowed would otherwise keep
 * receiving events after the user turned it off.
 */
function destroyRemoteSessions() {
    for (const ws of wss?.clients ?? []) {
        if (!isLocalhostAddress(ws.remoteAddress)) {
            ws.terminate();
        }
    }
}

export function setECPLocalOnly(value) {
    localOnly = value;
    if (!isECPEnabled) return;
    if (localOnly) {
        stopSSDPServer();
        destroyRemoteSessions();
    } else if (!ssdp) {
        startSSDPServer(ecpPort);
    }
}
export function enableECP(win, port = ECP_PORT, { localOnly: lo = false } = {}) {
    window = win ?? BrowserWindow.fromId(1);
    if (isECPEnabled) {
        return; // already started do nothing
    }
    localOnly = lo;
    ecpPort = port;
    // Create ECP Server
    ecp = require("restana")({
        ignoreTrailingSlash: true,
    });
    ecp.getServer().on("error", (error) => {
        window.webContents.send("console", `Failed to start ECP server:${error.message}`, true);
    });
    ecp.use((req, res, next) => {
        if (localOnly && !isLocalhostAddress(req.socket.remoteAddress)) {
            res.send("Forbidden", 403);
            return;
        }
        return next();
    });
    ecp.get("/", sendDeviceRoot);
    ecp.get("/device-image.png", sendDeviceImage);
    ecp.get("/ecp_SCPD.xml", sendScpdXML);
    ecp.get("/dial_SCPD.xml", sendScpdXML);
    ecp.get("/query/device-info", sendDeviceInfo);
    ecp.get("//query/device-info", sendDeviceInfo);
    ecp.get("/query/apps", sendApps);
    ecp.get("/query/active-app", sendActiveApp);
    ecp.get("/query/media-player", sendMediaPlayer);
    ecp.get("/query/icon/:appID", sendAppIcon);
    ecp.get("/query/registry/:appID", sendRegistry);
    ecp.get("/query/graphics-frame-rate", sendGraphicsFrameRate);
    ecp.get("/query/app-state/:appID", sendAppState);
    ecp.get("/query/sgrendezvous", sendRendezvousQuery);
    ecp.post("/sgrendezvous/track", sendRendezvousTrack);
    ecp.post("/sgrendezvous/track/:channelId", sendRendezvousTrack);
    ecp.post("/sgrendezvous/untrack", sendRendezvousUntrack);
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
    ecp.start(port)
        .catch((error) => {
            window.webContents.send("console", `ECP server error:${error.message}`, true);
        })
        .then((server) => {
            isECPEnabled = true;
            notifyAll("enabled", true);
            // Skip SSDP advertisement when remote access is disabled — the device
            // should not appear to LAN scanners if it won't accept their connections.
            if (localOnly) {
                stopSSDPServer();
            } else {
                startSSDPServer(port);
            }
            // Create ECP-2 WebSocket Server
            wss = new WebSocket.Server({ noServer: true });
            wss.on("connection", function connection(ws, request) {
                // Kept on the socket so a later switch to local-only can tell which sessions
                // came from the network without reaching into the ws library internals.
                ws.remoteAddress = request.socket.remoteAddress;
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
                if (localOnly && !isLocalhostAddress(request.socket.remoteAddress)) {
                    socket.destroy();
                    return;
                }
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
        stopSSDPServer();
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
    for (const callback of observers.values()) {
        callback(eventName, eventData);
    }
}

// ECP-2 WebSocket API
export function processRequest(ws, message) {
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
        if (msg["request"] === "authenticate" && msg["param-response"]) {
            reply = `{${statusOK}}`;
        } else if (msg["request"]?.startsWith("query")) {
            reply = queryReply(msg, statusOK);
        } else if (msg["request"] === "launch") {
            notifyAll("launch", { appID: sanitizeAppId(msg["param-channel-id"]) });
            reply = `{${statusOK}}`;
        } else if (msg["request"] === "key-press") {
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

export function queryReply(msg, statusOK) {
    const request = msg["request"];
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    const xml64 = Buffer.from(xml).toString("base64");
    const template = `{"content-data":"$data","content-type":"text/xml; charset='utf-8'",${statusOK}}`;
    let reply = `{${statusOK}}`;
    if (request === "query-device-info") {
        reply = template.replace("$data", genDeviceInfoXml(true));
    } else if (request === "query-themes") {
        reply = template.replace("$data", genThemesXml(true));
    } else if (request === "query-screensavers") {
        reply = template.replace("$data", genScrsvXml(true));
    } else if (request === "query-apps") {
        reply = template.replace("$data", genAppsXml(true));
    } else if (request === "query-icon") {
        reply = template.replace("$data", genAppIcon(msg["param-channel-id"], true));
        reply = reply.replace("text/xml", "image/png");
    } else if (request === "query-tv-active-channel") {
        reply = template.replace("$data", genActiveApp(true));
    } else if (msg["request"] === "query-media-player") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] === "query-audio-device") {
        reply = template.replace("$data", xml64);
    } else if (msg["request"] === "query-textedit-state") {
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

function sendMediaPlayer(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genMediaPlayer(false));
}

function sendDeviceImage(req, res) {
    let image = fs.readFileSync(path.join(ASSET_BASE, "images", "device-image.png"));
    res.setHeader("content-type", "image/png");
    res.send(image);
}

function sendScpdXML(req, res) {
    let file = fs.readFileSync(path.join(ASSET_BASE, "web", "ecp_SCPD.xml"));
    res.setHeader("content-type", "application/xml");
    res.send(file);
}

function sendAppIcon(req, res) {
    res.setHeader("content-type", "image/png");
    res.send(genAppIcon(sanitizeAppId(req.params.appID), false));
}

function sendRegistry(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppRegistry(sanitizeAppId(req.params.appID), false));
}

function sendGraphicsFrameRate(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genGraphicsFrameRate(false));
}

function sendAppState(req, res) {
    res.setHeader("content-type", "application/xml");
    res.send(genAppState(sanitizeAppId(req.params.appID), false));
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
    notifyAll("launch", { appID: sanitizeAppId(req.params.appID), query: req.query });
    res.end();
}

function sendExitApp(req, res) {
    window?.webContents.send("closeChannel", "EXIT_USER_NAV", sanitizeAppId(req.params.appID));
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

function sendRendezvousTrack(req, res) {
    rendezvousTrackingEnabled = true;
    rendezvousQueue.length = 0;
    rendezvousDropCount = 0;
    window?.webContents.send("setRendezvousTracking", true);
    res.setHeader("content-type", "application/xml");
    res.send(genSgRendezvousStatusXml(true));
}

function sendRendezvousUntrack(req, res) {
    rendezvousTrackingEnabled = false;
    window?.webContents.send("setRendezvousTracking", false);
    res.setHeader("content-type", "application/xml");
    res.send(genSgRendezvousStatusXml(false));
}

function sendRendezvousQuery(req, res) {
    if (!rendezvousTrackingEnabled) {
        // Not tracking — return immediately with no events
        res.setHeader("content-type", "application/xml");
        res.send(genSgRendezvousQueryXml([], 0, false));
        return;
    }
    // Request queued events from the renderer/engine
    window?.webContents.send("requestRendezvousEvents");
    const timeout = setTimeout(() => {
        pendingRendezvousResolve = null;
        res.setHeader("content-type", "application/xml");
        // Fallback: return whatever is in the local queue
        const events = rendezvousQueue.splice(0);
        const dropCount = rendezvousDropCount;
        rendezvousDropCount = 0;
        res.send(genSgRendezvousQueryXml(events, dropCount, rendezvousTrackingEnabled));
    }, 2000);
    pendingRendezvousResolve = (data) => {
        clearTimeout(timeout);
        pendingRendezvousResolve = null;
        const events = data?.events ?? [];
        const dropCount = data?.dropCount ?? 0;
        res.setHeader("content-type", "application/xml");
        res.send(genSgRendezvousQueryXml(events, dropCount, rendezvousTrackingEnabled));
    };
}

ipcMain.on("rendezvousEvents", (_, data) => {
    if (pendingRendezvousResolve) {
        pendingRendezvousResolve(data);
    }
});

// Content Generation Functions
export function genDeviceRootXml() {
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

export function genDeviceInfoXml(encrypt) {
    const xml = xmlbuilder.create("device-info");
    const modelName = getModelName(device.deviceModel);
    xml.ele("udn", {}, UDN);
    if (encrypt) {
        xml.ele("virtual-device-id", {}, device.serialNumber);
    }
    xml.ele("serial-number", {}, device.serialNumber);
    xml.ele("device-id", {}, device.serialNumber);
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("user-profile-type", {}, "none");
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
    xml.ele("network-name", {}, device.connectionInfo?.ssid ?? "Local");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, modelName);
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, device.firmwareVersion);
    xml.ele("software-version", {}, getRokuOS(device.firmwareVersion));
    xml.ele("software-build", {}, getRokuOS(device.firmwareVersion, false));
    xml.ele("secure-device", {}, true);
    xml.ele("ecp-setting-mode", {}, "enabled");
    xml.ele("language", {}, device.locale.split("_")[0]);
    xml.ele("country", {}, device.countryCode);
    xml.ele("locale", {}, device.locale);
    xml.ele("closed-caption-mode", {}, device.captionMode);
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

export function genThemesXml(encrypt) {
    const xml = xmlbuilder.create("themes");
    xml.ele("theme", { id: "brand", selected: true }, "Roku (default)");
    xml.ele("theme", { id: "Graphene" }, "Graphene");
    xml.ele("theme", { id: "Brown" }, "Decaf");
    xml.ele("theme", { id: "Space" }, "Nebula");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

export function genScrsvXml(encrypt) {
    const xml = xmlbuilder.create("screensavers");
    xml.ele("screensaver", { default: true, id: "5533", selected: true }, "Roku Digital Clock");
    xml.ele("screensaver", { id: "5534" }, "Roku Analog Clock");
    const strXml = xml.end({ pretty: true });
    return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
}

export function genAppsXml(encrypt) {
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

export function genActiveApp(encrypt) {
    try {
        const xml = xmlbuilder.create("active-app");
        const firstApp = device.appList[0];
        if (firstApp && currentApp?.id === firstApp?.id) {
            const id = firstApp.id ?? "home";
            const title = firstApp.title ?? "Home";
            const version = firstApp.version ?? "1.0.0";
            xml.ele("app", { id: id, type: "appl", version: version, "ui-location": id }, title);
        } else {
            const id = currentApp?.id ?? "home";
            xml.ele("app", { id: id, type: "home", version: "1.0.0", "ui-location": id }, "Home");
        }
        const strXml = xml.end({ pretty: true });
        return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
    } catch (error) {
        console.error("Error generating active app XML:", error);
        return "";
    }
}

export function genMediaPlayer(encrypt) {
    try {
        const xml = xmlbuilder.create("player");
        xml.att("state", "close");
        xml.att("error", "false");
        const firstApp = device.appList[0];
        let id, title;
        if (firstApp && currentApp?.id === firstApp?.id) {
            id = firstApp.id ?? "home";
            title = firstApp.title ?? "Home";
        } else {
            id = currentApp?.id ?? "home";
            title = currentApp?.title ?? "Home";
        }
        xml.ele("plugin", { id: id, name: title, bandwidth: "5000000 bps" });
        const strXml = xml.end({ pretty: true });
        return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
    } catch (error) {
        console.error("Error generating media player XML:", error);
        return "";
    }
}

export function genAppRegistry(plugin, encrypt) {
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
        // Same startup window as getModelName: spreading an undefined registry would throw.
        // Sorted explicitly by key: a bare .sort() compares the "key,value" string each
        // entry coerces to, which happens to order by key but only by accident. Registry
        // keys are unique, so comparing them alone is equivalent and says what it means.
        const registry = new Map(
            [...(device.registry ?? [])].sort(([keyA], [keyB]) => {
                if (keyA === keyB) {
                    return 0;
                }
                return keyA < keyB ? -1 : 1;
            })
        );
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

export function genGraphicsFrameRate(encrypt) {
    try {
        const xml = xmlbuilder.create("graphics-frame-rate");
        xml.ele("fps", {}, "0.000000");
        xml.ele("timestamp", {}, `${Date.now()}`);
        xml.ele("status", {}, "OK");
        const strXml = xml.end({ pretty: true });
        return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
    } catch (error) {
        console.error("Error generating graphics frame rate XML:", error);
        return "";
    }
}

export function genAppState(appID, encrypt) {
    try {
        const app = device.appList.find((app) => app.id === appID);
        const xml = xmlbuilder.create("app-state");
        xml.ele("app-id", {}, appID);
        if (app) {
            xml.ele("app-title", {}, app.title);
            xml.ele("app-version", {}, app.version);
            xml.ele("app-dev-id", {}, device.developerId);
            xml.ele("state", {}, app.id === currentApp?.id ? "active" : "inactive");
            xml.ele("status", {}, "OK");
        } else {
            xml.ele("status", {}, "FAILED");
            xml.ele("error", {}, `Channel not found: ${appID}`);
        }
        const strXml = xml.end({ pretty: true });
        return encrypt ? Buffer.from(strXml).toString("base64") : strXml;
    } catch (error) {
        console.error("Error generating app state XML:", error);
        return "";
    }
}

/**
 * Generates the `<sgrendezvous>` status response for `sgrendezvous/track` and `sgrendezvous/untrack`.
 * @param {boolean} enabled - Whether tracking is now enabled
 * @returns {string} The status XML string
 */
export function genSgRendezvousStatusXml(enabled) {
    const xml = xmlbuilder.create("sgrendezvous");
    xml.ele("tracking-enabled", {}, enabled);
    xml.ele("status", {}, "OK");
    return xml.end({ pretty: true });
}

/**
 * Generates the `<sgrendezvous>` events response for `query/sgrendezvous`.
 * @param {Array} events - Rendezvous events queued since tracking started or the previous query
 * @param {number} dropCount - Number of events dropped because the queue exceeded its cap
 * @param {boolean} tracking - Whether tracking is currently enabled
 * @returns {string} The events XML string
 */
export function genSgRendezvousQueryXml(events, dropCount, tracking) {
    const xml = xmlbuilder.create("sgrendezvous");
    const data = xml.ele("data");
    data.ele("tracking-enabled", {}, tracking);
    data.ele("plugin-id", {}, currentApp?.id ?? "dev");
    data.ele("plugin-title", {}, currentApp?.title ?? "dev");
    data.ele("drop-count", {}, dropCount);
    data.ele("count", {}, events.length);
    for (const event of events) {
        const item = data.ele("item");
        item.ele("id", {}, event.id);
        item.ele("start-tm", {}, event.startTm);
        item.ele("end-tm", {}, event.endTm);
        item.ele("line-number", {}, event.line);
        item.ele("file", {}, event.file);
    }
    xml.ele("timestamp", {}, `${Date.now()}`);
    xml.ele("status", {}, "OK");
    return xml.end({ pretty: true });
}

// Helper Functions

export function getMacAddress() {
    const os = require("node:os");
    const ifaces = os.networkInterfaces();
    let mac = "";
    for (const ifname of Object.keys(ifaces)) {
        if (mac !== "" || ifname.toLowerCase().startsWith("vmware") || ifname.toLowerCase().startsWith("virtualbox")) {
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

function getAppIconPath(appID) {
    const fallbackIcon = path.join(ASSET_BASE, "images", "channel-icon.png");
    const iconPath = device.appList.find((app) => app.id === appID)?.icon.replaceAll("file://", "");
    return iconPath && fs.existsSync(iconPath) ? iconPath : fallbackIcon;
}

export function getModelName(model) {
    // `models` is populated by the renderer's deviceData message, so it is absent for the
    // first moments after startup. The generic fallback below already covers an unknown
    // model; without the optional chaining it is unreachable and the caller 500s instead.
    const modelName = device.models?.get(model);
    return modelName ? modelName[0].replaceAll(/ *\([^)]*\) */g, "") : `Roku (${model})`;
}
