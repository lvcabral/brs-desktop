/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./stylesheets/main.css";
import "./stylesheets/fontawesome.min.css";
import "./helpers/hash";
import { handleKey } from "./frontend/control";
import { deviceData } from "./frontend/device";
import { subscribeLoader, loadFile, closeChannel, currentChannel } from "./frontend/loader";
import { setServerStatus, setLocaleStatus, setStatusColor, clearCounters } from "./frontend/statusbar";
import { setDisplayMode, setOverscanMode, redrawDisplay, copyScreenshot, overscanMode } from "./frontend/display";
import { clientException } from "./frontend/console";

// App menu and theme configuration
const defaultTitle = document.title;
const display = document.getElementById("display");
const storage = window.localStorage;
const colorValues = getComputedStyle(document.documentElement);
let titleColor = colorValues.getPropertyValue("--title-color").trim();
let titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
let itemBgColor = colorValues.getPropertyValue("--item-background-color").trim();
api.setBackgroundColor(colorValues.getPropertyValue("--background-color").trim());
api.createNewTitleBar(titleColor, titleBgColor, itemBgColor);
// Setup Menu
deviceData.locale = storage.getItem("deviceLocale") || "en_US";
setLocaleStatus(deviceData.locale)
setupMenuSwitches();
// Toggle Full Screen when Double Click
display.ondblclick = function () {
    api.toggleFullScreen();
};
// Events from Main process
api.receive("postKeyDown", function (event, key) {
    if (currentChannel.running) {
        handleKey(key, 0);
    }
});
api.receive("postKeyUp", function (key) {
    if (currentChannel.running) {
        handleKey(key, 100);
    }
});
api.receive("postKeyPress", function (key) {
    if (currentChannel.running) {
        setTimeout(function () {
            handleKey(key, 100);
        }, 300);
        handleKey(key, 0);
    }
});
api.receive("closeChannel", function (source) {
    if (currentChannel.running) {
        closeChannel(source);
    }
});
api.receive("updateMenu", function () {
    setupMenuSwitches();
});
api.receive("saveScreenshot", function (file) {
    const img = display.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, "");
    api.send("saveFile", [file, data])
});
api.receive("setDisplay", function (mode) {
    if (mode !== deviceData.displayMode) {
        setDisplayMode(mode, true);
        redrawDisplay(currentChannel.running, api.isFullScreen());
    }
});
api.receive("setOverscan", function (mode) {
    setOverscanMode(mode);
    redrawDisplay(currentChannel.running, api.isFullScreen());
});
api.receive("setLocale", function (locale) {
    if (locale !== deviceData.locale) {
        deviceData.locale = locale;
        storage.setItem("deviceLocale", locale);
        setLocaleStatus(locale);
    }
});
api.receive("toggleStatusBar", function () {
    redrawDisplay(currentChannel.running, api.isFullScreen());
});
api.receive("serverStatus", function (server, enable, port) {
    if (enable) {
        console.log(`${server} server started listening port ${port}`);
    } else {
        console.log(`${server} server was disabled.`);
    }
    setServerStatus(server, enable, port);
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
api.receive("copyScreenshot", function () {
    copyScreenshot();
});
api.receive("console", function (text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
api.receive("clientException", function (msg) {
    clientException(msg);
});
api.receive("fileSelected", function (filePath, data) {
    clearCounters()
    setStatusColor();
    try {
        loadFile(filePath, data);
    } catch (error) {
        clientException(`Error opening ${filePath}:${error.message}`);
    }
});
// Subscribe Loader Events
subscribeLoader("app", (event, data) => {
    if (event === "loaded") {
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
// Window Resize Event
window.onload = window.onresize = function () {
    redrawDisplay(currentChannel.running, api.isFullScreen());
};
// Configure Menu Options
function setupMenuSwitches() {
    api.checkMenuItem(`device-${deviceData.displayMode}`,  true);
    api.checkMenuItem(`overscan-${overscanMode}`, true);
    api.checkMenuItem(deviceData.locale, true);
}
