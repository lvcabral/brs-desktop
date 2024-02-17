/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Codec from "json-url";
import VanillaTerminal from "vanilla-terminal";
import { nanoid } from "../../node_modules/nanoid/index.browser";
import { CodeMirrorManager } from "./codemirror";
import packageInfo from "../../package.json";

const isMacOS = getOS() === "MacOS";
const codec = Codec("lzma");
const brsCodeField = document.getElementById("brsCode")
const saveButton = document.querySelector("button.save")
const deleteButton = document.querySelector("button.delete")
const runButton = document.querySelector("button.run")
const clearAllButton = document.querySelector("button.clear-all")
const breakButton = document.querySelector("button.break")
const endButton = document.querySelector("button.end")
const shareButton = document.querySelector("button.share")
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator")
const codeColumn = document.querySelector("div.code")
const consoleColumn = document.querySelector("div.console")
const rightContainer = document.getElementById("right-container")
const displayCanvas = document.getElementById("display")
const keyboardSwitch = document.getElementById("keyboard")
const gamePadSwitch = document.getElementById("gamepad")
const audioSwitch = document.getElementById("audioSwitch")
const audioIcon = document.getElementById("audio-icon")
const codeSelect = document.getElementById("code-selector")
const codeDialog = document.getElementById("code-dialog")
const codeForm = document.getElementById("code-form")
const deleteDialog = document.getElementById("delete-dialog")

const prompt = "Brightscript Debugger";
const appId = packageInfo.name;
const commands = {
    help: (terminal) => {
        brs.debug("help");
    },
    version: (terminal) => {
        terminal.output(`<br />BrightScript Simulation Engine v${brs.getVersion()}<br />`);
    },
};
const terminal = new VanillaTerminal({
    welcome: `<span style='color: #2e71ff'>BrightScript Console - ${packageInfo.name} v${
        packageInfo.version
    } -  brs-engine v${brs.getVersion()}</span>`,
    container: "console-logs",
    commands: commands,
    prompt: prompt,
    ignoreBadCommand: true,
    autoFocus: false,
});
terminal.idle();

// Buttons Events
saveButton.addEventListener("click", saveCode);
deleteButton.addEventListener("click", deleteCode);
runButton.addEventListener("click", runCode);
clearAllButton.addEventListener("click", clearTerminal);
breakButton.addEventListener("click", startDebug);
endButton.addEventListener("click", endExecution);
shareButton.addEventListener("click", shareCode);
layoutSeparator.addEventListener("mousedown", resizeColumn);

let currentApp = { id: "", running: false };
let consoleLogsContainer = document.getElementById("console-logs")
let isResizing = false;
let editorManager;
let currentId = nanoid(10);

function main() {
    if (saveButton) {
        saveButton.title = isMacOS ? "CMD+S" : "CTRL+S";
    }
    if (runButton) {
        runButton.title = isMacOS ? "CMD+R" : "CTRL+R";
    }
    if (clearAllButton) {
        clearAllButton.title = isMacOS ? "CMD+L" : "CTRL+L";
    }
    if (endButton) {
        endButton.title = isMacOS ? "CTRL+ESC" : "HOME";
    }
    if (breakButton) {
        breakButton.title = isMacOS ? "CTRL+C" : "CTRL+B";
    }
    // Initialize the Code Mirror manager
    if (brsCodeField) {
        editorManager = new CodeMirrorManager(brsCodeField);
        if (isMacOS) {
            // Remove binding for Ctrl+V on MacOS to allow remapping
            // https://github.com/codemirror/codemirror5/issues/5848
            const cm = document.querySelector(".CodeMirror");
            if (cm) delete cm.CodeMirror.constructor.keyMap.emacsy["Ctrl-V"];
        }
    }
    const { height } = codeColumn.getBoundingClientRect();
    editorManager.editor.setSize("100%", `${height}px`);
    // Check saved id to load
    const loadId = localStorage.getItem(`${appId}.load`);
    populateCodeSelector(loadId ?? "");
    if (loadId?.length) {
        loadCode(loadId);
    }
    localStorage.removeItem(`${appId}.load`);
    // Initialize Device Simulator
    if (displayCanvas) {
        brs.initialize(
            { developerId: appId },
            {
                debugToConsole: false,
                disableKeys: !keyboardSwitch.checked,
                disableGamePads: !gamePadSwitch.checked,
            }
        );
        // Subscribe to Engine Events
        brs.subscribe(appId, handleEngineEvents);
        // Resize the display canvas
        resizeCanvas();
        // Handle console commands
        terminal.onInput((command, parameters, handled) => {
            if (!handled) {
                brs.debug(`${command} ${parameters.join(" ")}`);
            }
        });
    }
}

