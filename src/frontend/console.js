import { ipcRenderer } from "electron";
import { setStatusColor } from "./statusbar";
export let errorCount = 0;
export let warnCount = 0;

console.log("Console module initialized!");
// Log to Telnet Server and Console
export function clientLog(msg) {
    ipcRenderer.send("telnet", msg);
    console.log(msg);
}
export function clientWarning(msg) {
    ipcRenderer.send("telnet", msg);
    console.warn(msg);
    warnCount++; 
    setStatusColor(errorCount, warnCount);
}
export function clientException(msg) {
    ipcRenderer.send("telnet", msg);
    console.error(msg);
    errorCount++; 
    setStatusColor(errorCount, warnCount);
}

export function clearCounters() {
    errorCount = 0;
    warnCount = 0;
}
