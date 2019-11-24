import { remote, shell } from "electron";
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
const statusSepRes = document.getElementById("statusSepRes");
const statusIconRes = document.getElementById("statusIconRes");
const statusResolution = document.getElementById("statusResolution");
const statusECP = document.getElementById("statusECP");
const statusECPText = document.getElementById("statusECPText");
const statusTelnet = document.getElementById("statusTelnet");
const statusTelnetText = document.getElementById("statusTelnetText");
const statusWeb = document.getElementById("statusWeb");
const statusWebText = document.getElementById("statusWebText");
const appMenu = remote.Menu.getApplicationMenu();
const menuStatus = appMenu.getMenuItemById("status-bar");
statusResolution.style.display = "none";
statusIconRes.style.display = "none";
statusSepRes.style.display = "none";
statusError.innerText = "0";
statusWarn.innerText = "0";
statusDevTools.onclick = function() {
    remote.getCurrentWindow().openDevTools();
};
let errorCount = 0;
let warnCount = 0;
let ECPPort = 8060;
statusECP.onclick = function() {
    shell.openExternal(`http://${getLocalIp()}:${ECPPort}/query/device-info`);
};
let installerPort = 80;
statusWeb.onclick = function() {
    shell.openExternal(`http://${getLocalIp()}:${installerPort}/`);
};
function getLocalIp() {
    let localIp = "127.0.0.1";
    if (deviceData.localIps.length > 0) {
        localIp = deviceData.localIps[0].split(",")[1];
    }
    return localIp;    
}
showStatusBar(menuStatus.checked);
// Subscribe Events
subscribeLoader("statusbar", (event, data) => {
    if (event === "loaded") {
        statusIconFile.innerHTML = data.id === "brs" ? "<i class='far fa-file'></i>" : "<i class='fa fa-cube'></i>";
        statusFile.innerText = data.file;
        if (data.version !== "") {
            statusVersion.innerText = data.version;
            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
            statusIconVersion.style.display = "";
        }
        appMenu.getMenuItemById("close-channel").enabled = true;
    } else if (event === "closed") {
        statusIconFile.innerText = "";
        statusFile.innerText = "";
        statusVersion.innerText = "";
        statusIconVersion.style.display = "none";
        statusResolution.style.display = "none";
        statusIconRes.style.display = "none";
        statusSepRes.style.display = "none";
        appMenu.getMenuItemById("close-channel").enabled = false;
    }
});
subscribeDisplay("statusbar", (event, data) => {
    if (event === "redraw") {
        let visible = !data && appMenu.getMenuItemById("status-bar").checked;
        showStatusBar(visible);
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
    menuStatus.checked = !menuStatus.checked;
    showStatusBar(menuStatus.checked);
}
function showStatusBar(visible) {
    if (visible) {
        display.style.bottom = "20px";
        statusBar.style.visibility = "visible";
    } else {
        display.style.bottom = "0px";
        statusBar.style.visibility = "hidden";
    }
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
// Clear error and warning counters
export function clearCounters() {
    errorCount = 0;
    warnCount = 0;
}
console.log("StatusBar module initialized!");
