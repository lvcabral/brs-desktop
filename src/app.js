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
import fs from "fs";
import path from "path";
import Mousetrap from "mousetrap";
import * as customTitlebar from "custom-electron-titlebar";
import { remote, ipcRenderer, shell } from "electron";
import { Howl } from "howler";
import JSZip from "jszip";
// App menu and theme configuration
const mainWindow = remote.getCurrentWindow();
const colorValues = getComputedStyle(document.documentElement);
const storage = window.localStorage;
const currentChannel = {id: "", file: "", title: "", version: ""};
let appMenu = remote.Menu.getApplicationMenu();
let userTheme = storage.getItem("userTheme") || "purple";
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
const titleBar = new customTitlebar.Titlebar(titleBarConfig);
titleBar.titlebar.style.color = titleColor;
const defaultTitle = document.title;
// Status Bar Objects
const statusBar = document.getElementById("status");
const statusDevTools = document.getElementById("statusDevTools");
const statusError = document.getElementById("statusError");
const statusWarn = document.getElementById("statusWarn");
const statusIconFile = document.getElementById("statusIconFile");
const statusFile = document.getElementById("statusFile");
const statusIconVersion = document.getElementById("statusIconVersion");
const statusVersion = document.getElementById("statusVersion");
const statusDisplay = document.getElementById("statusDisplay");
const statusSepRes = document.getElementById("statusSepRes");
const statusIconRes = document.getElementById("statusIconRes");
const statusResolution = document.getElementById("statusResolution");
const statusECP = document.getElementById("statusECP");
const statusECPText = document.getElementById("statusECPText");
const statusTelnet = document.getElementById("statusTelnet");
const statusTelnetText = document.getElementById("statusTelnetText");
const statusWeb = document.getElementById("statusWeb");
const statusWebText = document.getElementById("statusWebText");
statusResolution.style.display = "none";
statusIconRes.style.display = "none";
statusSepRes.style.display = "none";
let errorCount = 0;
let warnCount = 0;
statusError.innerText = errorCount.toString();
statusWarn.innerText = warnCount.toString();
if (appMenu.getMenuItemById("status-bar").checked) {
    statusBar.style.visibility = "visible";
} else {
    statusBar.style.visibility = "hidden";
}
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
let localIp = "127.0.0.1";
const deviceData = remote.getGlobal("sharedObject").deviceInfo;
Object.assign(deviceData, {registry: new Map()});
if (deviceData.localIps.length > 0) {
    localIp = deviceData.localIps[0].split(",")[1];
}
// ECP Server 
let ECPEnabled = storage.getItem("ECPEnabled") || "false";
let ECPPort = 8060;
ipcRenderer.send("ECPEnabled", ECPEnabled === "true");
updateECPOnStatus(ECPPort)
// Telnet Server
let telnetEnabled = storage.getItem("telnetEnabled") || "false";
ipcRenderer.send("telnetEnabled", telnetEnabled === "true");
updateTelnetOnStatus(8085)
// Web Installer Server 
let installerEnabled = storage.getItem("installerEnabled") || "false";
let installerPassword = storage.getItem("installerPassword") || "rokudev";
let installerPort = storage.getItem("installerPort") || "80";
ipcRenderer.send("installerEnabled", installerEnabled === "true", installerPassword, installerPort);
updateInstallerOnStatus(installerPort)
// Emulator Display
const display = document.getElementById("display");
const ctx = display.getContext("2d", { alpha: false });
const screenSize = { width: 1280, height: 720 };
let displayMode = storage.getItem("displayMode") || "720p";
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
let overscanMode = storage.getItem("overscanMode") || "disabled";
// Setup Menu
setupMenuSwitches();
// Sound Objects
const audioEvent = { SELECTED: 0, FULL: 1, PARTIAL: 2, PAUSED: 3, RESUMED: 4, FAILED: 5 };
Object.freeze(audioEvent);
let soundsIdx = new Map();
let soundsDat = new Array();
let wavStreams = new Array(deviceData.maxSimulStreams);
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
resetSounds();
// Shared buffer (Keys and Sounds)
const dataType = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
Object.freeze(dataType);
const length = 7;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);
// Status Bar Click Events
statusDevTools.onclick = function() {
    mainWindow.openDevTools();
};
statusECP.onclick = function() {
    shell.openExternal(`http://${localIp}:${ECPPort}/query/device-info`);
};
statusWeb.onclick = function() {
    shell.openExternal(`http://${localIp}:${installerPort}/`);
};
// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
// Load Registry
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
ipcRenderer.on("copyScreenshot", function(event) {
    copyScreenshot();
});
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
    setStatusColors();
    storage.setItem("userTheme", theme);
});
ipcRenderer.on("setDisplay", function(event, mode) {
    if (mode !== deviceData.displayMode) {
        displayMode = mode;
        changeDisplayMode(mode);
        storage.setItem("displayMode", mode);
    }
});
ipcRenderer.on("setOverscan", function(event, mode) {
    overscanMode = mode;
    storage.setItem("overscanMode", mode);
    redrawDisplay();
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
    const enable = statusBar.style.visibility !== "visible";
    appMenu.getMenuItemById("status-bar").checked = enable;
    redrawDisplay();
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
    updateECPOnStatus(port);
    ECPPort = port;
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
    updateTelnetOnStatus(port);
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
    updateInstallerOnStatus(port);
    installerPort = port;
});
ipcRenderer.on("console", function(event, text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
ipcRenderer.on("fileSelected", function(event, file) {
    errorCount = 0;
    warnCount = 0;
    setStatusColors();
    statusError.innerText = errorCount.toString();
    statusWarn.innerText = warnCount.toString();
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
// Open File
function loadFile(filePath, fileData) {
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    const reader = new FileReader();
    reader.onload = function(progressEvent) {
        currentChannel.title = fileName;
        paths = [];
        imgs = [];
        txts = [];
        fonts = [];
        source.push(this.result);
        paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        statusIconFile.innerHTML = "<i class='far fa-file'></i>";
        statusFile.innerText = currentChannel.file;
        ipcRenderer.send("addRecentSource", currentChannel.file);
        runChannel();
    };
    source = [];
    currentChannel.id = filePath.hashCode();
    currentChannel.file = filePath;
    if (brsWorker != undefined) {
        brsWorker.terminate();
        sharedArray[dataType.KEY] = 0;
        sharedArray[dataType.SND] = -1;
        sharedArray[dataType.IDX] = -1;
        resetSounds();
        bufferCanvas.width = 1;
    }
    clientLog(`Loading ${fileName}...`);    
    if (fileExt === ".zip") {
        openChannelZip(fileData);
    } else {
        reader.readAsText(fileData);
    }   
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
                        let icon;
                        icon = manifestMap.get("mm_icon_focus_hd");
                        if (!icon) {
                            icon = manifestMap.get("mm_icon_focus_fhd");
                            if (!icon) {
                                icon = manifestMap.get("mm_icon_focus_sd");
                            }
                        }
                        if (icon && icon.substr(0, 5) === "pkg:/") {
                            const iconFile = zip.file(icon.substr(5));
                            if (iconFile) {
                                iconFile.async("nodebuffer").then((content) => {
                                    const iconPath = path.join(
                                        remote.app.getPath("userData"), 
                                        currentChannel.id + ".png"
                                    );
                                    fs.writeFileSync(iconPath, content);
                                });
                            }
                        }
                        statusIconFile.innerHTML = "<i class='fa fa-cube'></i>";
                        statusFile.innerText = currentChannel.file;
                        if (titleBar) {
                            const title = manifestMap.get("title");
                            if (title) {
                                titleBar.updateTitle(defaultTitle + " - " + title);
                                currentChannel.title = title;
                            } else {
                                titleBar.updateTitle(defaultTitle);
                                currentChannel.title = "No Title";
                            }
                            currentChannel.version = "";
                            const majorVersion = manifestMap.get("major_version");
                            if (majorVersion) {
                                currentChannel.version += "v" + majorVersion;
                            }
                            const minorVersion = manifestMap.get("minor_version");
                            if (minorVersion) {
                                currentChannel.version += "." + minorVersion;
                            }
                            const buildVersion = manifestMap.get("build_version");
                            if (buildVersion) {
                                currentChannel.version += "." + buildVersion;
                            }
                            statusIconVersion.innerHTML = "<i class='fa fa-tag'></i>";
                            statusVersion.innerText = currentChannel.version;
                        }
                    },
                    function error(e) {
                        clientException(`Error uncompressing manifest: ${e.message}`);
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
                    (ext === "png" || ext === "gif" || ext === "jpg" || ext === "jpeg" || ext === "bmp")
                ) {
                    assetPaths.push({ url: relativePath, id: bmpId, type: "image" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    bmpId++;
                } else if (!zipEntry.dir && (ext === "ttf" || ext === "otf")) {
                    assetPaths.push({ url: relativePath, id: fntId, type: "font" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    fntId++;
                } else if (
                    !zipEntry.dir &&
                    (ext === "wav" ||
                        ext === "mp2" ||
                        ext === "mp3" ||
                        ext === "mp4" ||
                        ext === "m4a" ||
                        ext === "aac" ||
                        ext === "ogg" ||
                        ext === "oga" ||
                        ext === "ac3" ||
                        ext === "wma" ||
                        ext === "flac")
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
                    for (let index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "image") {
                            imgs.push(assets[index]);
                        } else if (assetPaths[index].type === "font") {
                            fonts.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else if (assetPaths[index].type === "audio") {
                            addSound(`pkg:/${assetPaths[index].url}`, assetPaths[index].format, assets[index]);
                        } else if (assetPaths[index].type === "text") {
                            txts.push(assets[index]);
                        }
                    }
                    setTimeout(function() {
                        runChannel();
                        ipcRenderer.send("addRecentPackage", currentChannel);
                    }, splashTimeout);
                },
                function error(e) {
                    clientException(`Error uncompressing file ${e.message}`);
                }
            );
        },
        function(e) {
            clientException(`Error reading ${f.name}: ${e.message}`, true);
            running = false;
        }
    );
}
// Execute Emulator Web Worker
function runChannel() {
    appMenu.getMenuItemById("close-channel").enabled = true;
    display.style.opacity = 1;
    display.focus();
    if (running || brsWorker != undefined) {
        brsWorker.terminate();
        sharedArray[dataType.KEY] = 0;
        sharedArray[dataType.SND] = -1;
        sharedArray[dataType.IDX] = -1;
        bufferCanvas.width = 1;
    }
    running = true;
    brsWorker = new Worker("lib/brsEmu.min.js");
    brsWorker.addEventListener("message", receiveMessage);
    const payload = {
        device: deviceData,
        title: currentChannel.title,
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
            statusResolution.style.display = "";
            statusIconRes.style.display = "";
            statusSepRes.style.display = "";
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
    } else if (event.data.audioPath) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (event.data instanceof Array) {
        if (playList.length > 0) {
            stopSound();
        }
        playList = event.data;
        playIndex = 0;
        playNext = -1;
    } else if (event.data === "play") {
        playSound();
    } else if (event.data === "stop") {
        stopSound();
    } else if (event.data === "pause") {
        const audio = playList[playIndex];
        if (audio && soundsIdx.has(audio.toLowerCase())) {
            const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
            sound.pause();
            sharedArray[dataType.SND] = audioEvent.PAUSED;
        } else {
            clientWarning(`[message:pause] Can't find audio data: ${playIndex} - ${audio}`);
        }
    } else if (event.data === "resume") {
        const audio = playList[playIndex];
        if (audio && soundsIdx.has(audio.toLowerCase())) {
            const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
            sound.play();
            sharedArray[dataType.SND] = audioEvent.RESUMED;
        } else {
            clientWarning(`[message:resume]Can't find audio data: ${playIndex} - ${audio}`);
        }
    } else if (event.data.substr(0, 4) === "loop") {
        const loop = event.data.split(",")[1];
        if (loop) {
            playLoop = loop === "true";
        } else {
            clientWarning(`Missing loop parameter: ${event.data}`);
        }
    } else if (event.data.substr(0, 4) === "next") {
        const newIndex = event.data.split(",")[1];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            playNext = parseInt(newIndex);
            if (playNext >= playList.length) {
                playNext = -1;
                clientWarning(`Next index out of range: ${newIndex}`);
            }
        } else {
            clientWarning(`Invalid next index: ${event.data}`);
        }
    } else if (event.data.substr(0, 4) === "seek") {
        const audio = playList[playIndex];
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            if (audio && soundsIdx.has(audio.toLowerCase())) {
                const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
                sound.seek(parseInt(position));
            } else {
                clientWarning(`[message:seek] Can't find audio data: ${playIndex} - ${audio}`);
            }
        } else {
            clientWarning(`Invalid seek position: ${event.data}`);
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
                    sharedArray[dataType.WAV + index] = -1;
                });
                sound.play();
                sharedArray[dataType.WAV + index] = soundId;
            }
        }
    } else if (event.data.substr(0, 5) === "stop,") {
        const wav = event.data.split(",")[1];
        if (wav && soundsIdx.has(wav.toLowerCase())) {
            const soundId = soundsIdx.get(wav.toLowerCase());
            const sound = soundsDat[soundId];
            for (let index = 0; index < deviceData.maxSimulStreams; index++) {
                if (sharedArray[dataType.WAV + index] === soundId) {
                    sharedArray[dataType.WAV + index] = -1;
                    break;
                }
            }
            sound.stop();
        } else {
            clientWarning(`Can't find wav sound: ${wav}`);
        }
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
}
// Sound Functions
function playSound() {
    const audio = playList[playIndex];
    if (audio) {
        let sound;
        if (soundsIdx.has(audio.toLowerCase())) {
            sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        } else if (audio.substr(0, 4).toLowerCase() === "http") {
            sound = addWebSound(audio);
        } else {
            clientWarning(`[playSound] Can't find audio data: ${audio}`);
            return;
        }
        sound.seek(0);
        sound.once("end", nextSound);
        if (sound.state() === "unloaded") {
            sound.once("load", function() {
                sound.play();
            });
            sound.load();
        } else {
            sound.play();
        }
        sharedArray[dataType.IDX] = playIndex;
        sharedArray[dataType.SND] = audioEvent.SELECTED;
    } else {
        clientWarning(`Can't find audio index: ${playIndex}`);
    }
}

