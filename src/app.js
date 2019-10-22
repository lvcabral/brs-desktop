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
import { Howl } from "howler";
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
const statusBar = document.getElementById("status");
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
    defaultFont: "Asap", // Desktop app only has Asap to reduce the package size
    maxSimulStreams: 2
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
// Sound Objects
let soundsIdx = new Map();
let soundsDat = new Array();
let wavStreams = new Array(deviceData.maxSimulStreams);
let playList = new Array();
let playIndex = 0;
resetSounds();
// Shared buffer (Keys and Sounds)
const KEY = 0;
const WAV = 2;
const length = 10;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);
// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
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
    setupMenuSwitches(true);
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
    const enable = statusBar.style.visibility !== "visible";
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
            let audId = 0;
            zip.forEach(function(relativePath, zipEntry) {
                const lcasePath = relativePath.toLowerCase();
                const ext = lcasePath.split(".").pop();
                if (!zipEntry.dir && lcasePath.substr(0, 6) === "source" && ext === "brs") {
                    assetPaths.push({ url: relativePath, id: srcId, type: "source" });
                    assetsEvents.push(zipEntry.async("string"));
                    srcId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath === "manifest" || ext === "csv" || ext === "xml" || ext === "json")
                ) {
                    assetPaths.push({ url: relativePath, id: txtId, type: "text" });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
                } else if (
                    !zipEntry.dir &&
                    (ext === "png" || ext === "gif" || ext === "jpg" || ext === "jpeg")
                ) {
                    assetPaths.push({ url: relativePath, id: bmpId, type: "image" });
                    assetsEvents.push(zipEntry.async("blob"));
                    bmpId++;
                } else if (!zipEntry.dir && (ext === "ttf" || ext === "otf")) {
                    assetPaths.push({ url: relativePath, id: fntId, type: "font" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    fntId++;
                } else if (
                    !zipEntry.dir &&
                    (ext === "wav" || ext === "mp3" || ext === "m4a" || ext === "flac")
                ) {
                    assetPaths.push({ url: relativePath, id: audId, type: "audio", format: ext });
                    assetsEvents.push(zipEntry.async("blob"));
                    audId++;
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
                        } else if (assetPaths[index].type === "audio") {
                            soundsIdx.set(
                                `pkg:/${assetPaths[index].url.toLowerCase()}`,
                                soundsDat.length
                            );
                            soundsDat.push(
                                new Howl({
                                    src: [window.URL.createObjectURL(assets[index])],
                                    format: assetPaths[index].format,
                                })
                            );
                        } else if (assetPaths[index].type === "text") {
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
    } else if (event.data instanceof Array) {
        if (playList.length > 0) {
            stopSound();
        }
        playList = event.data;
        playIndex = 0;
    } else if (event.data === "play") {
        playSound();
    } else if (event.data === "stop") {
        stopSound();
    } else if (event.data === "pause") {
        const audio = playList[playIndex];
        if (audio && soundsIdx.has(audio.toLowerCase())) {
            const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
            sound.pause();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data === "resume") {
        const audio = playList[playIndex];
        if (audio && soundsIdx.has(audio.toLowerCase())) {
            const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
            sound.play();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data.substr(0, 4) === "loop") {
        const audio = playList[playIndex];
        const loop = event.data.split(",")[1];
        if (loop) {
            if (audio && soundsIdx.has(audio.toLowerCase())) {
                const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
                sound.loop(loop === "true"); // TODO: Handle playlist scenario
            } else {
                console.log("Can't find audio data:", audio);
            }
        } else {
            console.log("Invalid seek position:", event.data);
        }
    } else if (event.data.substr(0, 4) === "seek") {
        const audio = playList[playIndex];
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            if (audio && soundsIdx.has(audio.toLowerCase())) {
                const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
                sound.seek(parseInt(position));
            } else {
                console.log("Can't find audio data:", audio);
            }
        } else {
            console.log("Invalid seek position:", event.data);
        }
    } else if (event.data.substr(0, 7) === "trigger") {
        const wav = event.data.split(",")[1];
        if (wav && soundsIdx.has(wav.toLowerCase())) {
            const soundId = soundsIdx.get(wav.toLowerCase());
            const sound = soundsDat[soundId];
            const volume = parseInt(event.data.split(",")[2]) / 100;
            const index = parseInt(event.data.split(",")[3]);
            if (volume && !isNaN(volume)) {
                sound.volume(volume);
            }
            if (index >= 0 && index < deviceData.maxSimulStreams) {
                if (wavStreams[index] && wavStreams[index].playing()) {
                    wavStreams[index].stop();
                }
                wavStreams[index] = sound;
                sound.on("end", function() {
                    sharedArray[WAV + index] = -1;
                });
                sound.play();
                sharedArray[WAV + index] = soundId;
            }
        }
    } else if (event.data.substr(0, 5) === "stop,") {
        const wav = event.data.split(",")[1];
        if (wav && soundsIdx.has(wav.toLowerCase())) {
            const soundId = soundsIdx.get(wav.toLowerCase());
            const sound = soundsDat[soundId];
            for (let index = 0; index < deviceData.maxSimulStreams; index++) {
                if (sharedArray[WAV + index] === soundId) {
                    sharedArray[WAV + index] = -1;
                    break;
                }
            }
            sound.stop();
        } else {
            console.log("Can't find wav sound:", wav);
        }
    } else if (event.data == "end") {
        closeChannel();
    }
}
// Sound Functions
function playSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.volume(1);
        sound.seek(0);
        sound.on("end", nextSound());
        sound.play();
    } else {
        console.log("Can't find audio data:", audio);
    }
}

function nextSound() {
    playIndex++;
    if (playIndex < playList.length) {
        playSound();
    } else {
        // TODO: Check what actually happens to playIndex if loop is disabled
        // TODO: Handle loop
        playIndex = 0;
    }
}

function stopSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.stop();
    } else {
        console.log("Can't find audio data:", audio);
    }
}

