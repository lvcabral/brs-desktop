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
// Initialize device and subscribe to events
let appList = structuredClone(customDeviceInfo.appList ?? []);
let currentApp = { id: "", running: false };
let debugMode = "continue";
let editor = null;
// Read settings for home screen mode
const initialSettings = api.getPreferences();
let brsHomeMode = !initialSettings?.simulator?.options?.includes("disableHomeScreen");
const clientId = brs.deviceData.clientId.replaceAll("-", "");
const customKeys = new Map();
customKeys.set("NumpadMultiply", "info");
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

let launchAppId = "";

brs.subscribe("desktop", (event, data) => {
    if (event === "loaded") {
        if (!brsHomeMode) {
            launchAppId = "";
        }
        currentApp = data;
        appLoaded(data);
    } else if (event === "started") {
        currentApp = data;
        stats.style.visibility = "visible";
        brs.deviceData.appList = structuredClone(appList);
    } else if (event === "launch") {
        if (typeof data?.app === "string") {
            if (data.app === "tv-off") {
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
        appTerminated();
        if (brsHomeMode && launchAppId === BRS_HOME_APP_PATH) {
            showCloseMessage(event, data, false);
            api.send("runFile", BRS_HOME_APP_PATH);
        } else if (launchAppId !== "" && event === "closed") {
            const app = appList.find((a) => a.id === launchAppId);
            if (app?.path?.startsWith("http") || app?.path?.startsWith("file:")) {
                api.send("runUrl", app.path);
            } else if (app?.path) {
                api.send("runFile", app.path);
            }
        } else {
            showCloseMessage(event, data);
            brs.setDebugState(true);
        }
        launchAppId = brsHomeMode ? BRS_HOME_APP_PATH : "";
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
    }
});

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
        }
    }
});
api.receive("setCaptionStyle", function (newStyles) {
    brs.setCaptionStyle(newStyles);
});
api.receive("executeFile", function (filePath, data, clear, mute, debug, input) {
    // Close the SceneGraph warning dialog if it's still open
    const dialog = document.getElementById("scenegraph-warning-dialog");
    if (dialog && dialog.style.display === "flex") {
        dialog.style.display = "none";
    }

    try {
        const fileExt = filePath.split(".").pop()?.toLowerCase().split("?")[0];
        let password = "";
        let debugState = true;
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
            password = filePath.includes(BRS_HOME_APP_PATH) ? clientId : password;
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
        launchAppId = "";
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
api.receive("setPerfStats", function (enabled) {
    brs.enableStats(enabled);
});
api.receive("setHomeScreenMode", function (enabled) {
    brsHomeMode = enabled;
});

// Splash video handling
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
        const canvas = document.getElementById("display");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Only run home app if home screen mode is enabled
        if (player.src.endsWith(splashVideo) && brsHomeMode) {
            api.send("runFile", BRS_HOME_APP_PATH);
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

// Initialize the app when DOM is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSceneGraphWarningDialog);
} else {
    initSceneGraphWarningDialog();
}

// Window Resize Event
globalThis.onload = globalThis.onresize = function () {
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
            api.enableMenuItem("close-channel", currentApp.running);
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
    console.log("Display clicked", settings?.simulator?.options);
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
function showCloseMessage(event, data, success = true) {
    if (event === "error") {
        showToast(`Error: ${data}`, 5000, true);
    } else if (data.endsWith("CRASH")) {
        showToast(`App crashed, open console for details!`, 5000, true);
    } else if (data === "EXIT_MISSING_PASSWORD") {
        showToast(`Missing developer password, unable to unpack the app!`, 5000, true);
    } else if (data !== "EXIT_USER_NAV") {
        showToast(`App closed with exit reason: ${data}`, 5000, true);
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
        if (appData.path.toLowerCase().endsWith(".brs")) {
            api.send("addRecentSource", appData.path);
        } else {
            api.send("addRecentPackage", appData);
        }
    }
    api.enableMenuItem("close-channel", true);
    api.enableMenuItem("save-screen", true);
    api.enableMenuItem("copy-screen", true);
    api.send("currentApp", appData);
    updateStatus(appData, isHomeApp);
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

// SceneGraph Warning Dialog
function initSceneGraphWarningDialog() {
    const dontShowWarning = localStorage.getItem("sceneGraphWarningDismissed") === "true";
    const settings = api.getPreferences();
    const splashVideoEnabled = !settings?.simulator?.options?.includes("disableSplashVideo");

    if (dontShowWarning) {
        if (splashVideoEnabled) {
            setTimeout(() => startSplashVideo(), 500);
        } else if (brsHomeMode) {
            // If splash is disabled but home screen is enabled, run home app directly
            setTimeout(() => api.send("runFile", BRS_HOME_APP_PATH), 500);
        }
        return;
    }
    // Get dialog elements
    const dialog = document.getElementById("scenegraph-warning-dialog");
    const closeButton = document.getElementById("close-scenegraph-warning");
    const dontShowAgainCheckbox = document.getElementById("dont-show-warning-again");
    if (!dialog || !closeButton || !dontShowAgainCheckbox) {
        if (splashVideoEnabled) {
            setTimeout(() => startSplashVideo(), 500);
        } else if (brsHomeMode) {
            setTimeout(() => api.send("runFile", BRS_HOME_APP_PATH), 500);
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
        if (splashVideoEnabled) {
            setTimeout(() => startSplashVideo(), 300);
        } else if (brsHomeMode) {
            setTimeout(() => api.send("runFile", BRS_HOME_APP_PATH), 300);
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

// Exposed API to Child Windows
globalThis.getEngineContext = () => {
    return [brs, currentApp, api.getConsoleBuffer(), debugMode];
};

globalThis.clearStatusCounters = () => {
    clearCounters();
    setStatusColor();
};
