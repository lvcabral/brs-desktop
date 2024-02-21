/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Codec from "json-url";
import VanillaTerminal from "vanilla-terminal";
import { nanoid } from "nanoid";
import { CodeMirrorManager, getThemeCss } from "./codemirror";
import Toastify from "toastify-js";
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
const codeSelect = document.getElementById("code-selector")
const codeDialog = document.getElementById("code-dialog")
const codeForm = document.getElementById("code-form")
const deleteDialog = document.getElementById("delete-dialog")

const simulator = window.opener;
let [brs, currentApp, consoleBuffer, debugMode] = simulator.getEngineContext();

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
    welcome: `<span style='color: #2e71ff'>BrightScript Console - ${packageInfo.name} v${packageInfo.version
        } -  brs-engine v${brs.getVersion()}</span>`,
    container: "console-logs",
    commands: commands,
    prompt: prompt,
    ignoreBadCommand: true,
    autoFocus: false,
});
if (consoleBuffer?.length) {
    consoleBuffer.forEach((value) => {
        updateTerminal(value);
    });
}
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
        const preferences = api.getPreferences();
        const theme = preferences?.simulator?.theme || 'purple';
        editorManager = new CodeMirrorManager(brsCodeField, theme);
        if (isMacOS) {
            // Remove binding for Ctrl+V on MacOS to allow remapping
            // https://github.com/codemirror/codemirror5/issues/5848
            const cm = document.querySelector(".CodeMirror");
            if (cm) delete cm.CodeMirror.constructor.keyMap.emacsy["Ctrl-V"];
        }
    }
    onResize();
    populateCodeSelector();
    // Subscribe to Engine events and initialize Console
    if (brs) {
        // Subscribe to Engine Events
        brs.subscribe(appId, handleEngineEvents);
        // Handle console commands
        terminal.onInput((command, parameters, handled) => {
            if (!handled) {
                brs.debug(`${command} ${parameters.join(" ")}`);
            }
        });
        if (debugMode === "stop") {
            terminal.output("<br />");
            terminal.setPrompt();
        }
    }
}

function handleEngineEvents(event, data) {
    if (event === "loaded") {
        currentApp = data;
    } else if (event === "started") {
        currentApp = data;
        console.info(`Execution started ${appId}`);
    } else if (event === "debug") {
        if (data.level === "stop") {
            terminal.output("<br />");
            terminal.setPrompt();
        } else if (data.level === "continue") {
            terminal.output("<br />");
            terminal.idle();
        } else if (typeof data.content === "string") {
            updateTerminal(data.content, data.level);
        }
        scrollToBottom();
    } else if (event === "closed" || event === "error") {
        currentApp = data;
        console.info(`Execution terminated! ${event}: ${data}`);
        terminal.idle();
    }
}

function updateTerminal(text, level = "print") {
    let output = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (level === "print") {
        const promptLen = `${prompt}&gt; `.length;
        if (output.slice(-promptLen) === `${prompt}&gt; `) {
            output = output.slice(0, output.length - promptLen);
        }
    } else if (level === "warning") {
        output = "<span style='color: #d7ba7d;'>" + output + "</span>";
    } else if (level === "error") {
        output = "<span style='color: #e95449;'>" + output + "</span>";
    }
    terminal.output(`<pre>${output}</pre>`);
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

function populateCodeSelector(currentId = "") {
    var arrCode = new Array();
    for (var i = 0; i < localStorage.length; i++) {
        const codeId = localStorage.key(i);
        console.log(codeId, codeId.length);
        if (codeId && codeId.length === 10) {
            let idx = arrCode.length;
            arrCode.push([]);
            let codeName = `Code #${i + 1}`;
            const code = localStorage.getItem(codeId);
            console.log(code?.startsWith("@="));
            if (code?.startsWith("@=")) {
                codeName = code.substring(2, code.indexOf("=@"));
            }
            arrCode[idx][0] = codeName;
            arrCode[idx][1] = codeId;
        }
    }
    arrCode.sort();
    console.log(arrCode);
    codeSelect.length = 1;
    for (var i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + 1] = new Option(arrCode[i][0], codeId, false, selected);
        console.log(codeId, selected);
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
        showToast("Code deleted from the local storage!", 3000);
    }
    deleteDialog.returnValue = "";
});

function resetApp(id = "", code = "") {
    populateCodeSelector(id);
    if (currentApp.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
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
            showToast("brsFiddle.net share URL copied to clipboard");
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
                "Code saved in the simulator local storage!\nTo share it use the Share button.",
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

export function runCode() {
    const code = editorManager.editor.getValue();
    if (code && code.trim() !== "") {
        try {
            simulator.runCode(editorManager.editor.getValue());
            terminal.output(`<br /><pre>Executing source code...</pre><br /><br />`);
            terminal.idle();
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
    simulator.clearStatusCounters();
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

function onMouseMove(e) {
    if (!isResizing) {
        return;
    }
    e.preventDefault();
    if (layoutContainer && codeColumn && consoleColumn) {
        const { x, width } = layoutContainer.getBoundingClientRect();
        const separatorPosition = width - (e.clientX - x);
        const codeColumnWidth = `${width - separatorPosition}px`;

        const rightRect = consoleColumn.getBoundingClientRect();
        codeColumn.style.width = codeColumnWidth;
        consoleColumn.style.width = rightRect.width.toString();
    }
}

function onMouseUp() {
    if (isResizing) {
        scrollToBottom();
    }
    isResizing = false;
}

function onMouseDown(event) {
    if (isResizing) {
        event.preventDefault();
    }
}

function onResize() {
    if (window.innerWidth >= 1220) {
        const { height } = codeColumn.getBoundingClientRect();
        editorManager.editor.setSize("100%", `${height - 15}px`);
    } else {
        const { top } = consoleColumn.getBoundingClientRect();
        editorManager.editor.setSize("100%", `${Math.trunc(window.innerHeight - top - 15)}px`);
        codeColumn.style.width = "100%";
    }
    scrollToBottom();
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
    if (macosPlatforms.includes(platform)) {
        os = "MacOS";
    } else if (iosPlatforms.includes(platform)) {
        os = "iOS";
    } else if (windowsPlatforms.includes(platform)) {
        os = "Windows";
    } else if (/Android/.test(userAgent)) {
        os = "Android";
    } else if (!os && /Linux/.test(platform)) {
        os = "Linux";
    }
    return os;
};

// Theme Management
window.__currentTheme = () =>
    window.matchMedia('(prefers-color-scheme:dark)')?.matches
        ? 'dark'
        : 'light';
window.__setTheme = () => {
    const preferences = api.getPreferences();
    let theme = preferences.simulator.theme || 'purple';
    if (theme === 'system') {
        theme = __currentTheme();
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('close-button-dark').style.display = theme === 'light' ? 'none' : '';
    document.getElementById('close-button-light').style.display = theme === 'light' ? '' : 'none';
    layoutContainer.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    if (editorManager) {
        editorManager.editor.setOption("theme", getThemeCss(theme));
    }
};
window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', __setTheme);
api.onPreferencesUpdated(__setTheme);

document.addEventListener('DOMContentLoaded', (event) => {
    if (api.processPlatform() === 'darwin') {
        document.getElementById('window-controls').style.visibility = 'hidden';
    } else {
        document.getElementById('close-button').addEventListener('click', event => {
            api.closePreferences();
        });
    }
    __setTheme();
});

// Events Handling
window.addEventListener("load", main, false);
window.addEventListener("resize", onResize, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
document.addEventListener("mousedown", onMouseDown, false);
