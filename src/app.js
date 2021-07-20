/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./css/main.css";
import "./css/fontawesome.min.css";
import "./helpers/hash";
import { subscribeDevice, deviceData, currentChannel, loadFile } from "./app/device";
import { setDisplayMode, setOverscanMode, overscanMode, redrawDisplay } from "./app/display";
import { setLocaleStatus, setStatusColor } from "./app/statusbar";
import { clientException } from "./app/console";
import { handleKey } from "./app/control"

// Emulator display
const display = document.getElementById("display");
// App menu and theme configuration
const defaultTitle = document.title;
const colorValues = getComputedStyle(document.documentElement);
let titleColor = colorValues.getPropertyValue("--title-color").trim();
let titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
let itemBgColor = colorValues.getPropertyValue("--item-background-color").trim();
api.setBackgroundColor(colorValues.getPropertyValue("--background-color").trim());
api.createNewTitleBar(titleColor, titleBgColor, itemBgColor);
// Subscribe Loader Events
subscribeDevice("app", (event, data) => {
    if (event === "loaded") {
        let prefs = api.getPreferences();
        if (prefs && prefs.display && prefs.display.overscanMode) {
            setOverscanMode(prefs.display.overscanMode);
        }
        api.updateTitle(`${data.title} - ${defaultTitle}`);
        if (data.id === "brs") {
            api.send("addRecentSource", data.file);
        } else {
            api.send("addRecentPackage", data);
        }
        api.enableMenuItem("close-channel", true);
        api.enableMenuItem("save-screen", true);
        api.enableMenuItem("copy-screen", true);
    } else if (event === "closed") {
        api.updateTitle(defaultTitle);
        api.enableMenuItem("close-channel", false);
        api.enableMenuItem("save-screen", false);
        api.enableMenuItem("copy-screen", false);
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
api.receive("fileSelected", function (filePath, data) {
    try {
        loadFile(filePath, data);
    } catch (error) {
        clientException(`Error opening ${filePath}:${error.message}`);
    }
});
api.receive("closeChannel", function (source) {
    if (currentChannel.running) {
        closeChannel(source);
    }
});
api.receive("postKeyDown", function (key) {
    handleKey(key, 0);
});
api.receive("postKeyUp", function (key) {
    handleKey(key, 100);
});
api.receive("postKeyPress", function (key) {
    setTimeout(function () {
        handleKey(key, 100);
    }, 300);
    handleKey(key, 0);
});
api.receive("copyScreenshot", function () {
    display.toBlob(function (blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]);
    });
});
api.receive("saveScreenshot", function (file) {
    const img = display.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, "");
    api.send("saveFile", [file, data])
});
api.receive("setDisplay", function (mode) {
    if (mode !== deviceData.displayMode) {
        setDisplayMode(mode);
        redrawDisplay(deviceData.channelRunning, api.isFullScreen());
    }
});
api.receive("setOverscan", function (mode) {
    if (mode !== overscanMode) {
        setOverscanMode(mode);
        redrawDisplay(deviceData.channelRunning, api.isFullScreen());
    }
});
// Window Resize Event
window.onload = window.onresize = function () {
    redrawDisplay(deviceData.channelRunning, api.isFullScreen());
};