function nextSound() {
    if (playNext >= 0 && playNext < playList.length) {
        playIndex = playNext;
    } else {
        playIndex++;
    }
    playNext = -1;
    if (playIndex < playList.length) {
        playSound();
    } else if (playLoop) {
        playIndex = 0;
        playSound();
    } else {
        playIndex = 0;
        sharedArray[dataType.SND] = audioEvent.FULL;
    }
}

function stopSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.stop();
        sharedArray[dataType.SND] = audioEvent.PARTIAL;
    } else {
        clientWarning(`[stopSound] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

function addSound(path, format, data) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    soundsDat.push(
        new Howl({
            src: [window.URL.createObjectURL(data)],
            format: format,
            preload: format === "wav",
            onloaderror: function(id, message) {
                clientWarning(
                    `Error loading ${path}: ${message}`
                );
            },
            onplayerror: function(id, message) {
                clientWarning(
                    `Error playing ${path}: ${message}`
                );
            },
        })
    );
}

function addWebSound(url) {
    // TODO: Fix the WAV index if a roAudioResource is created after this call
    soundsIdx.set(url.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url],
        preload: true,
        onloaderror: function(id, message) {
            clientWarning(
                `Error loading ${path}: ${message}`
            );
        },
        onplayerror: function(id, message) {
            clientWarning(
                `Error playing ${path}: ${message}`
            );
        },
    })
    soundsDat.push(sound);
    return sound;
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
    playLoop = false;
    playNext = -1;
}
// Restore emulator menu and terminate Worker
function closeChannel(reason) {
    clientLog(`------ Finished '${currentChannel.title}' execution [${reason}] ------`);
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, display.width, display.height);
    if (titleBar) {
        titleBar.updateTitle(defaultTitle);
        statusIconFile.innerText = "";
        statusFile.innerText = "";
        statusIconVersion.innerText = "";
        statusVersion.innerText = "";
        statusResolution.style.display = "none";
        statusIconRes.style.display = "none";
        statusSepRes.style.display = "none";
}
    brsWorker.terminate();
    sharedArray[dataType.KEY] = 0;
    sharedArray[dataType.SND] = -1;
    sharedArray[dataType.IDX] = -1;
    resetSounds();
    bufferCanvas.width = 1;
    running = false;
    appMenu.getMenuItemById("close-channel").enabled = false;
    currentChannel.id = "";
    currentChannel.file = "";
    currentChannel.title = "";
    currentChannel.version = "";
}
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
        if (brsWorker != undefined) {
            // HOME BUTTON (ESC)
            closeChannel("Home Button");
            soundsDat[0].play();
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
Mousetrap.bind([ "command+c", "ctrl+c" ], function() {
    copyScreenshot();
    return false;
});

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
        if (brsWorker != undefined) {        // HOME BUTTON (ESC)
            closeChannel("Home Button");
            soundsDat[0].play();
        }
    }
}
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
// Log to Telnet Server and Console
function clientLog(msg) {
    ipcRenderer.send("telnet", msg);
    console.log(msg);
}
function clientWarning(msg) {
    ipcRenderer.send("telnet", msg);
    console.warn(msg);
    warnCount++; 
    statusWarn.innerText = warnCount.toString();
    setStatusColors();
}
function clientException(msg) {
    ipcRenderer.send("telnet", msg);
    console.error(msg);
    errorCount++; 
    statusError.innerText = errorCount.toString();    
    setStatusColors();
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
        const ratio = 0.98;
        let offset = 25;
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
    deviceData.deviceModel = mode == "720p" ? "4200X" : mode == "1080p" ? "4640X" : "2720X";
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
// Set status bar colors
function setStatusColors() {
    if (errorCount > 0) {
        statusBar.className = "statusbarError";
        statusWeb.className = "statusIconsError";
        statusECP.className = "statusIconsError";
        statusDevTools.className = "statusIconsError";
    } else if (warnCount > 0) {
        statusBar.className = "statusbarWarn";
        statusWeb.className = "statusIconsWarn";
        statusECP.className = "statusIconsWarn";
        statusDevTools.className = "statusIconsWarn";
    } else {
        statusBar.className = "statusbar";
        statusWeb.className = "statusIcons";
        statusECP.className = "statusIcons";
        statusDevTools.className = "statusIcons";
    }
}
// Update ECP Server icon on Status Bar
function updateECPOnStatus(port) {
    if (ECPEnabled === "true") {
        statusECPText.innerText = port;
        statusECP.style.display = "";
    } else {
        statusECP.style.display = "none";
    }
}
// Update Telnet Server icon on Status Bar
function updateTelnetOnStatus(port) {
    if (telnetEnabled === "true") {
        statusTelnetText.innerText = port;
        statusTelnet.style.display = "";
    } else {
        statusTelnet.style.display = "none";
    }
}
// Update Web Installer Server icon on Status Bar
function updateInstallerOnStatus(port) {
    if (installerEnabled === "true") {
        statusWebText.innerText = port;
        statusWeb.style.display = "";
    } else {
        statusWeb.style.display = "none";
    }
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
    if (status) {
        appMenu.getMenuItemById("status-bar").checked = statusBar.style.visibility === "visible";
    }
}
