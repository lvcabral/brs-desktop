/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./stylesheets/main.css";
import "./stylesheets/fontawesome.min.css"
import "./helpers/hash";
import { remote, ipcRenderer } from "electron";
import { userTheme } from "./frontend/titlebar";
import { setMessageCallback, loadFile, closeChannel, deviceData, dataType, sharedArray, running } from "./frontend/loader";
import { displayMode, overscanMode, setDisplayMode, setOverscanMode, drawBufferImage, redrawDisplay } from "./frontend/display";
import { clientLog, clientWarning, clientException, errorCount, warnCount, clearCounters } from "./frontend/console";
import { toggleStatusBar, setServerStatus, setStatusColor, setDisplayStatus } from "./frontend/statusbar";
import { playSound, stopSound, pauseSound, resumeSound, setLoop, setNext, triggerWav, playWav, stopWav, addPlaylist, addSound } from "./frontend/sound";
import fs from "fs";
import path from "path";
// App menu and theme configuration
const mainWindow = remote.getCurrentWindow();
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
ipcRenderer.send("installerEnabled", installerEnabled === "true", installerPassword);
setServerStatus("Web", 80, installerEnabled === "true");
// Set Display Mode
if (displayMode !== deviceData.displayMode) {
    changeDisplayMode(displayMode);
} else {
    setDisplayStatus(displayMode);
}
// Setup Menu
setupMenuSwitches();
// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
// Load Registry
Object.assign(deviceData, {registry: new Map()});
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, deviceData.developerId.length) === deviceData.developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}
// Events from background thread
ipcRenderer.on("postKeyDown", function(event, key) {
    if (running) {
        handleKey(key.toLowerCase(), 0);
    }
});
ipcRenderer.on("postKeyUp", function(event, key) {
    if (running) {
        handleKey(key.toLowerCase(), 100);
    }
});
ipcRenderer.on("postKeyPress", function(event, key) {
    if (running) {
        setTimeout(function() {
            handleKey(key.toLowerCase(), 100);
        }, 300);
        handleKey(key.toLowerCase(), 0);
    }
});
ipcRenderer.on("closeChannel", function(event, source) {
    if (running) {
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
        changeDisplayMode(mode);
        storage.setItem("displayMode", mode);
    }
});
ipcRenderer.on("setOverscan", function(event, mode) {
    storage.setItem("overscanMode", mode);
    setOverscanMode(mode);
    redrawDisplay(running);
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
    redrawDisplay(running);
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
ipcRenderer.on("console", function(event, text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
ipcRenderer.on("fileSelected", function(event, file) {
    clearCounters()
    setStatusColor(errorCount, warnCount);
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
// Receive Messages from Web Worker
setMessageCallback( function (event) {
    if (event.data instanceof ImageData) {
        drawBufferImage(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function(value, key) {
            storage.setItem(key, value);
        });
    } else if (event.data instanceof Array) {
        addPlaylist(event.data);
    } else if (event.data.audioPath) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (event.data === "play") {
        playSound();
    } else if (event.data === "stop") {
        stopSound();
    } else if (event.data === "pause") {
        pauseSound();
    } else if (event.data === "resume") {
        resumeSound();
    } else if (event.data.substr(0, 4) === "loop") {
        const loop = event.data.split(",")[1];
        if (loop) {
            setLoop(loop === "true");
        } else {
            clientWarning(`Missing loop parameter: ${event.data}`);
        }
    } else if (event.data.substr(0, 4) === "next") {
        const newIndex = event.data.split(",")[1];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            setNext(parseInt(newIndex));
        } else {
            clientWarning(`Invalid next index: ${event.data}`);
        }
    } else if (event.data.substr(0, 4) === "seek") {
        const audio = playList[playIndex];
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            seekSound(parseInt(position));
        } else {
            clientWarning(`Invalid seek position: ${event.data}`);
        }
    } else if (event.data.substr(0, 7) === "trigger") {
        triggerWav(event.data.split(",")[1]);
    } else if (event.data.substr(0, 5) === "stop,") {
        stopWav(event.data.split(",")[1])
    } else if (event.data.substr(0, 4) === "log,") {
        clientLog(event.data.substr(4));
    } else if (event.data.substr(0, 8) === "warning,") {
        clientWarning(event.data.substr(8));
    } else if (event.data.substr(0, 6) === "error,") {
        clientException(event.data.substr(6));
    } else if (event.data === "end") {
        closeChannel("Normal");
    } else if (event.data === "reset") {
        mainWindow.reload();
    }
});

// Remote control emulator
function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[dataType.KEY] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[dataType.KEY] = 6; // BUTTON_SELECT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 37) {
        sharedArray[dataType.KEY] = 4; // BUTTON_LEFT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 39) {
        sharedArray[dataType.KEY] = 5; // BUTTON_RIGHT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 38) {
        sharedArray[dataType.KEY] = 2; // BUTTON_UP_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 40) {
        sharedArray[dataType.KEY] = 3; // BUTTON_DOWN_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 111) {
        sharedArray[dataType.KEY] = 7; // BUTTON_INSTANT_REPLAY_PRESSED
    } else if (event.keyCode == 106) {
        sharedArray[dataType.KEY] = 10; // BUTTON_INFO_PRESSED
    } else if (event.keyCode == 188) {
        sharedArray[dataType.KEY] = 8; // BUTTON_REWIND_PRESSED
    } else if (event.keyCode == 32) {
        sharedArray[dataType.KEY] = 13; // BUTTON_PLAY_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 190) {
        sharedArray[dataType.KEY] = 9; // BUTTON_FAST_FORWARD_PRESSED
    } else if (event.keyCode == 65) {
        sharedArray[dataType.KEY] = 17; // BUTTON_A_PRESSED
    } else if (event.keyCode == 90) {
        sharedArray[dataType.KEY] = 18; // BUTTON_B_PRESSED
    } else if (event.keyCode == 27) {
        if (running) {
            // HOME BUTTON (ESC)
            closeChannel("Home Button");
            playWav(0);
        }
    }
    // TODO: Send TimeSinceLastKeypress()
}
function keyUpHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[dataType.KEY] = 100; // BUTTON_BACK_RELEASED
    } else if (event.keyCode == 13) {
        sharedArray[dataType.KEY] = 106; // BUTTON_SELECT_RELEASED
    } else if (event.keyCode == 37) {
        sharedArray[dataType.KEY] = 104; // BUTTON_LEFT_RELEASED
    } else if (event.keyCode == 39) {
        sharedArray[dataType.KEY] = 105; // BUTTON_RIGHT_RELEASED
    } else if (event.keyCode == 38) {
        sharedArray[dataType.KEY] = 102; // BUTTON_UP_RELEASED
    } else if (event.keyCode == 40) {
        sharedArray[dataType.KEY] = 103; // BUTTON_DOWN_RELEASED
    } else if (event.keyCode == 111) {
        sharedArray[dataType.KEY] = 107; // BUTTON_INSTANT_REPLAY_RELEASED
    } else if (event.keyCode == 106) {
        sharedArray[dataType.KEY] = 110; // BUTTON_INFO_RELEASED
    } else if (event.keyCode == 188) {
        sharedArray[dataType.KEY] = 108; // BUTTON_REWIND_RELEASED
    } else if (event.keyCode == 32) {
        sharedArray[dataType.KEY] = 113; // BUTTON_PLAY_RELEASED
    } else if (event.keyCode == 190) {
        sharedArray[dataType.KEY] = 109; // BUTTON_FAST_FORWARD_RELEASED
    } else if (event.keyCode == 65) {
        sharedArray[dataType.KEY] = 117; // BUTTON_A_RELEASED
    } else if (event.keyCode == 90) {
        sharedArray[dataType.KEY] = 118; // BUTTON_B_RELEASED
    }
}