function resetSounds() {
    if (soundsDat.length > 0) {
        soundsDat.forEach(sound => {
            sound.unload();
        });
    }
    soundsIdx = new Map();
    soundsDat = new Array();
    wavStreams = new Array(deviceData.maxSimulStreams);
    soundsIdx.set("select", 0);
    soundsDat.push(new Howl({ src: ["./audio/select.wav"] }));
    soundsIdx.set("navsingle", 1);
    soundsDat.push(new Howl({ src: ["./audio/navsingle.wav"] }));
    soundsIdx.set("navmulti", 2);
    soundsDat.push(new Howl({ src: ["./audio/navmulti.wav"] }));
    soundsIdx.set("deadend", 3);
    soundsDat.push(new Howl({ src: ["./audio/deadend.wav"] }));
    playList = new Array();
    playIndex = 0;
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
    sharedArray[KEY] = 0;
    resetSounds();
    bufferCanvas.width = 1;
    running = false;
    appMenu.getMenuItemById("close-channel").enabled = false;
}
// Remote control emulator
function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[KEY] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[KEY] = 6; // BUTTON_SELECT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 37) {
        sharedArray[KEY] = 4; // BUTTON_LEFT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 39) {
        sharedArray[KEY] = 5; // BUTTON_RIGHT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 38) {
        sharedArray[KEY] = 2; // BUTTON_UP_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 40) {
        sharedArray[KEY] = 3; // BUTTON_DOWN_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 111) {
        sharedArray[KEY] = 7; // BUTTON_INSTANT_REPLAY_PRESSED
    } else if (event.keyCode == 106) {
        sharedArray[KEY] = 10; // BUTTON_INFO_PRESSED
    } else if (event.keyCode == 188) {
        sharedArray[KEY] = 8; // BUTTON_REWIND_PRESSED
    } else if (event.keyCode == 32) {
        sharedArray[KEY] = 13; // BUTTON_PLAY_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 190) {
        sharedArray[KEY] = 9; // BUTTON_FAST_FORWARD_PRESSED
    } else if (event.keyCode == 65) {
        sharedArray[KEY] = 17; // BUTTON_A_PRESSED
    } else if (event.keyCode == 90) {
        sharedArray[KEY] = 18; // BUTTON_B_PRESSED
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
        sharedArray[KEY] = 100; // BUTTON_BACK_RELEASED
    } else if (event.keyCode == 13) {
        sharedArray[KEY] = 106; // BUTTON_SELECT_RELEASED
    } else if (event.keyCode == 37) {
        sharedArray[KEY] = 104; // BUTTON_LEFT_RELEASED
    } else if (event.keyCode == 39) {
        sharedArray[KEY] = 105; // BUTTON_RIGHT_RELEASED
    } else if (event.keyCode == 38) {
        sharedArray[KEY] = 102; // BUTTON_UP_RELEASED
    } else if (event.keyCode == 40) {
        sharedArray[KEY] = 103; // BUTTON_DOWN_RELEASED
    } else if (event.keyCode == 111) {
        sharedArray[KEY] = 107; // BUTTON_INSTANT_REPLAY_RELEASED
    } else if (event.keyCode == 106) {
        sharedArray[KEY] = 110; // BUTTON_INFO_RELEASED
    } else if (event.keyCode == 188) {
        sharedArray[KEY] = 108; // BUTTON_REWIND_RELEASED
    } else if (event.keyCode == 32) {
        sharedArray[KEY] = 113; // BUTTON_PLAY_RELEASED
    } else if (event.keyCode == 190) {
        sharedArray[KEY] = 109; // BUTTON_FAST_FORWARD_RELEASED
    } else if (event.keyCode == 65) {
        sharedArray[KEY] = 117; // BUTTON_A_RELEASED
    } else if (event.keyCode == 90) {
        sharedArray[KEY] = 118; // BUTTON_B_RELEASED
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
        statusBar.style.visibility = "visible";
    } else {
        display.style.bottom = "0px";
        statusBar.style.visibility = "hidden";
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
    if (statusBar) {
        let ui = deviceData.displayMode == "720p" ? "HD" : deviceData.displayMode == "1080p" ? "FHD" : "SD";
        statusDisplay.innerText = `${ui} (${deviceData.displayMode})`;
    }
}
// Configure Menu Options
function setupMenuSwitches(status = false) {
    appMenu = remote.Menu.getApplicationMenu();
    appMenu.getMenuItemById("close-channel").enabled = running;
    appMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    appMenu.getMenuItemById(`device-${displayMode}`).checked = true;
    appMenu.getMenuItemById(`overscan-${overscanMode}`).checked = true;
    if (status) {
        appMenu.getMenuItemById("status-bar").checked = statusBar.style.visibility === "visible";
    }
}
