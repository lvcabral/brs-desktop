/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createFakeWindow, __registerWindow } from "../mocks/electron.js";

/**
 * Create and register the simulator window.
 *
 * Roughly 35 call sites across `src/` reach the main window via `BrowserWindow.fromId(1)`,
 * so registering under id 1 is what makes those paths resolve.
 * @param {number} [id] - The window id
 * @returns {object} - The registered fake window
 */
export function installFakeWindow(id = 1) {
    return __registerWindow(createFakeWindow(id));
}

/**
 * Wait for the window to receive an IPC message on a channel.
 *
 * Integration specs drive real sockets, so sends land asynchronously.
 * @param {object} win - The fake window
 * @param {string} channel - The IPC channel to watch
 * @param {number} [timeout] - How long to wait, in milliseconds
 * @returns {Promise<object[]>} - The messages seen on that channel
 */
export function waitForSend(win, channel, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeout;
        const poll = () => {
            const messages = win.sentOn(channel);
            if (messages.length > 0) {
                resolve(messages);
            } else if (Date.now() > deadline) {
                reject(new Error(`Timed out waiting for IPC send on "${channel}"`));
            } else {
                setTimeout(poll, 10);
            }
        };
        poll();
    });
}

/**
 * Wait until a channel has received at least `count` messages
 * @param {object} win - The fake window
 * @param {string} channel - The IPC channel to watch
 * @param {number} count - How many messages to wait for
 * @param {number} [timeout] - How long to wait, in milliseconds
 * @returns {Promise<object[]>} - The messages seen on that channel
 */
export function waitForSendCount(win, channel, count, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeout;
        const poll = () => {
            const messages = win.sentOn(channel);
            if (messages.length >= count) {
                resolve(messages);
            } else if (Date.now() > deadline) {
                reject(new Error(`Timed out waiting for ${count} sends on "${channel}" (saw ${messages.length})`));
            } else {
                setTimeout(poll, 10);
            }
        };
        poll();
    });
}
