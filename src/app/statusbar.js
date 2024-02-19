/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Status Bar Objects
const statusBar = document.getElementById("status");
const statusDevTools = document.getElementById("statusDevTools");
const statusError = document.getElementById("statusError");
const statusWarn = document.getElementById("statusWarn");
const statusIconFile = document.getElementById("statusIconFile");
const statusFile = document.getElementById("statusFile");
const statusIconVersion = document.getElementById("statusIconVersion");
const statusAudio = document.getElementById("statusAudio");
const statusIconAudio = document.getElementById("statusIconAudio");
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
const colorValues = getComputedStyle(document.documentElement);

statusResolution.style.display = "none";
statusIconRes.style.display = "none";
statusSepRes.style.display = "none";
statusError.innerText = "0";
statusWarn.innerText = "0";
let errorCount = 0;
let warnCount = 0;
let ECPPort = 8060;
statusECP.onclick = function () {
    api.openExternal(`http://localhost:${ECPPort}/query/device-info`);
};
let installerPort = 80;
statusWeb.onclick = function () {
    api.openExternal(`http://localhost:${installerPort}/`);
};
statusDevTools.onclick = function () {
    api.send("openConsole");
};
statusAudio.onclick = function () {
    let muted = !brs.getAudioMute();
    brs.setAudioMute(muted);
    api.send("setAudioMute", muted);
    setAudioStatus(muted);
    showToast(`Audio is ${muted ? "off" : "on"}`);
};

let displayMode = api.getDeviceInfo().displayMode;
let ui = getUIType(displayMode);
statusDisplay.innerText = `${ui} (${displayMode})`;
const MIN_PATH_SIZE = 30;
const PATH_SIZE_FACTOR = 0.045;
let filePath = "";
// Locale on StatusBar
let currentLocale = api.getDeviceInfo().locale;
setLocaleStatus(currentLocale);
// Subscribe Events
brs.subscribe("statusbar", (event, data) => {
    if (event === "loaded") {
        updateStatus(data);
    } else if (event === "closed") {
        updateStatus(false);
    } else if (event === "redraw") {
        redrawStatus(data);
    } else if (event === "resolution") {
        statusResolution.innerText = `${data.width}x${data.height}`;
        statusIconRes.innerHTML = "<i class='fa fa-ruler-combined'></i>";
        statusResolution.style.display = "";
        statusIconRes.style.display = "";
        statusSepRes.style.display = "";
    } else if (event === "display") {
        statusDisplay.innerText = `${getUIType(data)} (${data})`;
    } else if (event === "debug") {
        if (data.level === "error") {
            errorCount++;
        } else if (data.level === "warning") {
            warnCount++;
        }
        setStatusColor();
    }
});
// Set status bar colors
export function setStatusColor() {
    statusError.innerText = errorCount.toString();
    statusWarn.innerText = warnCount.toString();
    if (errorCount > 0) {
        statusBar.className = "statusbarError";
        statusAudio.className = "statusIconsError";
        statusWeb.className = "statusIconsError";
        statusECP.className = "statusIconsError";
        statusDevTools.className = "statusIconsError";
    } else if (warnCount > 0) {
        statusBar.className = "statusbarWarn";
        statusAudio.className = "statusIconsWarn";
        statusWeb.className = "statusIconsWarn";
        statusECP.className = "statusIconsWarn";
        statusDevTools.className = "statusIconsWarn";
    } else {
        statusBar.className = "statusbar";
        statusAudio.className = "statusIcons";
        statusWeb.className = "statusIcons";
        statusECP.className = "statusIcons";
        statusDevTools.className = "statusIcons";
    }
}

// Update Audio icon on Status Bar
export function setAudioStatus(mute) {
    if (mute) {
        statusIconAudio.innerHTML = "<i class='fa fa-volume-off'></i>";
    } else {
        statusIconAudio.innerHTML = "<i class='fa fa-volume-up'></i>";
    }
}

