import { ipcRenderer } from "electron";
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
    ipcRenderer.send("telnet", msg);
    console.log(msg);
}
export function clientWarning(msg) {
    ipcRenderer.send("telnet", msg);
    console.warn(msg);
    notifyAll("warning");
}
export function clientException(msg) {
    ipcRenderer.send("telnet", msg);
    console.error(msg);
    notifyAll("error");
}
