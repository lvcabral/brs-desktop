import { remote, ipcRenderer } from "electron";
import { drawSplashScreen, showDisplay, clearDisplay } from "./display";
import { clientLog, clientException } from "./console";
import { setChannelStatus, clearChannelStatus, setLocalIp } from "./statusbar";

import path from "path";
import JSZip from "jszip";
import fs from "fs";

const currentChannel = {id: "", file: "", title: "", version: ""};
let brsWorker;
let workerCallback;
let splashTimeout = 1600;
let source = [];
let paths = [];
let txts = [];
let imgs = [];
let fonts = [];
// Channel Data
export let running = false;
export let deviceData = remote.getGlobal("sharedObject").deviceInfo;
if (deviceData.localIps.length > 0) {
    setLocalIp(deviceData.localIps[0].split(",")[1]);
}
// Shared buffer (Keys and Sounds)
const length = 7;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
export const sharedArray = new Int32Array(sharedBuffer);
export const dataType = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
Object.freeze(dataType);
console.log("Loader module initialized!");
// Open File
export function loadFile(filePath, fileData) {
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
        clearDisplay();
        setChannelStatus("brs", currentChannel.file);
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
                        clearDisplay()
                        if (splash && splash.substr(0, 5) === "pkg:/") {
                            const splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then((blob) => {
                                    createImageBitmap(blob).then(drawSplashScreen);
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
                        setChannelStatus("zip", currentChannel.file, currentChannel.version);
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
    showDisplay()
    if (running || brsWorker != undefined) {
        brsWorker.terminate();
        sharedArray[dataType.KEY] = 0;
        sharedArray[dataType.SND] = -1;
        sharedArray[dataType.IDX] = -1;
        bufferCanvas.width = 1;
    }
    running = true;
    brsWorker = new Worker("lib/brsEmu.min.js");
    brsWorker.addEventListener("message", workerCallback);
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

// Set Worker Message Callback Function
export function setMessageCallback(callback) {
    workerCallback = callback;
}

// Restore emulator menu and terminate Worker
export function closeChannel(reason) {
    clientLog(`------ Finished '${currentChannel.title}' execution [${reason}] ------`);
    clearDisplay();
    if (titleBar) {
        titleBar.updateTitle(defaultTitle);
        clearChannelStatus();
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