function handleEngineEvents(event, data) {
    if (event === "loaded") {
        currentApp = data;
        terminal.output(`<br />Executing source code...<br /><br />`);
        terminal.idle();
    } else if (event === "started") {
        currentApp = data;
        console.info(`Execution started ${appId}`);
    } else if (event === "debug") {
        if (data.level === "stop") {
            terminal.output("<br />");
            terminal.setPrompt();
        } else if (data.level === "continue") {
            terminal.idle();
        } else if (data.level !== "beacon") {
            let output = data.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            if (data.level === "print") {
                const promptLen = `${prompt}&gt; `.length;
                if (output.slice(-promptLen) === `${prompt}&gt; `) {
                    output = output.slice(0, output.length - promptLen);
                }
            } else if (data.level === "warning") {
                output = "<span style='color: #d7ba7d;'>" + output + "</span>";
            } else if (data.level === "error") {
                output = "<span style='color: #e95449;'>" + output + "</span>";
            }
            terminal.output(`<pre>${output}</pre>`);
        }
        scrollToBottom();
    } else if (event === "closed" || event === "error") {
        currentApp = data;
        console.info(`Execution terminated! ${event}: ${data}`);
        terminal.idle();
    }
}

function scrollToBottom() {
    if (consoleLogsContainer.children.length) {
        const terminal = consoleLogsContainer.children[0];
        const scrollHeight = terminal.scrollHeight;
        terminal.scrollTo({
            top: scrollHeight,
            left: 0,
            behavior: "auto",
        });
    }
}

function populateCodeSelector(currentId) {
    var arrCode = new Array();
    for (var i = 0; i < localStorage.length; i++) {
        const codeId = localStorage.key(i);
        if (codeId && codeId.length === 10) {
            let idx = arrCode.length;
            arrCode.push([]);
            let codeName = `Code #${i + 1}`;
            const code = localStorage.getItem(codeId);
            if (code?.startsWith("@=")) {
                codeName = code.substring(2, code.indexOf("=@"));
            }
            arrCode[idx][0] = codeName;
            arrCode[idx][1] = codeId;
        }
    }
    arrCode.sort();

    codeSelect.length = 1;
    for (var i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + 1] = new Option(arrCode[i][0], codeId, false, selected);
    }

    deleteButton.style.visibility = currentId === "" ? "hidden" : "visible";
}

codeSelect.addEventListener("change", (e) => {
    if (codeSelect.value !== "0") {
        loadCode(codeSelect.value);
    } else {
        currentId = nanoid(10);
        resetApp();
    }
});

function loadCode(id) {
    let code = localStorage.getItem(id);
    if (code) {
        currentId = id;
        if (code.startsWith("@=")) {
            code = code.substring(code.indexOf("=@") + 2);
        }
        resetApp(id, code);
    } else {
        showToast("Could not find the code in the Local Storage!", 3000, true);
    }
}

function deleteCode() {
    if (currentId && localStorage.getItem(currentId)) {
        deleteDialog.showModal();
    } else {
        showToast("There is no Source Code to delete!", 3000, true);
    }
}

deleteDialog.addEventListener("close", (e) => {
    if (deleteDialog.returnValue === "ok") {
        localStorage.removeItem(currentId);
        currentId = nanoid(10);
        resetApp();
        showToast("Code deleted from your browser local storage!", 3000);
    }
    deleteDialog.returnValue = "";
});

function resetApp(id = "", code = "") {
    populateCodeSelector(id);
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
    const ctx = displayCanvas.getContext("2d", { alpha: false });
    ctx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    editorManager.editor.setValue(code);
    editorManager.editor.focus();
}

function shareCode() {
    let code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value !== "0") {
            let codeName = codeSelect.options[codeSelect.selectedIndex].text;
            code = `@=${codeName}=@${code}`;
        }
        const data = {
            id: currentId,
            code: code,
        };
        getShareUrl(data).then(function (shareLink) {
            navigator.clipboard.writeText(shareLink);
            showToast("Share URL copied to clipboard");
        });
    } else {
        showToast("There is no Source Code to share", 3000, true);
    }
}

function saveCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value === "0") {
            codeDialog.showModal();
        } else {
            const codeName = codeSelect.options[codeSelect.selectedIndex].text;
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            showToast(
                "Code saved in your browser local storage!\nTo share it use the Share button.",
                5000
            );
        }
    } else {
        showToast("There is no Source Code to save", 3000, true);
    }
}

codeDialog.addEventListener("close", (e) => {
    if (codeDialog.returnValue === "ok") {
        if (codeForm.codeName.value.trim().length >= 3) {
            const codeName = codeForm.codeName.value.trim();
            const code = editorManager.editor.getValue();
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            populateCodeSelector(currentId);
            showToast(
                "Code saved in your browser local storage!\nTo share it use the Share button.",
                5000
            );
        } else {
            showToast("Code Snippet Name must have least 3 characters!", 3000, true);
        }
    }
    codeDialog.returnValue = "";
    codeForm.codeName.value = "";
});

function runCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        try {
            brs.execute(appId, editorManager.editor.getValue(), {
                clearDisplayOnExit: false,
                debugOnCrash: true,
                muteSound: !audioSwitch.checked,
            });
              api.send("runCode", editorManager.editor.getValue());
        } catch (e) {
            console.log(e); // Check EvalError object
            terminal.output(`${e.name}: ${e.message}`);
            scrollToBottom();
        }
    } else {
        showToast("There is no Source Code to run", 3000, true);
    }
}

function startDebug() {
    if (currentApp.running) {
        brs.debug("break");
    } else {
        showToast("There is nothing running to debug", 3000, true);
    }
}

function endExecution() {
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
    } else {
        showToast("There is nothing running to terminate", 3000, true);
    }
}

function clearTerminal() {
    terminal.clear();
}

audioSwitch.addEventListener("click", (e) => {
    audioIcon.className = audioSwitch.checked ? "icon-sound-on" : "icon-sound-off";
    brs.setAudioMute(!audioSwitch.checked);
});

keyboardSwitch.addEventListener("click", controlModeSwitch);
gamePadSwitch.addEventListener("click", controlModeSwitch);

function controlModeSwitch() {
    brs.setControlMode({
        keyboard: keyboardSwitch.checked,
        gamePads: gamePadSwitch.checked,
    });
}

function hotKeys(event) {
    if (
        (isMacOS && event.code === "KeyR" && event.metaKey) ||
        (!isMacOS && event.code === "KeyR" && event.ctrlKey)
    ) {
        event.preventDefault();
        runCode();
    } else if (
        (isMacOS && event.code === "KeyS" && event.metaKey) ||
        (!isMacOS && event.code === "KeyS" && event.ctrlKey)
    ) {
        event.preventDefault();
        saveCode();
    } else if (
        (isMacOS && event.code === "KeyL" && event.metaKey) ||
        (!isMacOS && event.code === "KeyL" && event.ctrlKey)
    ) {
        event.preventDefault();
        clearTerminal();
    } else if (currentApp.running) {
        if (
            (isMacOS && event.code === "KeyC" && event.ctrlKey) ||
            (!isMacOS && event.code === "KeyB" && event.ctrlKey)
        ) {
            event.preventDefault();
            startDebug();
        } else if (
            (isMacOS && event.code === "Escape" && event.ctrlKey) ||
            (!isMacOS && event.code === "Home")
        ) {
            event.preventDefault();
            endExecution();
        }
    }
}

function resizeColumn() {
    isResizing = true;
}

function resizeCanvas() {
    const rightRect = rightContainer.getBoundingClientRect();
    brs.redraw(
        false,
        rightRect.width,
        Math.trunc(rightRect.height / 2) - 10,
        window.devicePixelRatio
    );
}

function onMouseMove(e) {
    if (!isResizing) {
        return;
    }
    e.preventDefault();
    if (layoutContainer && rightContainer && codeColumn && consoleColumn) {
        const { x, width } = layoutContainer.getBoundingClientRect();
        const separatorPosition = width - (e.clientX - x);
        const codeColumnWidth = `${width - separatorPosition}px`;

        const rightRect = rightContainer.getBoundingClientRect();
        if (width - separatorPosition >= 420 && separatorPosition >= 360) {
            codeColumn.style.width = codeColumnWidth;
            consoleColumn.style.width = rightRect.width.toString();
        }
    }
}

function onMouseUp() {
    resizeCanvas();
    isResizing = false;
}

function onMouseDown(event) {
    if (isResizing) {
        event.preventDefault();
    }
}

function onResize() {
  const { height } = codeColumn.getBoundingClientRect();
  editorManager.editor.setSize("100%", `${height}px`);
  console.log("Resized", height);
}

function getShareUrl(suite) {
    if (!suite) {
        return Promise.resolve(null);
    }
    //compress the object
    var data = [suite.id, suite.code];
    return codec.compress(data).then((text) => {
        return "https://brsfiddle.net?code=" + text;
    });
}

function showToast(message, duration = 3000, error = false) {
    Toastify({
        text: message,
        duration: duration,
        close: false,
        gravity: "bottom",
        position: "center",
        stopOnFocus: true,
        className: error ? "toastify-error" : "toastify-success",
    }).showToast();
}

function getOS() {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  let macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
  const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
  const iosPlatforms = ["iPhone", "iPad", "iPod"];
  let os = null;
  if (macosPlatforms.indexOf(platform) !== -1) {
      os = "MacOS";
  } else if (iosPlatforms.indexOf(platform) !== -1) {
      os = "iOS";
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
      os = "Windows";
  } else if (/Android/.test(userAgent)) {
      os = "Android";
  } else if (!os && /Linux/.test(platform)) {
      os = "Linux";
  }
  return os;
};

window.addEventListener("load", main, false);
window.addEventListener("resize", onResize, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
document.addEventListener("mousedown", onMouseDown, false);