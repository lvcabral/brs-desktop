/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Codec from "json-url";
import WebTerminal from "@lvcabral/terminal";
import { nanoid } from "nanoid";
import { MonacoManager } from "./monaco";
import { EDITOR_CODE_BRS, BRS_HOME_APP_PATH } from "../constants";
import Toastify from "toastify-js";
import packageInfo from "../../package.json";

const isMacOS = api.processPlatform() === "darwin";
const codec = Codec("lzma");
const editorContainer = document.querySelector(".code");
const brsCodeField = document.getElementById("brsCode");
const saveButton = document.querySelector("button.save");
const runButton = document.querySelector("button.run");
const clearAllButton = document.querySelector("button.clear-all");
const breakButton = document.querySelector("button.break");
const resumeButton = document.querySelector("button.resume");
const endButton = document.querySelector("button.end");
const shareButton = document.querySelector("button.share");
const layoutContainer = document.querySelector("main.editor");
const layoutSeparator = document.querySelector("div.layout-separator");
const codeColumn = document.querySelector("div.code");
const consoleColumn = document.querySelector("div.console");
const codeSelect = document.getElementById("code-selector");
const codeDialog = document.getElementById("code-dialog");
const actionType = document.getElementById("actionType");
const codeForm = document.getElementById("code-form");
const confirmDialog = document.getElementById("confirm-dialog");
const dialogText = document.getElementById("dialog-text");
const confirmButton = document.getElementById("confirm-button");
const cancelButton = document.getElementById("cancel-button");
const moreButton = document.getElementById("more-options");
const dropdown = document.getElementById("more-options-dropdown");

const simulator = globalThis.opener;
const [brs, currentApp, consoleBuffer, debugMode] = simulator.getEngineContext();

let simulatorApp = { ...currentApp };
if (simulatorApp.path === BRS_HOME_APP_PATH) {
    simulatorApp.running = false;
}

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
const terminal = new WebTerminal({
    welcome: `<span style='color: #2e71ff'>BrightScript Console - ${packageInfo.name} v${
        packageInfo.version
    } -  brs-engine v${brs.getVersion()}</span>`,
    container: "console-logs",
    commands: commands,
    prompt: prompt,
    ignoreBadCommand: true,
    autoFocus: false,
});
if (consoleBuffer?.length) {
    for (const value of consoleBuffer) {
        updateTerminal(value);
    }
}
terminal.idle();

// Buttons Events
saveButton.addEventListener("click", saveCode);
runButton.addEventListener("click", runCode);
clearAllButton.addEventListener("click", clearTerminal);
breakButton.addEventListener("click", startDebug);
resumeButton.addEventListener("click", resumeExecution);
endButton.addEventListener("click", endExecution);
shareButton.addEventListener("click", shareCode);
layoutSeparator.addEventListener("mousedown", resizeColumn);
moreButton.addEventListener("click", function (event) {
    event.stopPropagation();
    if (dropdown.style.display === "block") {
        dropdown.style.display = "none";
    } else {
        dropdown.style.display = "block";
    }
});
document.addEventListener("click", function (event) {
    if (!dropdown.contains(event.target) && event.target !== moreButton) {
        dropdown.style.display = "none";
    }
});
document.getElementById("rename-option").addEventListener("click", renameCode);
document.getElementById("saveas-option").addEventListener("click", saveAsCode);
document.getElementById("delete-option").addEventListener("click", deleteCode);
document.getElementById("export-brs-option").addEventListener("click", exportBrsCode);
document.getElementById("export-json-option").addEventListener("click", exportJsonCode);
document.getElementById("export-all-option")?.addEventListener("click", exportAllCode);
document.getElementById("import-option").addEventListener("click", importCode);

let consoleLogsContainer = document.getElementById("console-logs");
let isResizing = false;
let editorManager;
let currentId = nanoid(10);
let isCodeChanged = false;
let unchangedCode = "";

