/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "../css/main.css";
import "../css/fontawesome.min.css";
import "../helpers/hash";
import { setStatusColor, setAudioStatus, showToast } from "./statusbar";

// Simulator display
const display = document.getElementById("display");
let clearDisplay = true;

// Stats overlay
const stats = document.getElementById("stats");

// App menu and theme configuration
const defaultTitle = document.title;
const colorValues = getComputedStyle(document.documentElement);
let titleColor = colorValues.getPropertyValue("--title-color").trim();
let titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
let itemBgColor = colorValues.getPropertyValue("--item-background-color").trim();
let backColor = colorValues.getPropertyValue("--background-color").trim();
api.setBackgroundColor(backColor);
api.createNewTitleBar(titleColor, titleBgColor, itemBgColor);
const customDeviceInfo = api.getDeviceInfo();
// On device reset, prevent sending back registry and models
if ("registry" in customDeviceInfo) {
    delete customDeviceInfo.registry;
}
if ("models" in customDeviceInfo) {
    delete customDeviceInfo.models;
}
// Initialize device and subscribe to events
let currentApp = { id: "", running: false };
let debugMode = "continue";
const customKeys = new Map();
customKeys.set("Comma", "rev");
customKeys.set("Period", "fwd");
customKeys.set("Space", "play");
customKeys.set("NumpadMultiply", "info");
customKeys.set("KeyA", "a");
customKeys.set("KeyZ", "b");

brs.initialize(customDeviceInfo, {
    debugToConsole: true,
    showStats: false,
    customKeys: customKeys,
});
api.send("deviceData", brs.deviceData);
api.send("serialNumber", brs.getSerialNumber());
api.send("engineVersion", brs.getVersion());

brs.subscribe("app", (event, data) => {
    if (event === "loaded") {
        currentApp = data;
        appLoaded(data);
    } else if (event === "started") {
        currentApp = data;
        stats.style.visibility = "visible";
    } else if (event === "closed" || event === "error") {
        if (event === "error") {
            showToast(`Error: ${data}`, 5000, true);
        } else if (data.endsWith("CRASH")) {
            showToast(`App crashed, open DevTools console for details!`, 5000, true);
        } else if (data === "EXIT_MISSING_PASSWORD") {
            showToast(`Missing developer password, unable to unpack the app!`, 5000, true);
        } else if (data !== "EXIT_USER_NAV") {
            showToast(`App closed with exit reason: ${data}`, 5000, true);
        } else {
            showToast(`App finished with success!`);
        }
        appTerminated();
    } else if (event === "redraw") {
        redrawEvent(data);
    } else if (event === "debug") {
        if (data.level === "stop") {
            api.send("debugStarted");
            showToast(`App stopped and Micro Debugger is active!`);
        } else if (typeof data.content === "string") {
            api.send("telnet", data.content);
        }
        if (["stop", "pause", "continue"].includes(data.level)) {
            debugMode = data.level;
        }
    } else if (event === "icon") {
        api.send("saveIcon", [currentApp.id, data]);
    } else if (event === "registry") {
        api.send("updateRegistry", data);
    } else if (event === "reset") {
        api.send("reset");
    }
});
// Events from Main process
api.receive("setTheme", function (theme) {
    if (theme !== document.documentElement.getAttribute("data-theme")) {
        document.documentElement.setAttribute("data-theme", theme);
        let bg = colorValues.getPropertyValue("--background-color").trim();
        api.setBackgroundColor(bg);
        titleColor = colorValues.getPropertyValue("--title-color").trim();
        titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
        itemBgColor = colorValues.getPropertyValue("--item-background-color").trim();
        api.updateTitlebarColor(titleColor, titleBgColor, itemBgColor);
        setStatusColor();
    }
});
api.receive("setDeviceInfo", function (key, value) {
    if (key in brs.deviceData) {
        brs.deviceData[key] = value;
        if (key === "deviceModel") {
            api.send("serialNumber", brs.getSerialNumber());
        }
    }
});
api.receive("fileSelected", function (filePath, data, clear, mute, debug, source) {
    try {
        const fileExt = filePath.split(".").pop()?.toLowerCase();
        let password = "";
        if (fileExt === "bpk") {
            const settings = api.getPreferences();
            password = settings?.device?.developerPwd ?? "";
        }
        brs.execute(filePath, data, {
            clearDisplayOnExit: clear,
            muteSound: mute,
            execSource: source,
            debugOnCrash: debug,
            password: password,
        });
    } catch (error) {
        const errorMsg = `Error opening ${filePath}:${error.message}`;
        console.error(errorMsg);
        showToast(errorMsg, 5000, true);
    }
});
api.receive("closeChannel", function (source) {
    if (currentApp.running) {
        brs.terminate(source);
    }
});
api.receive("console", function (text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
    showToast(text, 5000, error);
});
api.receive("debugCommand", function (cmd) {
    brs.debug(cmd);
});
api.receive("setCustomKeys", function (keys) {
    brs.setCustomKeys(keys);
});
api.receive("postKeyDown", function (key, remote) {
    brs.sendKeyDown(key, remote);
});
api.receive("postKeyUp", function (key, remote) {
    brs.sendKeyUp(key, remote);
});
api.receive("postKeyPress", function (key, delay, remote) {
    brs.sendKeyPress(key, delay, remote);
});
api.receive("copyScreenshot", function () {
    display.toBlob(function (blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]).catch((err) => {
            console.log(`error copying screenshot to clipboard: ${err.message}`);
        });
    });
});
api.receive("saveScreenshot", function (file) {
    const img = display.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, "");
    api.send("saveFile", [file, data]);
});
api.receive("setDisplay", function (mode) {
    if (mode !== brs.getDisplayMode()) {
        brs.setDisplayMode(mode);
        brs.redraw(api.isFullScreen());
    }
});
api.receive("setOverscan", function (mode) {
    if (mode !== brs.getOverscanMode()) {
        brs.setOverscanMode(mode);
        brs.redraw(api.isFullScreen());
    }
});
api.receive("setAudioMute", function (mute) {
    brs.setAudioMute(mute);
    setAudioStatus(mute);
});

