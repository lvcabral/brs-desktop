/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./styles/main.css";
import "./styles/fontawesome.min.css";
import "../helpers/hash";
import { setStatusColor, setAudioStatus, showToast, clearCounters } from "./statusbar";

const isMacOS = api.processPlatform() === "darwin";

// Simulator display
const display = document.getElementById("display");

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
// On device reset, prevent sending back items not customizable
if ("registry" in customDeviceInfo) {
    delete customDeviceInfo.registry;
}
if ("registryBuffer" in customDeviceInfo) {
    delete customDeviceInfo.registryBuffer;
}
if ("models" in customDeviceInfo) {
    delete customDeviceInfo.models;
}
if ("assets" in customDeviceInfo) {
    delete customDeviceInfo.assets;
}
if ("captionStyle" in customDeviceInfo) {
    delete customDeviceInfo.captionStyle;
}
// Initialize device and subscribe to events
let currentApp = { id: "", running: false };
let debugMode = "continue";
let editor = null;
const customKeys = new Map();
customKeys.set("Comma", "rev");
customKeys.set("Period", "fwd");
customKeys.set("Space", "play");
customKeys.set("NumpadMultiply", "info");
customKeys.set("KeyA", "a");
customKeys.set("KeyZ", "b");
// Support for Games with multi_key_events=1 in the manifest
customKeys.set("ShiftLeft", "playonly");
customKeys.set("Shift+ArrowRight", "right");
customKeys.set("Shift+ArrowLeft", "left");
customKeys.set("Shift+ArrowUp", "up");
customKeys.set("Shift+ArrowDown", "down");

brs.initialize(customDeviceInfo, {
    debugToConsole: false,
    showStats: false,
    customKeys: customKeys,
});

// Send deviceData via IPC
const clonedDeviceData = Object.assign({}, brs.deviceData);
delete clonedDeviceData.assets; // Remove assets to avoid issues with structured cloning
delete clonedDeviceData.registryBuffer; // Remove registryBuffer to avoid issues with structured cloning

try {
    api.send("deviceData", clonedDeviceData);
} catch (error) {
    console.warn(
        "Sending deviceData object via IPC failed, using JSON serialization workaround:",
        error.message
    );
    // Use JSON serialization as a fallback in case of structured cloning issues
    const jsonSerializedData = JSON.parse(JSON.stringify(clonedDeviceData));
    api.send("deviceData", jsonSerializedData);
}

api.send("serialNumber", brs.getSerialNumber());
api.send("engineVersion", brs.getVersion());

let selectedApp = "";

