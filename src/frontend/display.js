import { isStatusBarEnabled, showStatusBar, setDisplayStatus, setResStatus } from "./statusbar";

// Emulator Display
const mainWindow = remote.getCurrentWindow();
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
    setDisplayStatus(displayMode);
}
// Buffer Objects
const bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
const bufferCtx = bufferCanvas.getContext("2d");
let buffer = new ImageData(screenSize.width, screenSize.height);
console.log("Display module initialized!");

// Redraw Display Canvas
function redrawDisplay(overscanMode) {
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
        const ratio = 0.99;
        let offset = 13;
        titleBar.titlebar.style.display = "";
        titleBar.container.style.top = "30px";
        if (isStatusBarEnabled()) {
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
        drawBufferImage(overscanMode);
    }
}

export function drawSplashScreen(imgData) {
    display.style.opacity = 1;
    ctx.drawImage(imgData, 0, 0, screenSize.width, screenSize.height);
    buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height);
    bufferCanvas.width = buffer.width;
    bufferCanvas.height = buffer.height;
    bufferCtx.putImageData(buffer, 0, 0);
}
// Draw Buffer Image to the Display Canvas
export function drawBufferImage(overscanMode, buffer) {
    if (buffer) {
        if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
            setResStatus(`${buffer.width}x${buffer.height}`);
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
function changeDisplayMode(displayMode, overscanMode) {
    if (running) {
        closeChannel();
    }
    deviceData.displayMode = mode;
    deviceData.deviceModel = mode == "720p" ? "4200X" : mode == "1080p" ? "4640X" : "2720X";
    aspectRatio = deviceData.displayMode === "480p" ? 4 / 3 : 16 / 9;
    setDisplayStatus(displayMode);
    redrawDisplay(overscanMode);
}
