import { closeChannel, sharedArray, dataType, currentChannel } from "./loader";
import { playWav } from "./sound";

// Keyboard Mapping
const preventDefault = new Set([13, 32, 37, 38, 39, 40]);
const keys = new Map();
keys.set(8, "back");
keys.set(13, "select");
keys.set(27, "home");
keys.set(32, "play");
keys.set(37, "left");
keys.set(38, "up")
keys.set(39, "right");
keys.set(40, "down");
keys.set(111, "instantreplay");
keys.set(106, "info");
keys.set(188, "rev");
keys.set(190, "fwd");
keys.set(65, "a");
keys.set(90, "b");

// Keyboard handlers
document.addEventListener("keydown", function (event) {
    handleKey(keys.get(event.keyCode), 0);
    if (preventDefault.has(event.keyCode)) {
        event.preventDefault();
    }
    // TODO: Send TimeSinceLastKeypress()
});
document.addEventListener("keyup", function keyUpHandler(event) {
    handleKey(keys.get(event.keyCode), 100);
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
