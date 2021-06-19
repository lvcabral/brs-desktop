/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./stylesheets/main.css";
import "./stylesheets/fontawesome.min.css";
import "./helpers/hash";
import { remote, ipcRenderer } from "electron";
import { userTheme } from "./frontend/titlebar";
import { handleKey } from "./frontend/control";
import { deviceData } from "./frontend/device";
import { subscribeLoader, loadFile, closeChannel, currentChannel } from "./frontend/loader";
import { toggleStatusBar, setServerStatus, setLocaleStatus, setStatusColor, clearCounters } from "./frontend/statusbar";
import { setDisplayMode, setOverscanMode, redrawDisplay, copyScreenshot, overscanMode } from "./frontend/display";
import { clientException } from "./frontend/console";
import Mousetrap from "mousetrap";
import fs from "fs";
import path from "path";
// App menu and theme configuration
const mainWindow = remote.getCurrentWindow();
const display = document.getElementById("display");
const storage = window.localStorage;
let appMenu = remote.Menu.getApplicationMenu();
// ECP Server 
let ECPEnabled = storage.getItem("ECPEnabled") || "false";
ipcRenderer.send("ECPEnabled", ECPEnabled === "true");
setServerStatus("ECP", 8060, ECPEnabled === "true");
// Telnet Server
let telnetEnabled = storage.getItem("telnetEnabled") || "false";
ipcRenderer.send("telnetEnabled", telnetEnabled === "true");
setServerStatus("Telnet", 8085, telnetEnabled === "true");
// Web Installer Server 
let installerEnabled = storage.getItem("installerEnabled") || "false";
let installerPassword = storage.getItem("installerPassword") || "rokudev";
let installerPort = storage.getItem("installerPort") || "80";
ipcRenderer.send("installerEnabled", installerEnabled === "true", installerPassword, installerPort);
setServerStatus("Web", installerPort, installerEnabled === "true");
// Setup Menu
deviceData.locale = storage.getItem("deviceLocale") || "en_US";
setLocaleStatus(deviceData.locale)
setupMenuSwitches();
// Toggle Full Screen when Double Click
display.ondblclick = function() {
    const toggle = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(toggle);
};
// Detect Clipboard Copy to create Screenshot
Mousetrap.bind([ "command+c", "ctrl+c" ], function() {
    copyScreenshot();
    return false;
});
// Events from Main process
ipcRenderer.on("postKeyDown", function(event, key) {
    if (currentChannel.running) {
        handleKey(key.toLowerCase(), 0);
    }
});
ipcRenderer.on("postKeyUp", function(event, key) {
    if (currentChannel.running) {
        handleKey(key.toLowerCase(), 100);
    }
});
ipcRenderer.on("postKeyPress", function(event, key) {
    if (currentChannel.running) {
        setTimeout(function() {
            handleKey(key.toLowerCase(), 100);
        }, 300);
        handleKey(key.toLowerCase(), 0);
    }
});
ipcRenderer.on("closeChannel", function(event, source) {
    if (currentChannel.running) {
        closeChannel(source);
    }
});
ipcRenderer.on("updateMenu", function(event) {
    setupMenuSwitches(true);
});
ipcRenderer.on("saveScreenshot", function(event, file) {
    const img = display.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(file, new Buffer(data, "base64"));
});
ipcRenderer.on("setDisplay", function(event, mode) {
    if (mode !== deviceData.displayMode) {
        setDisplayMode(mode, true);
        redrawDisplay(currentChannel.running, mainWindow.isFullScreen());
    }
});
ipcRenderer.on("setOverscan", function(event, mode) {
    setOverscanMode(mode);
    redrawDisplay(currentChannel.running, mainWindow.isFullScreen());
});
ipcRenderer.on("setLocale", function(event, locale) {
    if (locale !== deviceData.locale) {
        deviceData.locale = locale;
        storage.setItem("deviceLocale", locale);
        setLocaleStatus(locale);
    }
});
ipcRenderer.on("setPassword", function(event, pwd) {
    storage.setItem("installerPassword", pwd);
});
ipcRenderer.on("toggleOnTop", function(event) {
    const onTop = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(onTop);
    appMenu.getMenuItemById("on-top").checked = onTop;
});
ipcRenderer.on("toggleStatusBar", function(event) {
    toggleStatusBar();
    redrawDisplay(currentChannel.running, mainWindow.isFullScreen());
});
ipcRenderer.on("toggleECP", function(event, enable, port) {
    if (enable) {
        console.log(`ECP server started listening port ${port}`);
    } else {
        console.log("ECP server disabled."); 
    }
    appMenu.getMenuItemById("ecp-api").checked = enable;
    ECPEnabled = enable ? "true" : "false";
    storage.setItem("ECPEnabled", ECPEnabled);
    setServerStatus("ECP", port, enable);
});
ipcRenderer.on("toggleTelnet", function(event, enable, port) {
    if (enable) {
        console.log(`Remote console started listening port ${port}`);
    } else {
        console.log("Remote console server disabled."); 
    }
    appMenu.getMenuItemById("telnet").checked = enable;
    telnetEnabled = enable ? "true" : "false";
    storage.setItem("telnetEnabled", telnetEnabled);
    setServerStatus("Telnet", port, enable);
});
ipcRenderer.on("toggleInstaller", function(event, enable, port, error) {
    if (enable) {
        console.log(`Installer server started listening port ${port}`);
        installerPort = port;
        storage.setItem("installerPort", port);
    } else if (error) {
        console.error("Installer server error:", error);
    } else {
        console.log("Installer server disabled.");
    }
    appMenu.getMenuItemById("web-installer").checked = enable;
    installerEnabled = enable ? "true" : "false";
    storage.setItem("installerEnabled", installerEnabled);
    setServerStatus("Web", port, enable);
});
ipcRenderer.on("setTheme", function(event, theme) {
    setStatusColor();
});
ipcRenderer.on("copyScreenshot", function(event) {
    copyScreenshot();
});
ipcRenderer.on("console", function(event, text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
ipcRenderer.on("fileSelected", function(event, file) {
    clearCounters()
    setStatusColor();
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        clientException(`Invalid file: ${file[0]}`);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if (fileExt === ".zip") {
        try {
            loadFile(filePath, fs.readFileSync(filePath));
        } catch (error) {
            clientException(`Error opening ${fileName}:${error.message}`);
        }
    } else if (fileExt === ".brs") {
        try {
            loadFile(filePath, new Blob([ fs.readFileSync(filePath) ], { type: "text/plain" }));
        } catch (error) {
            clientException(`Error opening ${fileName}:${error.message}`);
        }
    } else {
        clientException(`File format not supported: ${fileExt}`);
    }
});
// Subscribe Loader Events
subscribeLoader("app", (event, data) => {
    if (event === "icon") {
        const iconPath = path.join(
            remote.app.getPath("userData"), 
            currentChannel.id + ".png"
        );
        fs.writeFileSync(iconPath, data);
    } else if (event === "reset") {
        mainWindow.reload();        
    }
});
// Window Resize Event
window.onload = window.onresize = function() {
    redrawDisplay(currentChannel.running, mainWindow.isFullScreen());
};
// Configure Menu Options
function setupMenuSwitches(status) {
    appMenu = remote.Menu.getApplicationMenu();
    appMenu.getMenuItemById("close-channel").enabled = currentChannel.running;
    appMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    appMenu.getMenuItemById(`device-${deviceData.displayMode}`).checked = true;
    appMenu.getMenuItemById(`overscan-${overscanMode}`).checked = true;
    appMenu.getMenuItemById(deviceData.locale).checked = true;
    appMenu.getMenuItemById("ecp-api").checked = (ECPEnabled === "true");
    appMenu.getMenuItemById("telnet").checked = (telnetEnabled === "true");
    appMenu.getMenuItemById("web-installer").checked = (installerEnabled === "true");
    if (status) {
        const statusBar = document.getElementById("status");
        appMenu.getMenuItemById("status-bar").checked = statusBar.style.visibility === "visible";
    }
}
