/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "../css/main.css";
import "../css/fontawesome.min.css";
import "../helpers/hash";
import { setStatusColor, setAudioStatus } from "./statusbar";

// Emulator display
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
// Initialize Device Emulator and subscribe to events
let currentChannel = { id: "", running: false };
const customKeys = new Map();
customKeys.set("Comma", "rev");
customKeys.set("Period", "fwd");
customKeys.set("Space", "play");
customKeys.set("NumpadMultiply", "info");
customKeys.set("KeyA", "a");
customKeys.set("KeyZ", "b");

brsEmu.initialize(api.getDeviceInfo(), {
    debugToConsole: true,
    showStats: false,
    customKeys: customKeys,
});
brsEmu.subscribe("app", (event, data) => {
    if (event === "loaded") {
        currentChannel = data;
        appLoaded(data);
    } else if (event === "started") {
        currentChannel = data;
        stats.style.visibility = "visible";
    } else if (event === "closed" || event === "error") {
        appTerminated();
    } else if (event === "redraw") {
        redrawEvent(data);
    } else if (event === "debug") {
        if (data.level === "stop") {
            api.send("debugStarted");
        } else if (typeof data.content === "string") {
            api.send("telnet", data.content);
        }
    } else if (event === "icon") {
        api.send("saveIcon", [currentChannel.id, data]);
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
api.receive("fileSelected", function (filePath, data, clear, mute) {
    try {
        brsEmu.execute(filePath, data, clear, mute);
    } catch (error) {
        console.error(`Error opening ${filePath}:${error.message}`);
    }
});
api.receive("closeChannel", function (source) {
    if (currentChannel.running) {
        brsEmu.terminate(source);
    }
});
api.receive("console", function (text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
api.receive("debugCommand", function (cmd) {
    brsEmu.debug(cmd);
});
api.receive("setCustomKeys", function (keys) {
    brsEmu.setCustomKeys(keys);
});
api.receive("postKeyDown", function (key) {
    brsEmu.sendKeyDown(key);
});
api.receive("postKeyUp", function (key) {
    brsEmu.sendKeyUp(key);
});
api.receive("postKeyPress", function (key) {
    brsEmu.sendKeyPress(key);
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
    if (mode !== brsEmu.getDisplayMode()) {
        brsEmu.setDisplayMode(mode);
        brsEmu.redraw(api.isFullScreen());
    }
});
api.receive("setOverscan", function (mode) {
    if (mode !== brsEmu.getOverscanMode()) {
        brsEmu.setOverscanMode(mode);
        brsEmu.redraw(api.isFullScreen());
    }
});
api.receive("setAudioMute", function (mute) {
    brsEmu.setAudioMute(mute);
    setAudioStatus(mute);
});

// Window Resize Event
window.onload = window.onresize = function () {
    brsEmu.redraw(api.isFullScreen());
};
// Toggle Full Screen when Double Click
display.ondblclick = function () {
    api.toggleFullScreen();
};

// Helper functions

function appLoaded(channelData) {
    let settings = api.getPreferences();
    if (settings?.display && settings?.display?.overscanMode) {
        brsEmu.setOverscanMode(settings.display.overscanMode);
    }
    if (settings?.emulator && settings?.emulator?.options) {
        brsEmu.enableStats(settings.emulator.options.includes("perfStats"));
    }
    api.updateTitle(`${channelData.title} - ${defaultTitle}`);
    if (channelData.id === "brs") {
        api.send("addRecentSource", channelData.file);
    } else {
        api.send("addRecentPackage", channelData);
    }
    api.enableMenuItem("close-channel", true);
    api.enableMenuItem("save-screen", true);
    api.enableMenuItem("copy-screen", true);
}

function appTerminated() {
    currentChannel = { id: "", running: false };
    stats.style.visibility = "hidden";
    api.updateTitle(defaultTitle);
    api.enableMenuItem("close-channel", false);
    api.enableMenuItem("save-screen", false);
    api.enableMenuItem("copy-screen", false);
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
            windowContainer.style.top = "28px";
        }
    }
}