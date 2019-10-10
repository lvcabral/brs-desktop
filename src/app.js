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

// App menu and theme configuration
const mainWindow = remote.getCurrentWindow();
const appMenu = remote.Menu.getApplicationMenu();
const userTheme = window.localStorage.getItem("userTheme");
if (userTheme) {
    appMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
}
remote.getGlobal('sharedObject').backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
var titleColor = getComputedStyle(document.documentElement).getPropertyValue('--title-color').trim();
var titleBgColor = getComputedStyle(document.documentElement).getPropertyValue('--title-background-color').trim();
const titleBarConfig = {
    backgroundColor: customTitlebar.Color.fromHex(titleBgColor),
    icon: "./images/icon512x512.png",
    shadow: true
};
var titleBar = new customTitlebar.Titlebar(titleBarConfig);
titleBar.titlebar.style.color = titleColor;
var defaultTitle = document.title;
// Emulator code
import JSZip from "jszip";
var display = document.getElementById("display");
var screenSize = { width: 854, height: 480 };
var ctx = display.getContext("2d", { alpha: false });
// Status Bar Objects
var status = document.getElementById("status");
var statusIconFile = document.getElementById("statusIconFile");
var statusFile = document.getElementById("statusFile");
var statusIconVersion = document.getElementById("statusIconVersion");
var statusVersion = document.getElementById("statusVersion");
var statusDisplay = document.getElementById("statusDisplay");
var statusIconRes = document.getElementById("statusIconRes");
var statusResolution = document.getElementById("statusResolution");
// Buffer Objects
var bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
var bufferCtx = bufferCanvas.getContext("2d");
var buffer = new ImageData(screenSize.width, screenSize.height);
// Channel Data
var splashTimeout = 1600;
var source = [];
var paths = [];
var txts = [];
var imgs = [];
var fonts = [];
var brsWorker;
var running = false;

// Control buffer
const length = 10;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);

// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

// Device Data
const developerId = "UniqueDeveloperId";
const deviceData = {
    developerId: developerId,
    registry: new Map(),
    deviceModel: "8000X",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    countryCode: "US",
    timeZone: "US/Arizona",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Options are: 480p (SD), 720p (HD), 1080p (FHD)
    defaultFont: "Asap", // Desktop app only has Asap to reduce the package size
};

if (status) {
    let ui = deviceData.displayMode == "720p" ? "HD" : deviceData.displayMode == "1080p" ? "FHD" : "SD";
    statusDisplay.innerText = `${ui} (${deviceData.displayMode})`;
}

// Load Registry
const storage = window.localStorage;
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, developerId.length) === developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}

// Open File
ipcRenderer.on('fileSelected', function (event, file) {
    var filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        console.log("Invalid file:", file[0]);
        return;
    }
    statusFile.innerText = filePath;
    var fileName = path.parse(filePath).base;
    var fileExt = path.parse(filePath).ext.toLowerCase();
    if ( fileExt === ".zip") {
        statusIconFile.innerHTML = "<i class='fa fa-cube'></i>";
        try {
            loadFile(fileName, fs.readFileSync(filePath));                
        } catch (error) {
            document.alert("Error opening Channel Package! Check console for details.");
            console.error(`Error opening ${fileName}:`, error.message);
        }
    } else if (fileExt === ".brs") {
        statusIconFile.innerHTML = "<i class='far fa-file'></i>";
        try {
            loadFile(fileName, new Blob([fs.readFileSync(filePath)], {type: "text/plain"}));                
        } catch (error) {
            document.alert("Error opening BrightScript file! Check console for details.");
            console.error(`Error opening ${fileName}:`, error.message);             
        }
    } else {
        console.log("File format not supported: ", fileExt);
    }
});    
ipcRenderer.on('saveScreenshot', function (event, file) {
    var img = display.toDataURL('image/png');
    var data = img.replace(/^data:image\/\w+;base64,/, "");
    var buf = new Buffer(data, 'base64');
    fs.writeFileSync(file, buf);
});    
ipcRenderer.on('setTheme', function (event, theme) {
    document.documentElement.setAttribute('data-theme', theme);
    remote.getGlobal('sharedObject').backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
    mainWindow.setBackgroundColor(remote.getGlobal('sharedObject').backgroundColor);
    titleColor = getComputedStyle(document.documentElement).getPropertyValue('--title-color').trim();
    titleBgColor = getComputedStyle(document.documentElement).getPropertyValue('--title-background-color').trim();
    titleBarConfig.backgroundColor = customTitlebar.Color.fromHex(titleBgColor)
    titleBar.updateBackground(titleBarConfig.backgroundColor);
    titleBar.titlebar.style.color = titleColor;
    window.localStorage.setItem("userTheme", theme);
});    
ipcRenderer.on('toggleStatusBar', function (event) {
    var enable = status.style.visibility!=="visible";
    appMenu.getMenuItemById("status-bar").checked = enable;
    resizeWindow();
});
ipcRenderer.on('copyScreenshot', function (event) {
    copyScreenshot();
});
ipcRenderer.on('console', function (event, text) {
    console.log(text);
});

function loadFile(fileName, fileData) {
    var reader = new FileReader();
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
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    if (fileName.split(".").pop() === "zip") {
        console.log("Loading " + fileName + "...");
        running = true;
        openChannelZip(fileData);
    } else {
        running = true;
        reader.readAsText(fileData);
    }
    display.focus();
}

