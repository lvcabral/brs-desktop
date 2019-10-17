/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./stylesheets/main.css";
import fs from "fs";
import path from "path";
import Mousetrap from "mousetrap";
import * as customTitlebar from "custom-electron-titlebar";
import { remote, ipcRenderer } from "electron";
import JSZip from "jszip";
// App menu and theme configuration
const mainWindow = remote.getCurrentWindow();
let appMenu = remote.Menu.getApplicationMenu();
let userTheme = window.localStorage.getItem("userTheme") || "purple";
remote.getGlobal("sharedObject").backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--background-color")
    .trim();
let titleColor = getComputedStyle(document.documentElement).getPropertyValue("--title-color").trim();
let titleBgColor = getComputedStyle(document.documentElement).getPropertyValue("--title-background-color").trim();
const titleBarConfig = {
    backgroundColor: customTitlebar.Color.fromHex(titleBgColor),
    icon: "./images/icon512x512.png",
    shadow: true
};
const titleBar = new customTitlebar.Titlebar(titleBarConfig);
titleBar.titlebar.style.color = titleColor;
const defaultTitle = document.title;
// Status Bar Objects
const status = document.getElementById("status");
const statusIconFile = document.getElementById("statusIconFile");
const statusFile = document.getElementById("statusFile");
const statusIconVersion = document.getElementById("statusIconVersion");
const statusVersion = document.getElementById("statusVersion");
const statusDisplay = document.getElementById("statusDisplay");
const statusIconRes = document.getElementById("statusIconRes");
const statusResolution = document.getElementById("statusResolution");
// Channel Data
let splashTimeout = 1600;
let source = [];
let paths = [];
let txts = [];
let imgs = [];
let fonts = [];
let brsWorker;
let running = false;
// Control buffer
const length = 10;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);
// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
// Device Data
const developerId = "emulator-dev-id"; // Unique id to segregate registry among channels
const deviceData = {
    developerId: developerId,
    registry: new Map(),
    deviceModel: "8000X",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364", // Unique identifier of the device
    countryCode: "US",
    timeZone: "US/Arizona",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Options are: 480p (SD), 720p (HD), 1080p (FHD)
    defaultFont: "Asap" // Desktop app only has Asap to reduce the package size
};
// Emulator Display
const display = document.getElementById("display");
const ctx = display.getContext("2d", { alpha: false });
const screenSize = { width: 1280, height: 720 };
let displayMode = window.localStorage.getItem("displayMode") || "720p";
if (displayMode === "1080p") {
    screenSize.width = 1920;
    screenSize.height = 1080;
} else if (displayMode === "480p") {
    screenSize.width = 720;
    screenSize.height = 480;
}
let aspectRatio = displayMode === "480p" ? 4 / 3 : 16 / 9;
if (displayMode !== deviceData.displayMode) {
    changeDisplayMode(displayMode);
} else {
    updateDisplayOnStatus();
}
// Buffer Objects
const bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
const bufferCtx = bufferCanvas.getContext("2d");
let buffer = new ImageData(screenSize.width, screenSize.height);
// Overscan Mode
let overscanMode = window.localStorage.getItem("overscanMode") || "disabled";
// Setup Menu
setupMenuSwitches();
// Load Registry
const storage = window.localStorage;
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, developerId.length) === developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}
// Events from background thread
ipcRenderer.on("closeChannel", function(event) {
    if (running) {
        closeChannel();
    }
});
ipcRenderer.on("updateMenu", function(event) {
    setupMenuSwitches();
});
ipcRenderer.on("saveScreenshot", function(event, file) {
    const img = display.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(file, new Buffer(data, "base64"));
});
ipcRenderer.on("copyScreenshot", function(event) {
    copyScreenshot();
});
ipcRenderer.on("setTheme", function(event, theme) {
    userTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    remote.getGlobal("sharedObject").backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--background-color")
        .trim();
    mainWindow.setBackgroundColor(remote.getGlobal("sharedObject").backgroundColor);
    titleColor = getComputedStyle(document.documentElement).getPropertyValue("--title-color").trim();
    titleBgColor = getComputedStyle(document.documentElement).getPropertyValue("--title-background-color").trim();
    titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(titleBgColor);
    titleBar.updateBackground(titleBarConfig.backgroundColor);
    titleBar.titlebar.style.color = titleColor;
    window.localStorage.setItem("userTheme", theme);
});
ipcRenderer.on("setDisplay", function(event, mode) {
    if (mode !== deviceData.displayMode) {
        displayMode = mode;
        changeDisplayMode(mode);
        window.localStorage.setItem("displayMode", mode);
    }
});
ipcRenderer.on("setOverscan", function(event, mode) {
    overscanMode = mode;
    window.localStorage.setItem("overscanMode", mode);
    redrawDisplay();
});
ipcRenderer.on("toggleStatusBar", function(event) {
    const enable = status.style.visibility !== "visible";
    appMenu.getMenuItemById("status-bar").checked = enable;
    redrawDisplay();
});
ipcRenderer.on("console", function(event, text) {
    console.log(text);
});
ipcRenderer.on("fileSelected", function(event, file) {
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        console.log("Invalid file:", file[0]);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if (fileExt === ".zip") {
        try {
            loadFile(fileName, fs.readFileSync(filePath));
            statusIconFile.innerHTML = "<i class='fa fa-cube'></i>";
            statusFile.innerText = filePath;
        } catch (error) {
            clientException(`Error opening ${fileName}:${error.message}`);
        }
    } else if (fileExt === ".brs") {
        try {
            loadFile(fileName, new Blob([ fs.readFileSync(filePath) ], { type: "text/plain" }));
            statusIconFile.innerHTML = "<i class='far fa-file'></i>";
            statusFile.innerText = filePath;
        } catch (error) {
            clientException(`Error opening ${fileName}:${error.message}`);
        }
    } else {
        console.log("File format not supported: ", fileExt);
    }
});
// Open File
function loadFile(fileName, fileData) {
    const reader = new FileReader();
    reader.onload = function(progressEvent) {
        paths = [];
        imgs = [];
        txts = [];
        fonts = [];
        source.push(this.result);
        paths.push({ url: "source/" + fileName, id: 0, type: "source" });
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        runChannel();
    };
    source = [];
    if (running || brsWorker != undefined) {
        closeChannel();
    }
    if (fileName.split(".").pop() === "zip") {
        console.log("Loading " + fileName + "...");
        running = true;
        openChannelZip(fileData);
    } else {
        running = true;
        reader.readAsText(fileData);
    }
    appMenu.getMenuItemById("close-channel").enabled = running;
    display.focus();
}
// Uncompress Zip and execute
function openChannelZip(f) {
    JSZip.loadAsync(f).then(
        function(zip) {
            const manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        const manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function(ln) {
                            const line = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        const splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }

                        let splash;
                        if (deviceData.displayMode == "480p") {
                            splash = manifestMap.get("splash_screen_sd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_hd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_fhd");
                                }
                            }
                        } else {
                            splash = manifestMap.get("splash_screen_hd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_fhd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_sd");
                                }
                            }
                        }
                        ctx.fillStyle = "rgba(0, 0, 0, 1)";
                        ctx.fillRect(0, 0, display.width, display.height);
                        if (splash && splash.substr(0, 5) === "pkg:/") {
                            const splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then((blob) => {
                                    createImageBitmap(blob).then((imgData) => {
                                        display.style.opacity = 1;
                                        ctx.drawImage(imgData, 0, 0, screenSize.width, screenSize.height);
                                        buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height);
                                        bufferCanvas.width = buffer.width;
                                        bufferCanvas.height = buffer.height;
                                        bufferCtx.putImageData(buffer, 0, 0);
                                    });
                                });
                            }
                        }
                        if (titleBar) {
                            const title = manifestMap.get("title");
                            if (title) {
                                titleBar.updateTitle(defaultTitle + " - " + title);
                            } else {
                                titleBar.updateTitle(defaultTitle);
                            }
                            let channelVersion = "";
                            const majorVersion = manifestMap.get("major_version");
                            if (majorVersion) {
                                channelVersion += "v" + majorVersion;
                            }
                            const minorVersion = manifestMap.get("minor_version");
                            if (minorVersion) {
                                channelVersion += "." + minorVersion;
                            }
                            const buildVersion = manifestMap.get("build_version");
                            if (buildVersion) {
                                channelVersion += "." + buildVersion;
                            }
                            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
                            statusVersion.innerText = channelVersion;
                        }
                    },
                    function error(e) {
                        clientException("Error uncompressing manifest:" + e.message);
                        running = false;
                        return;
                    }
                );
            } else {
                clientException("Invalid Channel Package: missing manifest.");
                running = false;
                return;
            }
            let assetPaths = [];
            let assetsEvents = [];
            let bmpId = 0;
            let txtId = 0;
            let srcId = 0;
            let fntId = 0;
            zip.forEach(function(relativePath, zipEntry) {
                const lcasePath = relativePath.toLowerCase();
                if (!zipEntry.dir && lcasePath.substr(0, 6) === "source" && lcasePath.split(".").pop() === "brs") {
                    assetPaths.push({
                        url: relativePath,
                        id: srcId,
                        type: "source"
                    });
                    assetsEvents.push(zipEntry.async("string"));
                    srcId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath === "manifest" ||
                        lcasePath.split(".").pop() === "csv" ||
                        lcasePath.split(".").pop() === "xml" ||
                        lcasePath.split(".").pop() === "json")
                ) {
                    assetPaths.push({
                        url: relativePath,
                        id: txtId,
                        type: "text"
                    });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath.split(".").pop() === "png" ||
                        lcasePath.split(".").pop() === "gif" ||
                        lcasePath.split(".").pop() === "jpg" ||
                        lcasePath.split(".").pop() === "jpeg")
                ) {
                    assetPaths.push({
                        url: relativePath,
                        id: bmpId,
                        type: "image"
                    });
                    assetsEvents.push(zipEntry.async("blob"));
                    bmpId++;
                } else if (!zipEntry.dir && (lcasePath.split(".").pop() === "ttf" || lcasePath.split(".").pop() === "otf")) {
                    assetPaths.push({
                        url: relativePath,
                        id: fntId,
                        type: "font"
                    });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    fntId++;
                }
            });
            Promise.all(assetsEvents).then(
                function success(assets) {
                    paths = [];
                    txts = [];
                    imgs = [];
                    fonts = [];
                    const bmpEvents = [];
                    for (let index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "image") {
                            bmpEvents.push(createImageBitmap(assets[index]));
                        } else if (assetPaths[index].type === "font") {
                            fonts.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else {
                            txts.push(assets[index]);
                        }
                    }
                    Promise.all(bmpEvents).then(
                        function success(bmps) {
                            bmps.forEach((bmp) => {
                                imgs.push(bmp);
                            });
                            setTimeout(function() {
                                runChannel();
                            }, splashTimeout);
                        },
                        function error(e) {
                            clientException("Error converting image " + e.message);
                        }
                    );
                },
                function error(e) {
                    clientException("Error uncompressing file " + e.message);
                }
            );
        },
        function(e) {
            clientException("Error reading " + f.name + ": " + e.message, true);
            running = false;
        }
    );
}
// Execute Emulator Web Worker
function runChannel() {
    display.style.opacity = 1;
    display.focus();
    brsWorker = new Worker("lib/brsEmu.min.js");
    brsWorker.addEventListener("message", receiveMessage);
    const payload = {
        device: deviceData,
        paths: paths,
        brs: source,
        texts: txts,
        fonts: fonts,
        images: imgs
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, imgs);
}
// Receive Screen and Registry data from Web Worker
function receiveMessage(event) {
    if (event.data instanceof ImageData) {
        buffer = event.data;
        if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
            statusResolution.innerText = `${buffer.width}x${buffer.height}`;
            statusIconRes.innerHTML = "<i class='fa fa-ruler-combined'></i>";
            bufferCanvas.width = buffer.width;
            bufferCanvas.height = buffer.height;
        }
        bufferCtx.putImageData(buffer, 0, 0);
        drawBufferImage();
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function(value, key) {
            storage.setItem(key, value);
        });
    } else if (event.data == "end") {
        closeChannel();
    }
}
// Restore emulator menu and terminate Worker
function closeChannel() {
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, display.width, display.height);
    if (titleBar) {
        titleBar.updateTitle(defaultTitle);
        statusIconFile.innerText = "";
        statusFile.innerText = "";
        statusIconVersion.innerText = "";
        statusVersion.innerText = "";
        statusIconRes.innerText = "";
        statusResolution.innerText = "";
    }
    brsWorker.terminate();
    sharedArray[0] = 0;
    bufferCanvas.width = 1;
    running = false;
    appMenu.getMenuItemById("close-channel").enabled = false;
}
// Remote control emulator
function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 6; // BUTTON_SELECT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 37) {
        sharedArray[0] = 4; // BUTTON_LEFT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 39) {
        sharedArray[0] = 5; // BUTTON_RIGHT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 38) {
        sharedArray[0] = 2; // BUTTON_UP_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 40) {
        sharedArray[0] = 3; // BUTTON_DOWN_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 111) {
        sharedArray[0] = 7; // BUTTON_INSTANT_REPLAY_PRESSED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 10; // BUTTON_INFO_PRESSED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 8; // BUTTON_REWIND_PRESSED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 13; // BUTTON_PLAY_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 190) {
        sharedArray[0] = 9; // BUTTON_FAST_FORWARD_PRESSED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 17; // BUTTON_A_PRESSED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 18; // BUTTON_B_PRESSED
    } else if (event.keyCode == 27) {
        if (brsWorker != undefined) {
            // HOME BUTTON (ESC)
            closeChannel();
        }
    }
    // TODO: Send TimeSinceLastKeypress()
}
function keyUpHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 100; // BUTTON_BACK_RELEASED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 106; // BUTTON_SELECT_RELEASED
    } else if (event.keyCode == 37) {
        sharedArray[0] = 104; // BUTTON_LEFT_RELEASED
    } else if (event.keyCode == 39) {
        sharedArray[0] = 105; // BUTTON_RIGHT_RELEASED
    } else if (event.keyCode == 38) {
        sharedArray[0] = 102; // BUTTON_UP_RELEASED
    } else if (event.keyCode == 40) {
        sharedArray[0] = 103; // BUTTON_DOWN_RELEASED
    } else if (event.keyCode == 111) {
        sharedArray[0] = 107; // BUTTON_INSTANT_REPLAY_RELEASED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 110; // BUTTON_INFO_RELEASED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 108; // BUTTON_REWIND_RELEASED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 113; // BUTTON_PLAY_RELEASED
    } else if (event.keyCode == 190) {
        sharedArray[0] = 109; // BUTTON_FAST_FORWARD_RELEASED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 117; // BUTTON_A_RELEASED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 118; // BUTTON_B_RELEASED
    }
}
Mousetrap.bind([ "command+c", "ctrl+c" ], function() {
    console.log("copied screenshot!");
    copyScreenshot();
    return false;
});
// Copy Screenshot to the Clipboard
function copyScreenshot() {
    display.toBlob(function(blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([ item ]);
    });
}
// Status Bar visibility
function showStatusBar(visible) {
    if (visible) {
        display.style.bottom = "20px";
        status.style.visibility = "visible";
    } else {
        display.style.bottom = "0px";
        status.style.visibility = "hidden";
    }
}
// Exception Handler
function clientException(msg) {
    // TODO: Add icon on status bar to notify error
    console.error(msg);
}
// Fix text color after focus change
titleBar.onBlur = titleBar.onFocus = function() {
    titleBar.titlebar.style.color = titleColor;
};
// Toggle Full Screen when Double Click
display.ondblclick = function() {
    const toggle = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(toggle);
};
// Window Resize Event
window.onload = window.onresize = function() {
    redrawDisplay();
};
// Redraw Display Canvas
function redrawDisplay() {
    if (mainWindow.isFullScreen()) {
        titleBar.titlebar.style.display = "none";
        titleBar.container.style.top = "0px";
        showStatusBar(false);
        screenSize.width = window.innerWidth;
        screenSize.height = parseInt(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = parseInt(screenSize.height * aspectRatio);
        }
    } else {
        const ratio = 0.97;
        let offset = 13;
        titleBar.titlebar.style.display = "";
        titleBar.container.style.top = "30px";
        if (appMenu.getMenuItemById("status-bar").checked) {
            showStatusBar(true);
            offset = 30;
        } else {
            showStatusBar(false);
        }
        screenSize.width = window.innerWidth * ratio;
        screenSize.height = parseInt(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight * ratio - offset) {
            screenSize.height = window.innerHeight * ratio - offset;
            screenSize.width = parseInt(screenSize.height * aspectRatio);
        }
    }
    display.width = screenSize.width;
    display.style.width = screenSize.width;
    display.height = screenSize.height;
    display.style.height = screenSize.height;
    if (running) {
        drawBufferImage();
    }
}
// Draw Buffer Image to the Display Canvas
function drawBufferImage() {
    let overscan = 0.04;
    if (overscanMode === "enabled") {
        let x = Math.round(bufferCanvas.width * overscan);
        let y = Math.round(bufferCanvas.height * overscan);
        let w = bufferCanvas.width - x * 2;
        let h = bufferCanvas.height - y * 2;
        ctx.drawImage(bufferCanvas, x, y, w, h, 0, 0, screenSize.width, screenSize.height);
    } else {
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
    }
    if (overscanMode === "guide-lines") {
        let x = Math.round(screenSize.width * overscan);
        let y = Math.round(screenSize.height * overscan);
        let w = screenSize.width - x * 2;
        let h = screenSize.height - y * 2;
        ctx.strokeStyle = "#D0D0D0FF";
        ctx.lineWidth = 2;
        ctx.setLineDash([ 1, 2 ]);
        ctx.strokeRect(x, y, w, h);
    }
}
// Change Display Mode
function changeDisplayMode(mode) {
    if (running) {
        closeChannel();
    }
    deviceData.displayMode = mode;
    deviceData.deviceModel = mode == "720p" ? "8000X" : mode == "1080p" ? "4620X" : "2720X";
    aspectRatio = deviceData.displayMode === "480p" ? 4 / 3 : 16 / 9;
    updateDisplayOnStatus();
    redrawDisplay();
}
// Update Display Mode on Status Bar
function updateDisplayOnStatus() {
    if (status) {
        let ui = deviceData.displayMode == "720p" ? "HD" : deviceData.displayMode == "1080p" ? "FHD" : "SD";
        statusDisplay.innerText = `${ui} (${deviceData.displayMode})`;
    }
}
// Configure Menu Options
function setupMenuSwitches() {
    appMenu = remote.Menu.getApplicationMenu();
    appMenu.getMenuItemById("close-channel").enabled = running;
    appMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    appMenu.getMenuItemById(`device-${displayMode}`).checked = true;
    appMenu.getMenuItemById(`overscan-${overscanMode}`).checked = true;
    appMenu.getMenuItemById("status-bar").checked = status.style.visibility === "visible";
}
