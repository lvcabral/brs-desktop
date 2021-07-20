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
import { deviceData } from "./app/device";
import { subscribeChannel, currentChannel } from "./app/channel";
import { setLocaleStatus, setStatusColor } from "./app/statusbar";

// App menu and theme configuration
const defaultTitle = document.title;
const colorValues = getComputedStyle(document.documentElement);
let titleColor = colorValues.getPropertyValue("--title-color").trim();
let titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
let itemBgColor = colorValues.getPropertyValue("--item-background-color").trim();
api.setBackgroundColor(colorValues.getPropertyValue("--background-color").trim());
api.createNewTitleBar(titleColor, titleBgColor, itemBgColor);
// Locale on StatusBar
setLocaleStatus(deviceData.locale);
// Subscribe Loader Events
subscribeChannel("app", (event, data) => {
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
api.receive("setLocale", function (locale) {
    if (locale !== deviceData.locale) {
        deviceData.locale = locale;
        setLocaleStatus(locale);
    }
});
