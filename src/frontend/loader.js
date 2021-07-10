import { subscribeDisplay, drawBufferImage, drawSplashScreen, showDisplay, clearDisplay } from "./display";
import { initSoundModule, addSound, resetSounds, playSound, stopSound, 
         pauseSound, resumeSound, setLoop, setNext, triggerWav, stopWav, addPlaylist } from "./sound";
import { clientLog, clientWarning, clientException } from "./console";
import { deviceData } from "./device";
const storage = window.localStorage;
let brsWorker;
let splashTimeout = 1600;
let source = [];
let paths = [];
let txts = [];
let bins = [];
// Channel Data
export const currentChannel = {id: "", file: "", title: "", version: "", running: false};
// Shared buffer (Keys and Sounds)
const length = 7;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
export const sharedArray = new Int32Array(sharedBuffer);
export const dataType = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
Object.freeze(dataType);
// Initialize Sound Module
initSoundModule(sharedArray, dataType, deviceData.maxSimulStreams);
// Observers Handling
const observers = new Map();
export function subscribeLoader(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeLoader(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}
// Subscribe Events
subscribeDisplay("loader", (event, data) => {
    if (event === "mode") {
        if (currentChannel.running) {
            closeChannel("DisplayMode");
        }
    }
});

// Open File
export function loadFile(filePath, fileData) {
    const fileName = api.pathParse(filePath).base;
    const fileExt = api.pathParse(filePath).ext.toLowerCase();
    const reader = new FileReader();
    reader.onload = function(progressEvent) {
        currentChannel.id = "brs";
        currentChannel.title = fileName;
        paths = [];
        bins = [];
        txts = [];
        source.push(this.result);
        paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
        clearDisplay();
        notifyAll("loaded", currentChannel);
        runChannel();
    };
    source = [];
    currentChannel.id = filePath.hashCode();
    currentChannel.file = filePath;
    if (brsWorker != undefined) {
        brsWorker.terminate();
        sharedArray[dataType.KEY] = 0;
        sharedArray[dataType.MOD] = 0;
        sharedArray[dataType.SND] = -1;
        sharedArray[dataType.IDX] = -1;
        resetSounds();
    }
    clientLog(`Loading ${fileName}...`);    
    if (fileExt === ".zip") {
        openChannelZip(fileData);
    } else {
        reader.readAsText(new Blob([fileData], { type: "text/plain" }));
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
                                iconFile.async("base64").then((content) => {
                                    notifyAll("icon", content);
                                });
                            }
                        }
                        const title = manifestMap.get("title");
                        if (title) {
                            currentChannel.title = title;
                        } else {
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
                        notifyAll("loaded", currentChannel);
                    },
                    function error(e) {
                        clientException(`Error uncompressing manifest: ${e.message}`);
                        currentChannel.running = false;
                        return;
                    }
                );
            } else {
                clientException("Invalid Channel Package: missing manifest.");
                currentChannel.running = false;
                return;
            }
            let assetPaths = [];
            let assetsEvents = [];
            let binId = 0;
            let txtId = 0;
            let srcId = 0;
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
                    (lcasePath === "manifest" || ext === "csv" || ext === "xml" 
                        || ext === "json" || ext === "txt" || ext == "ts")
                ) {
                    assetPaths.push({ url: relativePath, id: txtId, type: "text" });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
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
                } else if ( !zipEntry.dir ) {
                    assetPaths.push({ url: relativePath, id: binId, type: "binary" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    binId++;
                }
            });
            Promise.all(assetsEvents).then(
                function success(assets) {
                    paths = [];
                    txts = [];
                    bins = [];
                    for (let index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "binary") {
                            bins.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else if (assetPaths[index].type === "audio") {
                            addSound(`pkg:/${assetPaths[index].url}`, assetPaths[index].format, assets[index]);
                        } else if (assetPaths[index].type === "text") {
                            txts.push(assets[index]);
                        }
                    }
                    setTimeout(runChannel, splashTimeout);
                },
                function error(e) {
                    clientException(`Error uncompressing file ${e.message}`);
                }
            );
        },
        function(e) {
            clientException(`Error reading ${f.name}: ${e.message}`, true);
            currentChannel.running = false;
        }
    );
}
// Execute Emulator Web Worker
function runChannel() {    
    showDisplay()
    if (currentChannel.running || brsWorker != undefined) {
        brsWorker.terminate();
        sharedArray[dataType.KEY] = 0;
        sharedArray[dataType.MOD] = 0;
        sharedArray[dataType.SND] = -1;
        sharedArray[dataType.IDX] = -1;
    }
    currentChannel.running = true;
    brsWorker = new Worker("../node_modules/brs-emu/app/lib/brsEmu.js");
    brsWorker.addEventListener("message", workerCallback);
    const payload = {
        device: deviceData,
        title: currentChannel.title,
        paths: paths,
        brs: source,
        texts: txts,
        binaries: bins
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, bins);
}

// Receive Messages from Web Worker
function workerCallback(event) {
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
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            seekSound(parseInt(position));
        } else {
            clientWarning(`Invalid seek position: ${event.data}`);
        }
    } else if (event.data.substr(0, 7) === "trigger") {
        const trigger = event.data.split(",");
        if (trigger.length >= 4) {
            triggerWav(trigger[1], parseInt(trigger[2]), parseInt(trigger[3]));
        } else {
            clientWarning(`Missing Trigger parameters: ${event.data}`);
        }
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
        notifyAll("reset");
    }
}

// Restore emulator menu and terminate Worker
export function closeChannel(reason) {
    clientLog(`------ Finished '${currentChannel.title}' execution [${reason}] ------`);
    clearDisplay();
    brsWorker.terminate();
    sharedArray[dataType.KEY] = 0;
    sharedArray[dataType.MOD] = 0;
    sharedArray[dataType.SND] = -1;
    sharedArray[dataType.IDX] = -1;
    resetSounds();
    currentChannel.id = "";
    currentChannel.file = "";
    currentChannel.title = "";
    currentChannel.version = "";
    currentChannel.running = false;
    notifyAll("closed", currentChannel);
}
