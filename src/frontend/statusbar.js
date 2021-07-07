import { deviceData } from "./device";
import { subscribeLoader } from "./loader";
import { subscribeDisplay } from "./display";
import { subscribeConsole } from "./console";

// Status Bar Objects
const statusBar = document.getElementById("status");
const statusDevTools = document.getElementById("statusDevTools");
const statusError = document.getElementById("statusError");
const statusWarn = document.getElementById("statusWarn");
const statusIconFile = document.getElementById("statusIconFile");
const statusFile = document.getElementById("statusFile");
const statusIconVersion = document.getElementById("statusIconVersion");
const statusVersion = document.getElementById("statusVersion");
const statusDisplay = document.getElementById("statusDisplay");
const statusLocale = document.getElementById("statusLocale");
const statusSepRes = document.getElementById("statusSepRes");
const statusIconRes = document.getElementById("statusIconRes");
const statusResolution = document.getElementById("statusResolution");
const statusECP = document.getElementById("statusECP");
const statusECPText = document.getElementById("statusECPText");
const statusTelnet = document.getElementById("statusTelnet");
const statusTelnetText = document.getElementById("statusTelnetText");
const statusWeb = document.getElementById("statusWeb");
const statusWebText = document.getElementById("statusWebText");
statusResolution.style.display = "none";
statusIconRes.style.display = "none";
statusSepRes.style.display = "none";
statusError.innerText = "0";
statusWarn.innerText = "0";
statusDevTools.onclick = function() {
    api.send("openDevTools");
};
let errorCount = 0;
let warnCount = 0;
let ECPPort = 8060;
statusECP.onclick = function() {
    api.openExternal(`http://${getLocalIp()}:${ECPPort}/query/device-info`);
};
let installerPort = 80;
statusWeb.onclick = function() {
    api.openExternal(`http://${getLocalIp()}:${installerPort}/`);
};
function getLocalIp() {
    let localIp = "127.0.0.1";
    if (deviceData.localIps.length > 0) {
        localIp = deviceData.localIps[0].split(",")[1];
    }
    return localIp;    
}
let mode = deviceData.displayMode;
let ui = mode == "720p" ? "HD" : mode == "1080p" ? "FHD" : "SD";
statusDisplay.innerText = `${ui} (${mode})`;    
const MIN_PATH_SIZE = 30;
const PATH_SIZE_FACTOR = 0.045;
let filePath = "";

// Subscribe Events
subscribeLoader("statusbar", (event, data) => {
    if (event === "loaded") {
        statusIconFile.innerHTML = data.id === "brs" ? "<i class='far fa-file'></i>" : "<i class='fa fa-cube'></i>";
        statusFile.innerText = shortenPath(data.file, 
            Math.max(MIN_PATH_SIZE, window.innerWidth * PATH_SIZE_FACTOR));
        filePath = data.file;
        if (data.version !== "") {
            statusVersion.innerText = data.version;
            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
            statusIconVersion.style.display = "";
        }
    } else if (event === "closed") {
        statusIconFile.innerText = "";
        statusFile.innerText = "";
        filePath = "";
        statusVersion.innerText = "";
        statusIconVersion.style.display = "none";
        statusResolution.style.display = "none";
        statusIconRes.style.display = "none";
        statusSepRes.style.display = "none";
    }
});
subscribeDisplay("statusbar", (event, data) => {
    if (event === "redraw") {
        if (!data && api.isMenuStatusChecked()) {
            display.style.bottom = "20px";
            statusBar.style.visibility = "visible";
            if (filePath !== "") {
                statusFile.innerText = shortenPath(filePath, 
                    Math.max(MIN_PATH_SIZE, window.innerWidth * PATH_SIZE_FACTOR));
            }
        } else {
            display.style.bottom = "0px";
            statusBar.style.visibility = "hidden";
        }
    } else if (event === "resolution") {
        statusResolution.innerText = `${data.width}x${data.height}`;
        statusIconRes.innerHTML = "<i class='fa fa-ruler-combined'></i>";
        statusResolution.style.display = "";
        statusIconRes.style.display = "";
        statusSepRes.style.display = "";    
    } else if (event === "mode") {
        let ui = data == "720p" ? "HD" : data == "1080p" ? "FHD" : "SD";
        statusDisplay.innerText = `${ui} (${data})`;    
    }
});
subscribeConsole("statusbar", (event, data) => {
    if (event === "error") {
        errorCount++;
    } else if (event === "warning") {
        warnCount++;
    }
    setStatusColor();
});
// Status Bar visibility
export function toggleStatusBar() {
    let visible = statusBar.style.visibility === "visible";
    api.checkMenuItem("status-bar", !visible);
}
// Set status bar colors
export function setStatusColor() {
    statusError.innerText = errorCount.toString();
    statusWarn.innerText = warnCount.toString();
    if (errorCount > 0) {
        statusBar.className = "statusbarError";
        statusWeb.className = "statusIconsError";
        statusECP.className = "statusIconsError";
        statusDevTools.className = "statusIconsError";
    } else if (warnCount > 0) {
        statusBar.className = "statusbarWarn";
        statusWeb.className = "statusIconsWarn";
        statusECP.className = "statusIconsWarn";
        statusDevTools.className = "statusIconsWarn";
    } else {
        statusBar.className = "statusbar";
        statusWeb.className = "statusIcons";
        statusECP.className = "statusIcons";
        statusDevTools.className = "statusIcons";
    }
}
// Update locale id on Status Bar
export function setLocaleStatus(localeId) {
    statusLocale.innerText = localeId.replace("_","-");
}
// Update server icons on Status Bar
export function setServerStatus(name, port, enabled) {
    if (name === "ECP") {
        ECPPort = port;
        if (enabled) {
            statusECPText.innerText = port.toString();
            statusECP.style.display = "";
        } else {
            statusECP.style.display = "none";
        }
    } else if (name === "Web") {
        installerPort = port;
        if (enabled) {
            statusWebText.innerText = port.toString();
            statusWeb.style.display = "";
        } else {
            statusWeb.style.display = "none";
        }    
    } else if (name ==="Telnet") {
        if (enabled) {
            statusTelnetText.innerText = port.toString();
            statusTelnet.style.display = "";
        } else {
            statusTelnet.style.display = "none";
        }    
    }
}
// Clear error and warning counters
export function clearCounters() {
    errorCount = 0;
    warnCount = 0;
}

// Function that shortens a path (based on code by https://stackoverflow.com/users/2149492/johnpan)
function shortenPath(bigPath, maxLen) {
    if (bigPath.length <= maxLen) return bigPath;
    var splitter = bigPath.indexOf('/')>-1 ? '/' : "\\",
        tokens = bigPath.split(splitter), 
        maxLen = maxLen || 25,
        drive = bigPath.indexOf(':')>-1 ? tokens[0] : "",  
        fileName = tokens[tokens.length - 1],
        len = drive.length + fileName.length,    
        remLen = maxLen - len - 3, // remove the current length and also space for ellipsis char and 2 slashes
        path, lenA, lenB, pathA, pathB;    
    //remove first and last elements from the array
    tokens.splice(0, 1);
    tokens.splice(tokens.length - 1, 1);
    //recreate our path
    path = tokens.join(splitter);
    //handle the case of an odd length
    lenA = Math.ceil(remLen / 2);
    lenB = Math.floor(remLen / 2);
    //rebuild the path from beginning and end
    pathA = path.substring(0, lenA);
    pathB = path.substring(path.length - lenB);
    path = drive + splitter + pathA + "…" + pathB + splitter ;
    path = path + fileName; 
    return path;
}