// Update locale id on Status Bar
export function setLocaleStatus(localeId) {
    statusLocale.innerText = localeId.replace("_", "-");
}
// Update server icons on Status Bar
export function setServerStatus(server, enabled, port) {
    if (server === "ECP") {
        if (enabled) {
            ECPPort = port;
            statusECPText.innerText = port.toString();
            statusECP.style.display = "";
        } else {
            statusECP.style.display = "none";
        }
    } else if (server === "Web") {
        if (enabled) {
            installerPort = port;
            statusWebText.innerText = port.toString();
            statusWeb.style.display = "";
        } else {
            statusWeb.style.display = "none";
        }
    } else if (server === "Telnet") {
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
    let path = bigPath;
    if (path.length > maxLen) {
        const splitter = bigPath.indexOf("/") > -1 ? "/" : "\\"
        const tokens = bigPath.split(splitter)
        const drive = bigPath.indexOf(":") > -1 ? tokens[0] : ""
        const fileName = tokens[tokens.length - 1]
        const len = drive.length + fileName.length
        const remLen = maxLen - len - 3 // remove the current length and also space for ellipsis char and 2 slashes
        //remove first and last elements from the array
        tokens.splice(0, 1);
        tokens.splice(tokens.length - 1, 1);
        //recreate our path
        path = tokens.join(splitter);
        //rebuild the path from beginning and end
        const pathA = path.substring(0, Math.ceil(remLen / 2));
        const pathB = path.substring(path.length - Math.floor(remLen / 2));
        path = `${drive}${splitter}${pathA}…${pathB}${splitter}${fileName}`;
    }
    return path;
}

// Function to display a Toast (from the bottom) with messages to the user
export function showToast(message, duration = 3000, error = false) {
    const toastColor = error ? "--status-error-color" : "--status-background-color";
    Toastify({
        text: message,
        duration: duration,
        close: false,
        gravity: "bottom",
        position: "center",
        stopOnFocus: true,
        offset: { y: 10 },
        style: {
            background: colorValues.getPropertyValue(toastColor).trim(),
            fontSize: "14px",
        }
    }).showToast();
}

// Events from Main process
api.receive("toggleStatusBar", function () {
    if (!api.isFullScreen()) {
        brs.redraw(false);
    }
});
api.receive("serverStatus", function (server, enable, port) {
    if (enable) {
        console.info(`${server} server started listening port ${port}`);
    } else {
        console.info(`${server} server was disabled.`);
    }
    setServerStatus(server, enable, port);
});
api.receive("setLocale", function (locale) {
    if (locale !== currentLocale) {
        currentLocale = locale;
        setLocaleStatus(locale);
    }
});

// Helper Functions

function updateStatus(data) {
    if (data) {
        clearCounters();
        setStatusColor();
        statusIconFile.innerHTML =
            data.id === "brs" ? "<i class='far fa-file'></i>" : "<i class='fa fa-cube'></i>";
        statusFile.innerText = shortenPath(
            data.file,
            Math.max(MIN_PATH_SIZE, window.innerWidth * PATH_SIZE_FACTOR)
        );
        filePath = data.file;
        if (data.version !== "") {
            statusVersion.innerText = data.version;
            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
            statusIconVersion.style.display = "";
        }
        setAudioStatus(brs.getAudioMute());
        statusAudio.style.display = "";
    } else {
        statusIconFile.innerText = "";
        statusFile.innerText = "";
        filePath = "";
        statusVersion.innerText = "";
        statusIconVersion.style.display = "none";
        statusAudio.style.display = "none";
        statusResolution.style.display = "none";
        statusIconRes.style.display = "none";
        statusSepRes.style.display = "none";
    }
}

function redrawStatus(fullscreen) {
    if (!fullscreen && api.isStatusEnabled()) {
        statusBar.style.visibility = "visible";
        if (filePath !== "") {
            statusFile.innerText = shortenPath(
                filePath,
                Math.max(MIN_PATH_SIZE, window.innerWidth * PATH_SIZE_FACTOR)
            );
        }
    } else {
        statusBar.style.visibility = "hidden";
    }
}

function getUIType(resolution) {
    if (resolution === "480p") {
        return "SD";
    } else if (resolution === "1080p") {
        return "FHD";
    }
    return "HD";
}