function handleKey(key, mod) {
    if (key == "back") {
        sharedArray[dataType.KEY] = 0 + mod; // BUTTON_BACK
    } else if (key == "select") {
        sharedArray[dataType.KEY] = 6 + mod; // BUTTON_SELECT
    } else if (key == "left") {
        sharedArray[dataType.KEY] = 4 + mod; // BUTTON_LEFT
    } else if (key == "right") {
        sharedArray[dataType.KEY] = 5 + mod; // BUTTON_RIGHT
    } else if (key == "up") {
        sharedArray[dataType.KEY] = 2 + mod; // BUTTON_UP
    } else if (key == "down") {
        sharedArray[dataType.KEY] = 3 + mod; // BUTTON_DOWN
    } else if (key == "instantreplay") {
        sharedArray[dataType.KEY] = 7 + mod; // BUTTON_INSTANT_REPLAY
    } else if (key == "info") {
        sharedArray[dataType.KEY] = 10 + mod; // BUTTON_INFO
    } else if (key == "rev") {
        sharedArray[dataType.KEY] = 8 + mod; // BUTTON_REWIND
    } else if (key == "play") {
        sharedArray[dataType.KEY] = 13 + mod; // BUTTON_PLAY
    } else if (key == "fwd") {
        sharedArray[dataType.KEY] = 9 + mod; // BUTTON_FAST_FORWARD
    } else if (key == "a") {
        sharedArray[dataType.KEY] = 17 + mod; // BUTTON_A
    } else if (key == "b") {
        sharedArray[dataType.KEY] = 18 + mod; // BUTTON_B
    } else if (key == "home" && mod === 0) {
        if (running) {        // HOME BUTTON (ESC)
            closeChannel("Home Button");
            playWav(0);
        }
    }
}
// Toggle Full Screen when Double Click
display.ondblclick = function() {
    const toggle = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(toggle);
};
// Window Resize Event
window.onload = window.onresize = function() {
    redrawDisplay(running);
};

// Change Display Mode
function changeDisplayMode(mode) {
    if (running) {
        closeChannel();
    }
    deviceData.displayMode = mode;
    deviceData.deviceModel = mode == "720p" ? "4200X" : mode == "1080p" ? "4640X" : "2720X";    
    setDisplayStatus(mode);
    setDisplayMode(mode);
    redrawDisplay(running);
}

// Configure Menu Options
function setupMenuSwitches(status = false) {
    appMenu = remote.Menu.getApplicationMenu();
    appMenu.getMenuItemById("close-channel").enabled = running;
    appMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    appMenu.getMenuItemById(`device-${displayMode}`).checked = true;
    appMenu.getMenuItemById(`overscan-${overscanMode}`).checked = true;
    appMenu.getMenuItemById("ecp-api").checked = (ECPEnabled === "true");
    appMenu.getMenuItemById("telnet").checked = (telnetEnabled === "true");
    appMenu.getMenuItemById("web-installer").checked = (installerEnabled === "true");
    // if (status) {
    //     appMenu.getMenuItemById("status-bar").checked = statusBar.style.visibility === "visible";
    // }
}
