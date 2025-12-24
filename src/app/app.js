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
import {
    setStatusColor,
    setAudioStatus,
    showToast,
    clearCounters,
    updateStatus,
    setLocaleStatus,
} from "./statusbar";
import { BRS_HOME_APP_PATH } from "../constants";

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
// Read settings for home screen mode
const initialSettings = api.getPreferences();
let brsHomeMode = !initialSettings?.simulator?.options?.includes("disableHomeScreen");

// Initialize variables
const defaultAppInfo = { id: "", path: "", icon: "", running: false };
let appList = structuredClone(customDeviceInfo.appList ?? []);
let currentApp = structuredClone(defaultAppInfo);
let launchAppId = "";
let debugMode = "continue";
let editor = null;
let externalVolumeMountedLabel = "";
let externalVolumeReadySent = false;

// Initialize BrightScript Engine when window loads
globalThis.addEventListener("load", main, false);

// Main function to initialize the BrightScript engine
async function main() {
    // Custom key mappings
    const customKeys = new Map();
    customKeys.set("NumpadMultiply", "info");
    // Support for Games with multi_key_events=1 in the manifest
    customKeys.set("ShiftLeft", "playonly");
    customKeys.set("Shift+ArrowRight", "right");
    customKeys.set("Shift+ArrowLeft", "left");
    customKeys.set("Shift+ArrowUp", "up");
    customKeys.set("Shift+ArrowDown", "down");
    // Add SceneGraph extension
    customDeviceInfo.extensions = new Map([[brs.SupportedExtension.SceneGraph, "./brs-sg.js"]]);
    // Initialize BRS Engine
    brs.subscribe("desktop", (event, data) => {
        if (event === "loaded") {
            if (!brsHomeMode) {
                launchAppId = "";
            }
            brs.deviceData.appList = structuredClone(appList);
            currentApp = data;
            appLoaded(data);
        } else if (event === "started") {
            currentApp = data;
            stats.style.visibility = "visible";
        } else if (event === "launch") {
            if (typeof data?.app === "string") {
                if (data.app === "turn-off") {
                    api.send("closeSimulator");
                    return;
                } else if (data.app === "add-apps") {
                    api.send("openAppPackage");
                    return;
                }
                launchAppId = data.app;
            }
        } else if (event === "browser") {
            if (data?.url) {
                const newWindow = globalThis.open(
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
            handleAppClosing(event, data);
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
            api.send("saveIcon", { iconId: currentApp.path.hashCode(), iconData: data });
        } else if (event === "registry") {
            api.send("updateRegistry", data);
        } else if (event === "reset") {
            api.send("reset");
        } else if (event === "version") {
            // brs-engine requests the version from the worker as the last step on initialize
            startupProcess();
            if (!externalVolumeReadySent) {
                externalVolumeReadySent = true;
                api.send("externalVolumeReady");
            }
        }
    });

    brs.initialize(customDeviceInfo, {
        debugToConsole: false,
        showStats: false,
        customKeys: customKeys,
    });

    // Send deviceData via IPC
    const clonedDeviceData = { ...brs.deviceData };
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
    brs.redraw(api.isFullScreen());
}

// Events from Main process
api.receive("openEditor", function () {
    if (editor === null || editor.closed) {
        editor = globalThis.open("editor.html", "BrightScript Editor", "width=1440,height=800");
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
        } else if (key === "appList") {
            appList = structuredClone(value);
            if (currentApp.running && currentApp.path === BRS_HOME_APP_PATH) {
                api.send("runFile", BRS_HOME_APP_PATH);
            }
        } else if (key === "locale") {
            setLocaleStatus(value);
        }
    }
});
api.receive("setCaptionStyle", function (newStyles) {
    brs.setCaptionStyle(newStyles);
});
api.receive("executeFile", function (filePath, data, clear, mute, debug, input) {
    // Close the SceneGraph warning dialog if it's still open
    const dialog = document.getElementById("scenegraph-warning-dialog");
    if (dialog?.style?.display === "flex") {
        dialog.style.display = "none";
    }

    try {
        const fileExt = filePath.split(".").pop()?.toLowerCase().split("?")[0];
        let password = "";
        let debugState = !filePath.includes(BRS_HOME_APP_PATH);
        if (fileExt === "bpk") {
            const settings = api.getPreferences();
            password = settings?.device?.developerPwd ?? "";
            debugState = false;
        }
        if (fileExt !== "brs") {
            data = data.buffer;
        }
        brs.setDebugState(debugState);
        if (brsHomeMode) {
            launchAppId = BRS_HOME_APP_PATH;
        }
        brs.execute(
            filePath.split("?")[0],
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
        if (!brsHomeMode) {
            launchAppId = "";
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
    takeScreenshot();
});
api.receive("saveScreenshot", function (file) {
    takeScreenshot(file);
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
api.receive("setPerfStats", function (enabled) {
    brs.enableStats(enabled);
});
api.receive("mountExternalVolume", function (zipData, label = "External volume") {
    try {
        const zipBuffer = getExternalVolumeArrayBuffer(zipData);
        if (!zipBuffer) {
            showToast("Error mounting external volume: Invalid data provided.", 5000, true);
            return;
        }
        brs.mountExt(zipBuffer);
        externalVolumeMountedLabel = label;
        showToast(`${externalVolumeMountedLabel} mounted as ext1:/`, 4000);
    } catch (error) {
        showToast(`Error mounting external volume: ${error.message}`, 5000, true);
    }
});
api.receive("unmountExternalVolume", function () {
    try {
        brs.umountExt();
        if (externalVolumeMountedLabel) {
            showToast(`${externalVolumeMountedLabel} unmounted from ext1:/`, 3000);
        }
    } catch (error) {
        showToast(`Error unmounting external volume: ${error.message}`, 5000, true);
    } finally {
        externalVolumeMountedLabel = "";
    }
});
api.receive("setHomeScreenMode", function (enabled) {
    brsHomeMode = enabled;
    if (brsHomeMode) {
        launchAppId = BRS_HOME_APP_PATH;
        if (!currentApp.running) {
            api.send("runFile", BRS_HOME_APP_PATH);
        }
    } else {
        launchAppId = "";
        if (currentApp.running && currentApp.path.includes(BRS_HOME_APP_PATH)) {
            brs.terminate("EXIT_USER_NAV");
        }
    }
});

// Window Resize Event
globalThis.onresize = function () {
    brs.redraw(api.isFullScreen());
};

// Window Focus Events
globalThis.addEventListener(
    "focus",
    function () {
        if (currentApp.running && debugMode === "pause") {
            brs.debug("cont");
        }
        if (isMacOS) {
            const isHomeApp = currentApp.path.includes(BRS_HOME_APP_PATH);
            api.enableMenuItem("close-channel", currentApp.running && !isHomeApp);
            api.enableMenuItem("save-screen", currentApp.running);
            api.enableMenuItem("copy-screen", currentApp.running);
        }
    },
    false
);

globalThis.addEventListener(
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
let clickTimeout = null;
display.ondblclick = function () {
    // Clear the click timeout to prevent the toast from showing
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    api.toggleFullScreen();
};
// Warn user to use keyboard
display.onclick = function () {
    const settings = api.getPreferences();
    const displayToast = !settings?.simulator?.options?.includes("disableClickToast");
    if (currentApp.running && displayToast) {
        // Delay the toast to allow double-click to cancel it
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
        clickTimeout = setTimeout(() => {
            showToast(
                "Use the keyboard or a gamepad to interact with the app. Double click toggles full screen.",
                5000
            );
            clickTimeout = null;
        }, 250); // 250ms delay to detect double-click
    }
};

// Helper functions

function getExternalVolumeArrayBuffer(payload) {
    if (!payload) {
        return null;
    }
    if (payload instanceof ArrayBuffer) {
        return payload;
    }
    if (ArrayBuffer.isView(payload)) {
        const { buffer, byteOffset, byteLength } = payload;
        return buffer.slice(byteOffset, byteOffset + byteLength);
    }
    if (payload?.type === "Buffer" && Array.isArray(payload.data)) {
        return Uint8Array.from(payload.data).buffer;
    }
    return null;
}

function handleAppClosing(event, reason) {
    appTerminated();
    if (launchAppId !== "" && event === "closed") {
        let path = "";
        if (launchAppId === BRS_HOME_APP_PATH) {
            path = BRS_HOME_APP_PATH;
        } else {
            const app = appList.find((a) => a.id === launchAppId);
            if (app) {
                path = app.path;
            }
        }
        if (reason.endsWith("CRASH")) {
            showCloseMessage(event, reason, false);
        }
        if (path.startsWith("http") || path.startsWith("file:")) {
            api.send("runUrl", path);
        } else if (path) {
            api.send("runFile", path);
        } else {
            showToast(`Error: Could not find app with id ${launchAppId} to launch!`, 5000, true);
        }
    } else if (brsHomeMode) {
        showCloseMessage(event, reason, false);
        api.send("runFile", BRS_HOME_APP_PATH);
    } else {
        showCloseMessage(event, reason);
        brs.setDebugState(true);
    }
    launchAppId = brsHomeMode ? BRS_HOME_APP_PATH : "";
}

function takeScreenshot(file = "") {
    const screenshot = brs.getScreenshot();
    if (screenshot === null) {
        showToast("Error: Could not get a screenshot!", 3000, true);
        return;
    }
    const canvas = new OffscreenCanvas(screenshot.width, screenshot.height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(screenshot, 0, 0);
    canvas.convertToBlob().then(function (blob) {
        // Copy to clipboard
        if (file === "") {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]).catch((err) => {
                showToast(`Error copying screenshot to clipboard: ${err.message}`, 5000, true);
            });
            return;
        }
        // Save to file
        blob.arrayBuffer()
            .then((buffer) => {
                api.send("saveFile", [file, buffer]);
            })
            .catch((err) => {
                showToast(`Error saving screenshot: ${err.message}`, 5000, true);
            });
    });
}

function showCloseMessage(event, reason, success = true) {
    if (event === "error") {
        showToast(`Error: ${reason}`, 5000, true);
    } else if (reason.endsWith("CRASH")) {
        showToast(`App crashed, check the console for details!`, 5000, true);
    } else if (reason === "EXIT_MISSING_PASSWORD") {
        showToast(`Missing developer password, unable to unpack the app!`, 5000, true);
    } else if (reason !== "EXIT_USER_NAV") {
        showToast(`App closed with exit reason: ${reason}`, 5000, true);
    } else if (success) {
        showToast(`App closed with success!`);
    }
}

function appLoaded(appData) {
    let settings = api.getPreferences();
    if (settings?.display?.overscanMode) {
        brs.setOverscanMode(settings.display.overscanMode);
    }
    if (settings?.display?.options) {
        brs.enableStats(settings.display.options.includes("perfStats"));
    }
    if (appData.title === defaultTitle) {
        api.updateTitle(defaultTitle);
    } else {
        api.updateTitle(`${appData.title} - ${defaultTitle}`);
    }
    const isHomeApp = appData.path.includes(BRS_HOME_APP_PATH);
    if (!isHomeApp) {
        if (!appData.path.toLowerCase().endsWith(".brs")) {
            api.send("addRecentPackage", appData);
        }
    }
    api.enableMenuItem("close-channel", !isHomeApp);
    api.enableMenuItem("save-screen", true);
    api.enableMenuItem("copy-screen", true);
    api.send("currentApp", appData);
    updateStatus(appData, isHomeApp);
}

function appTerminated() {
    currentApp = structuredClone(defaultAppInfo);
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

// Simulator Startup Process
function startupProcess() {
    const settings = api.getPreferences();
    const splashVideoEnabled = !settings?.simulator?.options?.includes("disableSplashVideo");
    const runLastApp = settings?.simulator?.options?.includes("runLastChannel") ?? false;

    // Get dialog elements
    const dontShowWarning = localStorage.getItem("sceneGraphWarningDismissed") === "true";
    const dialog = document.getElementById("scenegraph-warning-dialog");
    const closeButton = document.getElementById("close-scenegraph-warning");
    const dontShowAgainCheckbox = document.getElementById("dont-show-warning-again");

    if (dontShowWarning || !dialog || !closeButton || !dontShowAgainCheckbox) {
        if (runLastApp) {
            setTimeout(() => startLastApp(), 300);
        } else if (splashVideoEnabled) {
            setTimeout(() => startSplashVideo(), 300);
        } else if (brsHomeMode) {
            setTimeout(() => startHomeApp(), 300);
        }
        return;
    }
    // Show the dialog after a short delay to ensure UI is ready
    setTimeout(() => {
        dialog.style.display = "flex";
    }, 500);
    // Function to handle dialog dismissal
    const handleDialogClose = () => {
        if (dontShowAgainCheckbox.checked) {
            localStorage.setItem("sceneGraphWarningDismissed", "true");
        }
        dialog.style.display = "none";
        if (runLastApp) {
            setTimeout(() => startLastApp(), 300);
        } else if (splashVideoEnabled) {
            setTimeout(() => startSplashVideo(), 300);
        } else if (brsHomeMode) {
            setTimeout(() => startHomeApp(), 300);
        }
    };
    closeButton.addEventListener("click", handleDialogClose);
    document.addEventListener("keydown", (event) => {
        if (["Escape", "Enter"].includes(event.key) && dialog.style.display === "flex") {
            handleDialogClose();
        }
    });
    // Prevent dialog from closing when clicking inside the modal content
    const modalDialog = dialog.querySelector(".modal-dialog");
    if (modalDialog) {
        modalDialog.addEventListener("click", (event) => {
            event.stopPropagation();
        });
    }
    // Close dialog when clicking on overlay
    dialog.addEventListener("click", handleDialogClose);
}

function startSplashVideo() {
    const player = document.getElementById("player");
    if (!player) {
        return;
    }
    // Store original player state
    const originalControls = player.controls;
    const originalAutoplay = player.autoplay;
    const originalMuted = player.muted;
    // Define assets
    const splashVideo = "assets/brs-bouncing.mp4";
    // Configure and start splash video
    player.src = splashVideo;
    player.controls = false;
    player.autoplay = false;
    player.muted = true;

    // Function to restore player state
    const restorePlayer = () => {
        // Clear the canvas to remove the video content
        if (display) {
            const ctx = display.getContext("2d");
            ctx.clearRect(0, 0, display.width, display.height);
        }
        // Only run home app if home screen mode is enabled
        if (player.src.endsWith(splashVideo) && brsHomeMode) {
            startHomeApp();
        }
        // Restore original state
        player.pause();
        player.removeAttribute("src");
        player.load();
        player.style.display = "none";
        player.controls = originalControls;
        player.autoplay = originalAutoplay;
        player.muted = originalMuted;
    };

    // Add event listeners
    player.addEventListener("ended", restorePlayer, { once: true });
    player.addEventListener("error", restorePlayer, { once: true });

    // Start playing
    player.play().catch((error) => {
        console.warn("Could not play splash video:", error);
    });
}

function startHomeApp() {
    if (brsHomeMode && !currentApp.running) {
        api.send("runFile", BRS_HOME_APP_PATH);
    }
}

function startLastApp() {
    if (appList.length > 0) {
        const lastApp = appList[0];
        if (lastApp.path.startsWith("http") || lastApp.path.startsWith("file:")) {
            api.send("runUrl", lastApp.path);
        } else if (lastApp.path) {
            api.send("runFile", lastApp.path);
        }
    }
}

// Exposed API to Child Windows
globalThis.getEngineContext = () => {
    return [brs, currentApp, api.getConsoleBuffer(), debugMode];
};

globalThis.clearStatusCounters = () => {
    clearCounters();
    setStatusColor();
};