// Uncompress Zip and execute
function openChannelZip(f) {
    JSZip.loadAsync(f).then(
        function(zip) {
            var manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        var manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function(ln) {
                            var line = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        var splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }

                        var splash;
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
                            var splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then(blob => {
                                    createImageBitmap(blob).then(imgData => {
                                        display.style.opacity = 1;
                                        ctx.drawImage(
                                            imgData,
                                            0,
                                            0,
                                            screenSize.width,
                                            screenSize.height
                                        );
                                        buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height)
                                        bufferCanvas.width = buffer.width;
                                        bufferCanvas.height = buffer.height;
                                        bufferCtx.putImageData(buffer, 0, 0);                                
                                    });
                                });
                            }
                        }
                        if (titleBar) {
                            var title = manifestMap.get("title");
                            if (title) {
                                titleBar.updateTitle(defaultTitle + " - " + title);
                            } else {
                                titleBar.updateTitle(defaultTitle);
                            }
                            var channelVersion = ""
                            var majorVersion = manifestMap.get("major_version");
                            if (majorVersion) {
                                channelVersion += "v" + majorVersion;
                            }
                            var minorVersion = manifestMap.get("minor_version");
                            if (minorVersion) {
                                channelVersion += "." + minorVersion;
                            }
                            var buildVersion = manifestMap.get("build_version");
                            if (buildVersion) {
                                channelVersion += "." + buildVersion;
                            }                            
                            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
                            statusVersion.innerText = channelVersion;
                        }
                    },
                    function error(e) {
                        clientException("Error uncompressing manifest:" + e.message, true);
                        running = false;
                        return;
                    }
                );
            } else {
                clientException("Invalid Channel Package: missing manifest.", true);
                running = false;
                return;
            }
            var assetPaths = [];
            var assetsEvents = [];
            var bmpId = 0;
            var txtId = 0;
            var srcId = 0;
            var fntId = 0;
            zip.forEach(function(relativePath, zipEntry) {
                var lcasePath = relativePath.toLowerCase();
                if (
                    !zipEntry.dir &&
                    lcasePath.substr(0, 6) === "source" &&
                    lcasePath.split(".").pop() === "brs"
                ) {
                    assetPaths.push({ url: relativePath, id: srcId, type: "source" });
                    assetsEvents.push(zipEntry.async("string"));
                    srcId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath === "manifest" ||
                        lcasePath.split(".").pop() === "csv" ||
                        lcasePath.split(".").pop() === "xml" ||
                        lcasePath.split(".").pop() === "json")
                ) {
                    assetPaths.push({ url: relativePath, id: txtId, type: "text" });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath.split(".").pop() === "png" ||
                        lcasePath.split(".").pop() === "gif" ||
                        lcasePath.split(".").pop() === "jpg" ||
                        lcasePath.split(".").pop() === "jpeg")
                ) {
                    assetPaths.push({ url: relativePath, id: bmpId, type: "image" });
                    assetsEvents.push(zipEntry.async("blob"));
                    bmpId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath.split(".").pop() === "ttf" || lcasePath.split(".").pop() === "otf")
                ) {
                    assetPaths.push({ url: relativePath, id: fntId, type: "font" });
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
                    var bmpEvents = [];
                    for (var index = 0; index < assets.length; index++) {
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
                            bmps.forEach(bmp => {
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
    var payload = {
        device: deviceData,
        paths: paths,
        brs: source,
        texts: txts,
        fonts: fonts,
        images: imgs,
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, imgs);
}

// Receive Screen and Registry data from Web Worker
function receiveMessage(event) {
    if (event.data instanceof ImageData) {
        buffer = event.data;
        bufferCanvas.width = buffer.width;
        bufferCanvas.height = buffer.height;
        bufferCtx.putImageData(buffer, 0, 0);
        statusResolution.innerText = `${buffer.width}x${buffer.height}`;
        statusIconRes.innerHTML = "<i class='fa fa-ruler-combined'></i>";
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
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
    running = false;
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

Mousetrap.bind(['command+c', 'ctrl+c'], function() {
    console.log("copied screenshot!");
    copyScreenshot();
    return false;
});

// Copy Screenshot to the Clipboard
function copyScreenshot() {
    display.toBlob(function(blob) { 
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]); 
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
function clientException(msg, msgbox = false) {
    console.error(msg);
    if (msgbox) {
        window.alert(msg);
    }
}
// Fix text color after focus change
titleBar.onBlur = titleBar.onFocus = function() {
    titleBar.titlebar.style.color = titleColor;
}

// Toggle Full Screen when Double Click
display.ondblclick = function() {    
    const toggle = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(toggle);
}

// Canvas Resizing with Window
window.onload = window.onresize = function()
{
    resizeWindow();
}

function resizeWindow() {
    let aspect = deviceData.displayMode == "480p" ? 4/3 : 16/9;
    if (mainWindow.isFullScreen()) {
        titleBar.titlebar.style.display = "none";
        titleBar.container.style.top = "0px";
        showStatusBar(false);
        screenSize.width = window.innerWidth;
        screenSize.height = parseInt(screenSize.width / aspect);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = parseInt(screenSize.height * aspect);
        }
    } else {
        var ratio = 0.97;
        var offset = 13;
        titleBar.titlebar.style.display = "";
        titleBar.container.style.top = "30px";
        if (appMenu.getMenuItemById("status-bar").checked) {
            showStatusBar(true);
            offset = 30;
        } else {
            showStatusBar(false);
        }
        screenSize.width = window.innerWidth * ratio;
        screenSize.height = parseInt(screenSize.width / aspect );
        if (screenSize.height > (window.innerHeight * ratio) - offset) {
            screenSize.height = (window.innerHeight * ratio) - offset;
            screenSize.width = parseInt(screenSize.height * aspect);
        }
    }
    display.width = screenSize.width;
    display.style.width = screenSize.width;
    display.height = screenSize.height;
    display.style.height = screenSize.height;
    if (running) {
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
    }    
}