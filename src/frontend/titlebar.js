import { remote, ipcRenderer } from "electron";
import { errorCount, warnCount } from "./console";
import { setStatusColor } from "./statusbar";
import * as customTitlebar from "custom-electron-titlebar";

const mainWindow = remote.getCurrentWindow();
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
    setStatusColor(errorCount, warnCount);
    storage.setItem("userTheme", theme);
});