function main() {
    updateButtons();
    // Initialize the Monaco editor
    const preferences = api.getPreferences();
    const theme = preferences?.simulator?.theme || "purple";
    const editorPrefs = preferences?.editor || {};
    terminal.setColorTheme(theme === "light" ? "light" : "dark");
    editorManager = new MonacoManager(brsCodeField, theme, editorPrefs);

    // Force initial layout after a short delay to ensure container has dimensions
    setTimeout(() => {
        if (editorManager && editorManager.editor) {
            editorManager.editor.layout();
        }
    }, 100);

    editorManager.editor.onDidChangeModelContent(() => {
        if (codeSelect.value === "0") {
            const code = editorManager.getValue();
            if (code && code.trim() === "") {
                isCodeChanged = false;
                return;
            }
        }
        if (editorManager.getValue() !== unchangedCode) {
            markCodeAsChanged();
        } else {
            markCodeAsSaved();
        }
    });
    // editorManager.editor.on("contextmenu", (event) => {
    //     api.send("contextMenu");
    // });
    const appPath = simulatorApp?.path;
    if (appPath && !(appPath.endsWith(EDITOR_CODE_BRS) || appPath === BRS_HOME_APP_PATH)) {
        hideEditor(true);
    }
    populateCodeSelector();
    // Subscribe to Engine events and initialize Console
    brs.subscribe(appId, handleEngineEvents);
    // Handle console commands
    terminal.onInput((command, parameters, handled) => {
        if (!handled) {
            brs.debug(`${command} ${parameters.join(" ")}`);
        }
    });
    if (debugMode === "stop") {
        runButton.style.display = "none";
        endButton.style.display = "inline";
        resumeButton.style.display = "inline";
        breakButton.style.display = "none";
        terminal.output("<br />");
        terminal.setPrompt();
    } else if (simulatorApp.running) {
        runButton.style.display = "none";
        endButton.style.display = "inline";
        breakButton.style.display = "inline";
    }
    editorManager.focus();

    editorContainer?.addEventListener("click", (event) => {
        const target = event.target;
        if (!target.closest(".code-header")) {
            editorManager.focus();
        }
    });
}

function updateButtons() {
    saveButton.title = isMacOS ? "CMD+S" : "CTRL+S";
    runButton.title = isMacOS ? "CMD+R" : "CTRL+R";
    clearAllButton.title = isMacOS ? "CMD+L" : "CTRL+L";
    endButton.title = isMacOS ? "CTRL+ESC" : "HOME";
    breakButton.title = isMacOS ? "CTRL+C" : "CTRL+B";
}

function handleEngineEvents(event, data) {
    if (event === "loaded") {
        if (data.path === BRS_HOME_APP_PATH) {
            return;
        }
        simulatorApp = data;
        const appPath = simulatorApp?.path ?? "";
        hideEditor(!appPath.endsWith(EDITOR_CODE_BRS));
    } else if (event === "started") {
        if (data.path === BRS_HOME_APP_PATH) {
            return;
        }
        simulatorApp = data;
        runButton.style.display = "none";
        endButton.style.display = "inline";
        breakButton.style.display = "inline";
    } else if (event === "debug") {
        if (data.level === "stop") {
            terminal.output("<br />");
            terminal.setPrompt();
            resumeButton.style.display = "inline";
            breakButton.style.display = "none";
        } else if (data.level === "continue") {
            terminal.output("<br />");
            terminal.idle();
            resumeButton.style.display = "none";
            breakButton.style.display = "inline";
        } else if (typeof data.content === "string") {
            updateTerminal(data.content, data.level);
        }
        scrollToBottom();
    } else if (event === "closed" || event === "error") {
        simulatorApp = data;
        terminal.idle();
        runButton.style.display = "inline";
        endButton.style.display = "none";
        resumeButton.style.display = "none";
        breakButton.style.display = "none";
        hideEditor(false);
    }
}

