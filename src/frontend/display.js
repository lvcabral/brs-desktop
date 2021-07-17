import { deviceData } from "./device";

// Emulator Display
const display = document.getElementById("display");
const ctx = display.getContext("2d", { alpha: false });
const screenSize = { width: 1280, height: 720 };
const bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
const bufferCtx = bufferCanvas.getContext("2d");
let aspectRatio = 16 / 9;
if (deviceData.displayMode === "1080p") {
    screenSize.width = 1920;
    screenSize.height = 1080;
} else if (deviceData.displayMode === "480p") {
    screenSize.width = 720;
    screenSize.height = 480;
    aspectRatio = 4 / 3;
}
export let overscanMode = "disabled";
let prefs = api.getPreferences();
if (prefs && prefs.display && prefs.display.overscan) {
    overscanMode = prefs.display.overscan;
}
// Observers Handling
const observers = new Map();
export function subscribeDisplay(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeDisplay(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach( (callback, id) => {
        callback(eventName, eventData);
    });
}
// Redraw Display Canvas
export function redrawDisplay(running, fullScreen) {
    notifyAll("redraw", fullScreen);
    api.titleBarRedraw(fullScreen);
    if (fullScreen) {
        screenSize.width = window.innerWidth;
        screenSize.height = parseInt(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = parseInt(screenSize.height * aspectRatio);
        }
    } else {
        const ratio = 0.98;
        let offset = 25;
        if (display.style.bottom !== "0px") { // TODO: Check if this is  effective
            offset = 30;
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
// Draw Channel Splash 
export function drawSplashScreen(imgData) {
    display.style.opacity = 1;
    ctx.drawImage(imgData, 0, 0, screenSize.width, screenSize.height);
    let buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height);
    bufferCanvas.width = buffer.width;
    bufferCanvas.height = buffer.height;
    bufferCtx.putImageData(buffer, 0, 0);
}
// Draw Buffer Image to the Display Canvas
export function drawBufferImage(buffer) {
    if (buffer) {
        if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
            notifyAll("resolution", {width: buffer.width, height: buffer.height});
            bufferCanvas.width = buffer.width;
            bufferCanvas.height = buffer.height;
        }
        bufferCtx.putImageData(buffer, 0, 0);
    }
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
    if (overscanMode === "guidelines") {
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

// Show Display and set focus
export function showDisplay() {
    bufferCanvas.width = 1;
    display.style.opacity = 1;
    display.focus();
}

//Clear Display
export function clearDisplay() {
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, display.width, display.height);
}

// Copy Screenshot to the Clipboard
export function copyScreenshot() {
    display.toBlob(function(blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([ item ]);
    });
}
// Set Display Mode
export function setDisplayMode(mode, save) {
    deviceData.displayMode = mode;
    aspectRatio = mode === "480p" ? 4 / 3 : 16 / 9;
    notifyAll("mode", mode);    
}
// Set Overscan Mode
export function setOverscanMode(mode) {
    overscanMode = mode;
}
