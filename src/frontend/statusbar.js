import { remote, shell } from "electron";

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
    remote.getCurrentWindow().openDevTools();
};
let localIp = "127.0.0.1";
let ECPPort = 8060;
statusECP.onclick = function() {
    shell.openExternal(`http://${localIp}:${ECPPort}/query/device-info`);
};
let installerPort = 80;
statusWeb.onclick = function() {
    shell.openExternal(`http://${localIp}:${installerPort}/`);
};
const appMenu = remote.Menu.getApplicationMenu();
if (appMenu.getMenuItemById("status-bar").checked) {
    statusBar.style.visibility = "visible";
} else {
    statusBar.style.visibility = "hidden";
}
console.log("StatusBar module initialized!");
// Status Bar visibility
export function toggleStatusBar() {
    const enable = statusBar.style.visibility !== "visible";
    appMenu.getMenuItemById("status-bar").checked = enable;
}
export function showStatusBar(visible) {
    if (visible) {
        display.style.bottom = "20px";
        statusBar.style.visibility = "visible";
    } else {
        display.style.bottom = "0px";
        statusBar.style.visibility = "hidden";
    }
}
// Get Status Bar state
export function isStatusBarEnabled() {
    return appMenu.getMenuItemById("status-bar").checked;
}
// Set current channel file
export function setChannelStatus(fileType, path, version) {
    statusIconFile.innerHTML = fileType ==="zip" ? "<i class='fa fa-cube'></i>" : "<i class='far fa-file'></i>";
    statusFile.innerText = path;
    if (version) {
        statusVersion.innerText = version;
        statusIconVersion.style.display = "";
    }
}
// Set resolution icon and text
export function setResStatus(resolution) {
    statusResolution.innerText = resolution;
    statusIconRes.innerHTML = "<i class='fa fa-ruler-combined'></i>";
    statusResolution.style.display = "";
    statusIconRes.style.display = "";
    statusSepRes.style.display = "";
}
// Clear Channel Stauts information
export function clearChannelStatus() {
    statusIconFile.innerText = "";
    statusFile.innerText = "";
    statusVersion.innerText = "";
    statusIconVersion.style.display = "none";
    statusResolution.style.display = "none";
    statusIconRes.style.display = "none";
    statusSepRes.style.display = "none";
}
// Set status bar colors
export function setStatusColor(errorCount, warnCount) {
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
// Update Display Mode on Status Bar
export function setDisplayStatus(displayMode) {
    let ui = displayMode == "720p" ? "HD" : displayMode == "1080p" ? "FHD" : "SD";
    statusDisplay.innerText = `${ui} (${displayMode})`;
}
// Update server icons on Sttus Bar
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
// Update Local IP Address
export function setLocalIp(ip) {
    localIp = ip;
}