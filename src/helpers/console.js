/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ipcMain } from "electron";

const BUFFER_SIZE = 700;
export const consoleBuffer = [];

ipcMain.on("telnet", (event, text) => {
    if (text !== undefined) {
        if (consoleBuffer.length >= BUFFER_SIZE) {
            consoleBuffer.shift();
        }
        consoleBuffer.push(text);
    }
});

ipcMain.on("getConsoleBuffer", (event) => {
    event.returnValue = consoleBuffer;
});

export function clearBuffer() {
    consoleBuffer.length = 0;
}
