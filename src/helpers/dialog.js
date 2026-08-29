/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, dialog } from "electron";
import { loadFile } from "./files";
import { readJsonFile, writeJsonFile } from "./util";
import { DIALOG_STATE_FILE } from "../constants";
import path from "node:path";

// In-memory cache; lazily loaded on first use, flushed on every update.
let dialogState;

/**
 * Loads the persisted dialog state from disk (once per process).
 * @returns {object} - The dialog state, with `openDir` and `saveDir` keys
 */
function loadState() {
    if (!dialogState) {
        const filePath = path.join(app.getPath("userData"), DIALOG_STATE_FILE);
        dialogState = readJsonFile(filePath) ?? {};
    }
    return dialogState;
}

/**
 * Persists the current in-memory dialog state to disk.
 */
function saveState() {
    const filePath = path.join(app.getPath("userData"), DIALOG_STATE_FILE);
    writeJsonFile(filePath, dialogState);
}

/*
 * Show open dialog to open an app package .zip or .bpk file.
 */
export function openChannelPackage() {
    const state = loadState();
    const opts = {
        title: "Select an App package file.",
        filters: getFileFilter("App Packages", ["zip", "bpk"]),
        properties: ["openFile"],
    };
    if (state.openDir) {
        opts.defaultPath = state.openDir;
    }
    const window = BrowserWindow.fromId(1);
    dialog
        .showOpenDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                return;
            }
            state.openDir = path.dirname(result.filePaths[0]);
            saveState();
            loadFile(result.filePaths);
        })
        .catch((err) => {
            console.error(err);
        });
}

export function saveScreenshot() {
    const state = loadState();
    const opts = {
        title: "Save the Screenshot as",
        filters: [
            { name: "PNG Image", extensions: ["png"] },
            { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
        ],
    };
    if (state.saveDir) {
        opts.defaultPath = state.saveDir;
    }
    const window = BrowserWindow.fromId(1);
    dialog
        .showSaveDialog(window, opts)
        .then((result) => {
            if (result.canceled) {
                return;
            }
            state.saveDir = path.dirname(result.filePath);
            saveState();
            window.webContents.send("saveScreenshot", result.filePath);
        })
        .catch((err) => {
            console.error(err);
        });
}

/**
 * Clears the in-memory dialog state cache so the next call to `loadState()` re-reads from disk.
 * Exported only for testing.
 */
export function __resetDialogState() {
    dialogState = undefined;
}

// Helper functions

function getFileFilter(description, extensions) {
    return [
        { name: description, extensions: extensions },
        { name: "All Files", extensions: ["*"] },
    ];
}

