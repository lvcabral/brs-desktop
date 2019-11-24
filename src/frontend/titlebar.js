import { remote, ipcRenderer } from "electron";
import { subscribeLoader } from "./loader";
import { subscribeDisplay } from "./display";
import * as customTitlebar from "custom-electron-titlebar";

const mainWindow = remote.getCurrentWindow();
const defaultTitle = document.title;
const storage = window.localStorage;
const colorValues = getComputedStyle(document.documentElement);
remote.getGlobal("sharedObject").backgroundColor = colorValues
    .getPropertyValue("--background-color")
    .trim();
let titleColor = colorValues.getPropertyValue("--title-color").trim();
let titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
const titleBarConfig = {
    backgroundColor: customTitlebar.Color.fromHex(titleBgColor),
    icon: "./images/icon512x512.png",
    shadow: true
};
export let userTheme = storage.getItem("userTheme") || "purple";
export const titleBar = new customTitlebar.Titlebar(titleBarConfig);
titleBar.titlebar.style.color = titleColor;
// Fix text color after focus change
titleBar.onBlur = titleBar.onFocus = function() {
    titleBar.titlebar.style.color = titleColor;
};
// Subscribe Loader Events
subscribeLoader("titlebar", (event, data) => {
    if (event === "loaded") {
        titleBar.updateTitle(defaultTitle + " - " + data.title);
        if (data.id === "brs") {
            ipcRenderer.send("addRecentSource", data.file);
        } else {
            ipcRenderer.send("addRecentPackage", data);
        }
    } else if (event === "closed") {
        titleBar.updateTitle(defaultTitle);
    }
});
// Subscribe Display Events
subscribeDisplay("titlebar", (event, data) => {
    if (event === "redraw") {
        if (data) {
            titleBar.titlebar.style.display = "none";
            titleBar.container.style.top = "0px";   
        } else {
            titleBar.titlebar.style.display = "";
            titleBar.container.style.top = "30px";    
        }
    }
});
// Main process events
ipcRenderer.on("setTheme", function(event, theme) {
    userTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    remote.getGlobal("sharedObject").backgroundColor = colorValues.getPropertyValue("--background-color").trim();
    mainWindow.setBackgroundColor(remote.getGlobal("sharedObject").backgroundColor);
    titleColor = colorValues.getPropertyValue("--title-color").trim();
    titleBgColor = colorValues.getPropertyValue("--title-background-color").trim();
    titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(titleBgColor);
    titleBar.updateBackground(titleBarConfig.backgroundColor);
    titleBar.titlebar.style.color = titleColor;
    storage.setItem("userTheme", theme);
});
console.log("TitleBar module initialized!");
