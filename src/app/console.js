/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Observers Handling
const observers = new Map();
export function subscribeConsole(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeConsole(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach( (callback, id) => {
        callback(eventName, eventData);
    });
}
// Log to Telnet Server and Console
export function clientLog(msg) {
    api.send("telnet", msg);
    console.log(msg);
}
export function clientWarning(msg) {
    api.send("telnet", msg);
    console.warn(msg);
    notifyAll("warning");
}
export function clientException(msg) {
    api.send("telnet", msg);
    console.error(msg);
    notifyAll("error");
}
// Events from Main process
api.receive("console", function (text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});
api.receive("clientException", function (msg) {
    clientException(msg);
});
