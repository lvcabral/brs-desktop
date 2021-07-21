/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu-app)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// Capture Console Events
const exLog = console.log;
console.log = function(msg) {
    exLog.apply(this, arguments);
    api.send("telnet", msg);
}
const exWarn = console.warn;
console.warn = function(msg) {
    exWarn.apply(this, arguments);
    api.send("telnet", msg);
    notifyAll("warning");
}
const exError = console.error;
console.error = function(msg) {
    exError.apply(this, arguments);
    api.send("telnet", msg);
    notifyAll("error");
}
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
// Events from Main process
api.receive("console", function (text, error) {
    if (error) {
        console.error(text);
    } else {
        console.log(text);
    }
});