function updateTerminal(text, level = "print") {
    let output = text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    if (level === "print") {
        const promptLen = `${prompt}&gt; `.length;
        if (output.endsWith(`${prompt}&gt; `)) {
            output = output.slice(0, output.length - promptLen);
        }
        output = output.replaceAll(" ", "&nbsp;");
    } else if (level === "warning") {
        output = terminal.colorize(output.replaceAll(" ", "&nbsp;"), "#d7ba7d");
    } else if (level === "error") {
        output = terminal.colors.brightRed(output.replaceAll(" ", "&nbsp;"));
    }
    const lines = output.trim().split(/\r?\n/);
    for (const line of lines) {
        terminal.output(line || "&zwnj;");
    }
}

function hideEditor(toggle) {
    editorContainer.classList.toggle("hidden", toggle);
    document.body.classList.toggle("code-hidden", toggle);
    onResize();
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

// Code Events

function markCodeAsChanged() {
    isCodeChanged = true;
    updateCodeSelector();
}

function markCodeAsSaved() {
    isCodeChanged = false;
    updateCodeSelector();
}

function updateCodeSelector() {
    const options = Array.from(codeSelect.options);
    for (const option of options) {
        if (option.value === currentId) {
            if (isCodeChanged) {
                option.text = `⏺︎ ${option.text.replace(/^⏺︎ /, "")}`;
            } else {
                option.text = option.text.replace(/^⏺︎ /, "");
            }
        }
    }
}

function populateCodeSelector(currentId = "") {
    const arrCode = new Array();
    for (let i = 0; i < localStorage.length; i++) {
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
    arrCode.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
    codeSelect.length = 1;
    for (let i = 0; i < arrCode.length; i++) {
        const codeId = arrCode[i][1];
        const selected = codeId === currentId;
        codeSelect.options[i + 1] = new Option(arrCode[i][0], codeId, false, selected);
    }
    updateCodeSelector();
}

let savedValue = codeSelect.value;
codeSelect.addEventListener("mousedown", async (e) => {
    savedValue = codeSelect.value;
});

function showDialog(message) {
    return new Promise((resolve) => {
        if (message) {
            dialogText.innerText = message;
        }
        confirmDialog.showModal();

        confirmButton.onclick = () => {
            confirmDialog.close();
            resolve(true);
        };

        cancelButton.onclick = () => {
            confirmDialog.close();
            resolve(false);
        };
    });
}

codeSelect.addEventListener("change", async (e) => {
    if (isCodeChanged) {
        const confirmed = await showDialog(
            "There are unsaved changes, do you want to discard and continue?"
        );
        if (!confirmed) {
            e.preventDefault();
            codeSelect.value = savedValue;
            return;
        }
    }
    if (codeSelect.value !== "0") {
        loadCode(codeSelect.value);
    } else {
        currentId = nanoid(10);
        resetApp();
    }
    resetUndoHistory();
});

function resetUndoHistory() {
    // Monaco doesn't have a clearHistory method, but we can set the value to itself
    // to effectively reset undo history
    if (editorManager?.editor) {
        const value = editorManager.getValue();
        editorManager.setValue("");
        editorManager.setValue(value);
    }
}

// api.receive("editorUndo", function () {
//     editorManager?.editor?.undo();
// });

// api.receive("editorRedo", function () {
//     editorManager?.editor?.redo();
// });

function loadCode(id) {
    let code = localStorage.getItem(id);
    if (code) {
        currentId = id;
        if (code.startsWith("@=")) {
            code = code.substring(code.indexOf("=@") + 2);
        }
        resetApp(id, code);
        markCodeAsSaved();
    } else {
        showToast("Could not find the code in the Local Storage!", 3000, true);
    }
}

function renameCode() {
    if (currentId && localStorage.getItem(currentId)) {
        actionType.value = "rename";
        const codeName = codeSelect.options[codeSelect.selectedIndex].text;
        codeForm.codeName.value = codeName.replace(/^⏺︎ /, "");
        codeDialog.showModal();
    } else {
        showToast("There is no code snippet selected to rename!", 3000, true);
    }
}

function saveAsCode() {
    const code = editorManager.getValue();
    if (!code || code.trim() === "") {
        showToast("There is no Source Code to save!", 3000, true);
        return;
    }
    if (currentId && localStorage.getItem(currentId)) {
        actionType.value = "saveas";
        const codeName = codeSelect.options[codeSelect.selectedIndex].text + " (Copy)";
        codeForm.codeName.value = codeName.replace(/^⏺︎ /, "");
    } else {
        actionType.value = "save";
        codeForm.codeName.value = "";
    }
    codeDialog.showModal();
}

async function deleteCode() {
    if (currentId && localStorage.getItem(currentId)) {
        const confirmed = await showDialog("Are you sure you want to delete this code?");
        if (confirmed) {
            localStorage.removeItem(currentId);
            currentId = nanoid(10);
            resetApp();
            unchangedCode = "";
            showToast("Code deleted from the browser local storage!", 3000);
        }
    } else {
        showToast("There is no code snippet selected to delete!", 3000, true);
    }
}

function exportBrsCode() {
    exportCodeAs("brs");
}

function exportJsonCode() {
    exportCodeAs("json");
}

function exportCodeAs(format) {
    const codeContent = editorManager.getValue();

    if (typeof codeContent !== "string" || codeContent.trim() === "") {
        showToast("There is no Source Code to export!", 3000, true);
        return;
    }

    // For JSON format, require saved snippet
    if (format === "json" && codeSelect.value === "0") {
        showToast("Please save your Code Snippet before exporting as JSON!", 3000, true);
        return;
    }

    // Get filename
    let fileName = "code";
    if (codeSelect.value !== "0") {
        const codeName = codeSelect.options[codeSelect.selectedIndex].text;
        fileName = codeName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/^⏺︎ /, "")
            .replace(/[^a-z0-9-]/g, "");
    }

    // Create file content and blob
    let fileContent, mimeType, extension;
    if (format === "brs") {
        fileContent = codeContent;
        mimeType = "text/plain";
        extension = "brs";
    } else {
        const codes = {
            [currentId]: {
                name: codeSelect.options[codeSelect.selectedIndex].text,
                content: codeContent,
            },
        };
        fileContent = JSON.stringify(codes, null, 2);
        mimeType = "application/json";
        extension = "json";
    }
    // Download file
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportAllCode() {
    const codes = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (value.startsWith("@=")) {
            const codeName = value.substring(2, value.indexOf("=@"));
            const codeContent = value.substring(value.indexOf("=@") + 2);
            codes[key] = { name: codeName, content: codeContent };
        }
    }
    const json = JSON.stringify(codes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codesnippets.json";
    a.click();
    URL.revokeObjectURL(url);
}

function importCode() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.brs,application/json,text/brs";
    input.onchange = (e) => {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            let importedCodes = 0;
            let loadId = currentId;
            if (file?.name?.toLowerCase().endsWith(".brs")) {
                const codeId = nanoid(10);
                const codeName = file.name;
                const codeContent = e.target?.result;
                if (typeof codeContent === "string" && codeContent.trim() !== "") {
                    const value = `@=${codeName}=@${codeContent}`;
                    localStorage.setItem(codeId, value);
                    importedCodes++;
                    loadId = codeId;
                }
            } else {
                const json = e.target.result;
                let codes;
                try {
                    codes = JSON.parse(json);
                } catch (error) {
                    showToast("Invalid JSON file format!", 3000, true);
                    return;
                }
                // Validate the codes object structure
                if (!codes || typeof codes !== "object" || Array.isArray(codes)) {
                    showToast("Invalid code snippets format: expected an object!", 3000, true);
                    return;
                }
                for (const id in codes) {
                    const code = codes[id];
                    // Validate each code entry
                    if (
                        !code ||
                        typeof code !== "object" ||
                        typeof code.name !== "string" ||
                        !code.name.trim() ||
                        typeof code.content !== "string" ||
                        !code.content.trim()
                    ) {
                        continue;
                    }
                    const value = `@=${code.name}=@${code.content}`;
                    localStorage.setItem(id, value);
                    importedCodes++;
                }
                loadId = Object.keys(codes)[0] ?? currentId;
            }
            populateCodeSelector(currentId);
            if (importedCodes === 1) {
                showToast("Code snippet imported to the simulator local storage!", 3000);
                loadCode(loadId);
            } else if (importedCodes > 1) {
                showToast("Code snippets imported to the simulator local storage!", 3000);
            } else {
                showToast("No valid code snippets found to import!", 3000, true);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetApp(id = "", code = "") {
    populateCodeSelector(id);
    if (simulatorApp.running) {
        brs.terminate("EXIT_USER_NAV");
        clearTerminal();
    }
    unchangedCode = code;
    editorManager.setValue(code);
    editorManager.focus();
    markCodeAsSaved();
}

function shareCode() {
    let code = editorManager.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value !== "0") {
            let codeName = codeSelect.options[codeSelect.selectedIndex].text.replace(/^⏺︎ /, "");
            code = `@=${codeName}=@${code}`;
        }
        const data = {
            id: currentId,
            code: code,
        };
        getShareUrl(data).then(function (shareLink) {
            navigator.clipboard.writeText(shareLink);
            if (shareLink.length > 2048) {
                showToast(
                    "URL copied to clipboard, but it's longer than 2048 bytes, consider exporting as a file instead!",
                    7000,
                    true
                );
            } else {
                showToast("brsFiddle.net share URL copied to clipboard.");
            }
        });
    } else {
        showToast("There is no Source Code to share!", 3000, true);
    }
}

function saveCode() {
    const code = editorManager.getValue();
    if (code && code.trim() !== "") {
        if (codeSelect.value === "0") {
            actionType.value = "save";
            codeDialog.showModal();
        } else {
            const codeName = codeSelect.options[codeSelect.selectedIndex].text.replace(/^⏺︎ /, "");
            localStorage.setItem(currentId, `@=${codeName}=@${code}`);
            unchangedCode = code;
            showToast(
                "Code saved in the simulator local storage.\nTo share it use the Share button.",
                5000
            );
            markCodeAsSaved();
        }
    } else {
        showToast("There is no Source Code to save", 3000, true);
    }
}

codeDialog.addEventListener("close", (e) => {
    if (codeDialog.returnValue === "ok") {
        const codeName = codeForm.codeName.value.trim();
        if (codeName.length < 3) {
            showToast("Code snippet name must have least 3 characters!", 3000, true);
            resetDialog();
            return;
        }
        if (codeNameExists(codeName)) {
            showToast("There is already a code snippet with this Name!", 3000, true);
            resetDialog();
            return;
        }
        const code = editorManager.getValue();
        if (actionType.value === "saveas") {
            currentId = nanoid(10);
        }
        localStorage.setItem(currentId, `@=${codeName}=@${code}`);
        unchangedCode = code;
        populateCodeSelector(currentId);
        if (actionType.value === "rename") {
            showToast("Code snippet renamed in the simulator local storage.", 5000);
        } else {
            showToast(
                "Code saved in the simulator local storage!\nTo share it use the Share button.",
                5000
            );
        }
        markCodeAsSaved();
    }
    resetDialog();
});

function resetDialog() {
    codeDialog.returnValue = "";
    codeForm.codeName.value = "";
}

function codeNameExists(codeName) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.length === 10) {
            const value = localStorage.getItem(key);
            if (value?.startsWith("@=")) {
                const itemName = value.substring(2, value.indexOf("=@"));
                if (itemName.toLocaleLowerCase() === codeName.toLocaleLowerCase()) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function runCode() {
    const code = editorManager.getValue();
    if (code && code.trim() !== "") {
        try {
            api.send("runCode", code);
            terminal.output(`<br /><pre>Executing source code...</pre><br /><br />`);
            terminal.idle();
        } catch (e) {
            console.log(e); // Check EvalError object
            terminal.output(`${e.name}: ${e.message}`);
            scrollToBottom();
        }
    } else {
        showToast("There is no Source Code to run!", 3000, true);
    }
}

function startDebug() {
    if (simulatorApp.running) {
        brs.debug("break");
    } else {
        showToast("There is nothing running to debug!", 3000, true);
    }
}

function resumeExecution() {
    if (simulatorApp.running) {
        brs.debug("cont");
    }
}

function endExecution() {
    if (simulatorApp.running) {
        brs.terminate("EXIT_USER_NAV");
    } else {
        showToast("There is nothing running to terminate!", 3000, true);
    }
}

function clearTerminal() {
    terminal.clear();
    simulator.clearStatusCounters();
}

function hotKeys(event) {
    if (isHotKey(event, "KeyR")) {
        event.preventDefault();
        runCode();
    } else if (isHotKey(event, "KeyS")) {
        event.preventDefault();
        saveCode();
    } else if (isHotKey(event, "KeyL")) {
        event.preventDefault();
        clearTerminal();
    } else if (simulatorApp.running) {
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

function isHotKey(event, keyCode) {
    return (
        (isMacOS && event.code === keyCode && event.metaKey) ||
        (!isMacOS && event.code === keyCode && event.ctrlKey)
    );
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
        // Force Monaco editor to recalculate layout during drag
        setTimeout(() => {
            editorManager.editor.layout();
        }, 0);
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
    if (editorManager && editorManager.editor) {
        // Use setTimeout to ensure DOM has updated before layout recalculation
        setTimeout(() => {
            if (globalThis.innerWidth >= 1150 || editorContainer.classList.contains("hidden")) {
                editorManager.editor.layout();
            } else {
                codeColumn.style.width = "100%";
                editorManager.editor.layout();
            }
        }, 0);
    }
    scrollToBottom();
}

function getShareUrl(suite) {
    if (!suite) {
        return Promise.resolve(null);
    }
    //compress the object
    const data = [suite.id, suite.code];
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

// Theme Management
globalThis.__currentTheme = () =>
    globalThis.matchMedia("(prefers-color-scheme:dark)")?.matches ? "dark" : "light";
globalThis.__setTheme = () => {
    const preferences = api.getPreferences();
    let theme = preferences.simulator.theme || "purple";
    if (theme === "system") {
        theme = __currentTheme();
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("close-button-dark").style.display = theme === "light" ? "none" : "";
    document.getElementById("close-button-light").style.display = theme === "light" ? "" : "none";
    layoutContainer.style.colorScheme = theme === "light" ? "light" : "dark";
    if (editorManager) {
        editorManager.setTheme(theme);
        // Update editor indentation settings
        const editorPrefs = preferences?.editor || {};
        editorManager.setIndentation(editorPrefs);
    }
    terminal.setColorTheme(theme === "light" ? "light" : "dark");
};
globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", __setTheme);
api.onPreferencesUpdated(__setTheme);

document.addEventListener("DOMContentLoaded", (event) => {
    if (api.processPlatform() === "darwin") {
        document.getElementById("window-controls").style.visibility = "hidden";
    } else {
        document.getElementById("close-button").addEventListener("click", (event) => {
            api.closePreferences();
        });
    }
    __setTheme();
});

// Events Handling
globalThis.addEventListener("load", main, false);
globalThis.addEventListener("resize", onResize, false);
document.addEventListener("keydown", hotKeys, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);
document.addEventListener("mousedown", onMouseDown, false);
