import { closeChannel, sharedArray, dataType, currentChannel } from "./loader";
import { playWav } from "./sound";

// Keyboard Mapping
const preventDefault = new Set(["Enter", "Space", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]);
const keys = new Map();
keys.set("Backspace", "back");
keys.set("Enter", "select");
keys.set("Escape", "home");
keys.set("Space", "play");
keys.set("ArrowLeft", "left");
keys.set("ArrowUp", "up")
keys.set("ArrowRight", "right");
keys.set("ArrowDown", "down");
keys.set("Slash", "instantreplay");
keys.set("NumpadMultiply", "info");
keys.set("Digit8", "info");
keys.set("Comma", "rev");
keys.set("Period", "fwd");
keys.set("KeyA", "a");
keys.set("KeyZ", "b");

// Keyboard handlers
document.addEventListener("keydown", function (event) {    
    handleKey(keys.get(event.code), 0);
    if (preventDefault.has(event.code)) {
        event.preventDefault();
    }
});
document.addEventListener("keyup", function keyUpHandler(event) {
    handleKey(keys.get(event.code), 100);
});

// Keyboard Handler
export function handleKey(key, mod) {
    if (key == "back") {
        sharedArray[dataType.KEY] = 0 + mod;
    } else if (key == "select") {
        sharedArray[dataType.KEY] = 6 + mod;
    } else if (key == "left") {
        sharedArray[dataType.KEY] = 4 + mod;
    } else if (key == "right") {
        sharedArray[dataType.KEY] = 5 + mod;
    } else if (key == "up") {
        sharedArray[dataType.KEY] = 2 + mod;
    } else if (key == "down") {
        sharedArray[dataType.KEY] = 3 + mod;
    } else if (key == "instantreplay") {
        sharedArray[dataType.KEY] = 7 + mod;
    } else if (key == "info") {
        sharedArray[dataType.KEY] = 10 + mod;
    } else if (key == "rev") {
        sharedArray[dataType.KEY] = 8 + mod;
    } else if (key == "play") {
        sharedArray[dataType.KEY] = 13 + mod;
    } else if (key == "fwd") {
        sharedArray[dataType.KEY] = 9 + mod;
    } else if (key == "a") {
        sharedArray[dataType.KEY] = 17 + mod;
    } else if (key == "b") {
        sharedArray[dataType.KEY] = 18 + mod;
    } else if (key == "home" && mod === 0) {
        if (currentChannel.running) {
            closeChannel("Home Button");
            playWav(0);
        }
    }
}
