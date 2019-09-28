/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./stylesheets/main.css";
import fs from "fs";
import path from  "path";
import Mousetrap  from "mousetrap";
import { remote, ipcRenderer } from "electron";

const appMenu = remote.Menu.getApplicationMenu();
const customTitlebar = require('custom-electron-titlebar');
const titleBarConfig = {
    backgroundColor: customTitlebar.Color.fromHex('#3C3C3C'),    
    icon: "./images/icon512x512.png",
    shadow: true
};
var titleBar = new customTitlebar.Titlebar(titleBarConfig);
var defaultTitle = document.title;
// Emulator code
import JSZip from "jszip";
var display = document.getElementById("display");
var screenSize = { width: 854, height: 480 };
var ctx = display.getContext("2d", { alpha: false });
// Browser Objects
var fileButton = document.getElementById("fileButton");
var channelInfo = document.getElementById("channelInfo");
var channel1 = document.getElementById("channel1");
var channel2 = document.getElementById("channel2");
var channel3 = document.getElementById("channel3");
// Status Bar Objects
var status = document.getElementById("status");
var statusFile = document.getElementById("statusFile");
var statusVersion = document.getElementById("statusVersion");
var statusSep1 = document.getElementById("statusSep1");
var statusDisplay = document.getElementById("statusDisplay");
var statusSep2 = document.getElementById("statusSep2");
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
    displayMode: "720p", // Only this mode is supported for now
    defaultFont: "Asap", // Options: "Asap", "Roboto" or "Open Sans"
};

if (status) {
    statusDisplay.innerText = `Display Mode: ${deviceData.displayMode}`;
}

// Load Registry
const storage = window.localStorage;
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, developerId.length) === developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}

// File selector
var fileSelector = document.getElementById("file");

if (fileSelector) {
    fileButton.onclick = function() {
        fileSelector.click();
    }

    fileSelector.onclick = function() {
        this.value = null;
    };

    fileSelector.onchange = function() {
        loadFile(this.files[0].name, this.files[0]);
    };
} else if (ipcRenderer) {
    ipcRenderer.on('fileSelected', function (event,file) {
        statusFile.innerText = file[0];
        var fileName = path.parse(file[0]).base;
        if (fileName.split(".").pop() === "zip") { 
            loadFile(fileName, fs.readFileSync(file[0]));
        } else {
            loadFile(fileName, new Blob([fs.readFileSync(file[0])], {type: "text/plain"}));
        }
    });    
    ipcRenderer.on('saveScreenshot', function (event, file) {
        var img = display.toDataURL('image/png');
        var data = img.replace(/^data:image\/\w+;base64,/, "");
        var buf = new Buffer(data, 'base64');
        fs.writeFileSync(file, buf);
    });    
    ipcRenderer.on('toggleStatusBar', function (event) {
        var enable = status.style.visibility!=="visible";
        appMenu.getMenuItemById("status-bar").checked = enable;
        resizeWindow();
    });
    ipcRenderer.on('copyScreenshot', function (event) {
        copyScreenshot();
    });
}

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

// Download Zip
function loadZip(zip) {
    if (running) {
        return;
    }
    running = true;
    display.style.opacity = 0;
    channelIcons("visible");
    fileSelector.value = null;
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    fetch(zip).then(function(response) {
        if (response.status === 200 || response.status === 0) {
            console.log("Loading " + zip + "...");
            openChannelZip(response.blob());
            display.focus();
        } else {
            running = false;
            return Promise.reject(new Error(response.statusText));
        }
    });
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
                        var splash = manifestMap.get("splash_screen_hd");
                        if (!splash) {
                            splash = manifestMap.get("splash_screen_fhd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_shd");
                            }
                        }
                        ctx.fillStyle = "rgba(0, 0, 0, 1)";
                        ctx.fillRect(0, 0, display.width, display.height);
                        if (splash && splash.substr(0, 5) === "pkg:/") {
                            var splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then(blob => {
                                    createImageBitmap(blob).then(imgData => {
                                        channelIcons("hidden");
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
                                        bufferCanvas.height = buffer.width;
                                        bufferCtx.putImageData(buffer, 0, 0);                                
                                    });
                                });
                            }
                        }
                        if (fileButton) {
                            fileButton.style.visibility = "hidden";
                        }
                        var channelData = "";
                        if (channelInfo) {
                            var title = manifestMap.get("title");
                            if (title) {
                                channelData += title + "<br/>";
                            } else {
                                channelData += "<br/>";
                            }
                            var subtitle = manifestMap.get("subtitle");
                            if (subtitle) {
                                channelData += subtitle + "<br/>";
                            } else {
                                channelData += "<br/>";
                            }
                            var majorVersion = manifestMap.get("major_version");
                            if (majorVersion) {
                                channelData += "v" + majorVersion;
                            }
                            var minorVersion = manifestMap.get("minor_version");
                            if (minorVersion) {
                                channelData += "." + minorVersion;
                            }
                            var buildVersion = manifestMap.get("build_version");
                            if (buildVersion) {
                                channelData += "." + buildVersion;
                            }
                            channelInfo.innerHTML = channelData;    
                        } else if (titleBar) {
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
                            statusSep1.innerText = "●";
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
                clientException("Invalid Roku package: missing manifest.", true);
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
    channelIcons("hidden");
    display.style.opacity = 1;
    display.focus();
    brsWorker = new Worker("brsEmu.min.js");
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
        statusResolution.innerText = `Resolution: ${buffer.width}x${buffer.height}`;
        statusSep2.innerText = "●";
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
    if (fileSelector) {
        channelInfo.innerHTML = "<br><br><br>";
        fileSelector.value = null;
        fileButton.style.visibility = "visible";
    } else if (titleBar) {
        titleBar.updateTitle(defaultTitle);
        statusFile.innerText = "";
        statusSep1.innerText = "";
        statusVersion.innerText = "";
        statusSep2.innerText = "";
        statusResolution.innerText = "";
    }
    channelIcons("visible");
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

// Channel icons Visibility
function channelIcons(visibility) {
    if (channel3) {
        channel1.style.visibility = visibility;
        channel2.style.visibility = visibility;
        channel3.style.visibility = visibility;
    }
}

// Exception Handler
function clientException(msg, msgbox = false) {
    console.error(msg);
    if (msgbox) {
        window.alert(msg);
    }
}

// Canvas Resizing with Window
window.onload = window.onresize = function()
{
    resizeWindow();
}

function resizeWindow() {
    if (remote.getCurrentWindow().isFullScreen()) {
        if (titleBar) {
            titleBar.dispose();
            titleBar = undefined;
        };
        showStatusBar(false);
        screenSize.width = window.innerWidth;
        screenSize.height = parseInt(screenSize.width * 9 / 16);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = parseInt(screenSize.height * 16/9);
        }
    } else {
        var ratio = 0.97;
        var offset = 13;
        if (titleBar == undefined) {
            titleBar = new customTitlebar.Titlebar(titleBarConfig);
        }
        if (appMenu.getMenuItemById("status-bar").checked) {
            showStatusBar(true);
            offset = 30;
        } else {
            showStatusBar(false);
        }
        screenSize.width = window.innerWidth * ratio;
        screenSize.height = parseInt(screenSize.width * 9 / 16);
        if (screenSize.height > (window.innerHeight * ratio) - offset) {
            screenSize.height = (window.innerHeight * ratio) - offset;
            screenSize.width = parseInt(screenSize.height * 16/9);
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