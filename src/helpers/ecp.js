import { app } from "electron";
import { getPackages, getRecentPackage } from "../menu/menuService";
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
    restana.get("/query/apps", getApps);
    restana.get("/query/active-app", getActiveApp);
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
// REST API Functions
function getDeviceInfo(req, res) {
    console.dir(req);
    const mac = getMacAddress();
    let xml = xmlbuilder.create("device-info");
    xml.ele("udn", {}, "404d7944-8d29-45e3-8ef3-873eaa9f7769");
    xml.ele("serial-number", {}, "2N005D674148");
    xml.ele("device-id", {}, "4KK455674148");
    xml.ele("advertising-id", {}, device.RIDA);
    xml.ele("vendor-name", {}, "TCL");
    xml.ele("model-name", {}, "TCL 40FS3800");
    xml.ele("model-number", {}, "5110X");
    xml.ele("model-region", {}, "US");
    xml.ele("is-tv", {}, true);
    xml.ele("is-stick", {}, false);
    xml.ele("screen-size", {}, 40);
    xml.ele("panel-id", {}, 25);
    xml.ele("tuner-type", {}, "ATSC");
    xml.ele("wifi-mac", {}, mac);
    xml.ele("ethernet-mac", {}, mac);
    xml.ele("network-type", {}, "wifi");
    xml.ele("network-name", {}, "MMSGuest");
    xml.ele("friendly-device-name", {}, device.friendlyName);
    xml.ele("friendly-model-name", {}, "TCL•Roku TV");
    xml.ele("default-device-name", {}, `${device.friendlyName} - ${device.serialNumber}`);
    xml.ele("user-device-name", {}, device.friendlyName);
    xml.ele("build-number", {}, "089.00E04148A");
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
        xml.ele("app", {id: index > 0 ? `dev${index}` : "dev", subtype: "sdka", type: "appl", version: "1.0.0"}, value);
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

function postKeyDown(req, res) {
    window.webContents.send("postKeyDown", req.params.key);
}

function postKeyUp(req, res) {
    window.webContents.send("postKeyUp", req.params.key);
}

function postKeyPress(req, res) {
    window.webContents.send("postKeyPress", req.params.key);
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