brs.subscribe("desktop", (event, data) => {
    if (event === "loaded") {
        selectedApp = "";
        currentApp = data;
        appLoaded(data);
    } else if (event === "started") {
        currentApp = data;
        stats.style.visibility = "visible";
    } else if (event === "launch") {
        console.info(`App launched: ${data}`);
        if (data?.app) {
            selectedApp = data.app;
        }
    } else if (event === "browser") {
        if (data?.url) {
            const newWindow = window.open(
                data.url,
                "_blank",
                `width=${data.width},height=${data.height},popup`
            );
            if (newWindow) {
                newWindow.focus();
            } else {
                showToast("Warning: It was not possible to open a new window!", true);
            }
        }
    } else if (event === "closed" || event === "error") {
        appTerminated();
        if (selectedApp !== "" && event === "closed") {
            api.send("runUrl", selectedApp);
        } else {
            showCloseMessage(event, data);
        }
        selectedApp = "";
    } else if (event === "redraw") {
        redrawEvent(data);
    } else if (event === "control") {
        api.send("keySent", data);
    } else if (event === "captionMode") {
        api.send("setCaptionMode", data);
        showToast(`Caption mode changed to: ${data}`);
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
        api.send("saveIcon", [currentApp.path.hashCode(), data]);
    } else if (event === "registry") {
        api.send("updateRegistry", data);
    } else if (event === "reset") {
        api.send("reset");
    }
});
// Events from Main process
api.receive("openEditor", function () {
    if (editor === null || editor.closed) {
        editor = window.open("editor.html", "BrightScript Editor", "width=1440,height=800");
    } else {
        api.send("showEditor");
    }
});

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
api.receive("executeFile", function (filePath, data, clear, mute, debug, input) {
    try {
        const fileExt = filePath.split(".").pop()?.toLowerCase();
        let password = "";
        if (fileExt === "bpk") {
            const settings = api.getPreferences();
            password = settings?.device?.developerPwd ?? "";
        }
        if (fileExt !== "brs") {
            data = data.buffer;
        }
        brs.execute(
            filePath,
            data,
            {
                clearDisplayOnExit: clear,
                muteSound: mute,
                debugOnCrash: debug,
                password: password,
            },
            input
        );
    } catch (error) {
        const errorMsg = `Error opening ${filePath}:${error.message}`;
        console.error(errorMsg);
        showToast(errorMsg, 5000, true);
    }
});
api.receive("closeChannel", function (source, appID) {
    if (currentApp.running) {
        if (appID && appID !== currentApp.id) {
            return;
        }
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
api.receive("postInputParams", function (params) {
    brs.sendInput(params);
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

// Splash video handling
function initSplashVideo() {
    const player = document.getElementById("player");
    if (!player) {
        return;
    }
    // Store original player state
    const originalControls = player.controls;
    const originalAutoplay = player.autoplay;
    const originalMuted = player.muted;

    // Configure player for splash video
    player.src = "./videos/brs-bouncing.mp4";
    player.controls = false;
    player.autoplay = true;
    player.muted = true;

    // Function to restore player state
    const restorePlayer = () => {
        // Clear the canvas to remove the video content
        const canvas = document.getElementById("display");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Restore original state
        player.pause();
        player.removeAttribute("src"); // empty source
        player.load(); // reset everything, silent without errors!
        player.style.display = "none";
        player.controls = originalControls;
        player.autoplay = originalAutoplay;
        player.muted = originalMuted;
    };

    // Hide video when it ends or and error occurs
    player.addEventListener("ended", restorePlayer, { once: true });
    player.addEventListener("error", restorePlayer, { once: true });

    // Start playing the video
    player.play();
}

// Initialize splash video when DOM is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSplashVideo);
} else {
    initSplashVideo();
}

// Window Resize Event
window.onload = window.onresize = function () {
    brs.redraw(api.isFullScreen());
};

// Window Focus Events
window.addEventListener(
    "focus",
    function () {
        if (currentApp.running && debugMode === "pause") {
            brs.debug("cont");
        }
        if (isMacOS) {
            api.enableMenuItem("close-channel", currentApp.running);
            api.enableMenuItem("save-screen", currentApp.running);
            api.enableMenuItem("copy-screen", currentApp.running);
        }
    },
    false
);

window.addEventListener(
    "blur",
    function () {
        if (currentApp.running && debugMode === "continue") {
            let settings = api.getPreferences();
            if (settings?.simulator?.options?.includes("pauseOnBlur")) {
                brs.debug("pause");
            }
        }
        if (isMacOS) {
            api.enableMenuItem("close-channel", false);
            api.enableMenuItem("save-screen", false);
            api.enableMenuItem("copy-screen", false);
        }
    },
    false
);

// Toggle Full Screen when Double Click
display.ondblclick = function () {
    api.toggleFullScreen();
};

// Helper functions
function showCloseMessage(event, data) {
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
}

function appLoaded(appData) {
    let settings = api.getPreferences();
    if (settings?.display?.overscanMode) {
        brs.setOverscanMode(settings.display.overscanMode);
    }
    if (settings?.simulator?.options) {
        brs.enableStats(settings.simulator.options.includes("perfStats"));
    }
    api.updateTitle(`${appData.title} - ${defaultTitle}`);
    if (appData.path.toLowerCase().endsWith(".brs")) {
        api.send("addRecentSource", appData.path);
    } else {
        api.send("addRecentPackage", appData);
    }
    api.enableMenuItem("close-channel", true);
    api.enableMenuItem("save-screen", true);
    api.enableMenuItem("copy-screen", true);
    api.send("currentApp", appData);
}

function appTerminated() {
    currentApp = { id: "", running: false };
    stats.style.visibility = "hidden";
    api.updateTitle(defaultTitle);
    api.enableMenuItem("close-channel", false);
    api.enableMenuItem("save-screen", false);
    api.enableMenuItem("copy-screen", false);
    api.send("currentApp", currentApp);
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

// Exposed API to Child Windows
window.getEngineContext = () => {
    return [brs, currentApp, api.getConsoleBuffer(), debugMode];
};

window.clearStatusCounters = () => {
    clearCounters();
    setStatusColor();
};