// Window Resize Event
window.onload = window.onresize = function () {
    brs.redraw(api.isFullScreen());
};

// Window Focus Events
window.onfocus = function () {
    if (currentApp.running && debugMode === "pause") {
        brs.debug("cont");
    }
};

window.onblur = function () {
    if (currentApp.running && debugMode === "continue") {
        let settings = api.getPreferences();
        if (settings?.simulator?.options?.includes("pauseOnBlur")) {
            brs.debug("pause");
        }
    }
};

// Toggle Full Screen when Double Click
display.ondblclick = function () {
    api.toggleFullScreen();
};

// Helper functions

function appLoaded(appData) {
    let settings = api.getPreferences();
    if (settings?.display?.overscanMode) {
        brs.setOverscanMode(settings.display.overscanMode);
    }
    if (settings?.simulator?.options) {
        brs.enableStats(settings.simulator.options.includes("perfStats"));
    }
    api.updateTitle(`${appData.title} - ${defaultTitle}`);
    if (appData.id === "brs") {
        api.send("addRecentSource", appData.file);
    } else {
        api.send("addRecentPackage", appData);
    }
    api.enableMenuItem("close-channel", true);
    api.enableMenuItem("save-screen", true);
    api.enableMenuItem("copy-screen", true);
    clearDisplay = appData.clearDisplay;
}

function appTerminated() {
    if (clearDisplay) {
        window.requestAnimationFrame(delayRedraw);
    }
    currentApp = { id: "", running: false };
    stats.style.visibility = "hidden";
    api.updateTitle(defaultTitle);
    api.enableMenuItem("close-channel", false);
    api.enableMenuItem("save-screen", false);
    api.enableMenuItem("copy-screen", false);
}

function delayRedraw() {
    brs.redraw(api.isFullScreen());
}

function redrawEvent(redraw) {
    const windowTitleBar = document.querySelector("body > div.cet-titlebar.cet-mac.cet-shadow");
    const windowContainer = document.querySelector("body > div.cet-container");
    if (windowTitleBar && windowContainer) {
        if (redraw) {
            windowTitleBar.style.visibility = "hidden";
            windowContainer.style.top = "0px";
        } else if (windowTitleBar.style.visibility !== "visible") {
            windowTitleBar.style.visibility = "visible";
            windowContainer.style.top = `${windowTitleBar.clientHeight + 1}px`;
            const titleText = document.querySelector("div.cet-title");
            if (titleText) {
                titleText.style.lineHeight = windowContainer.style.top;
            }
        }
    }
}
