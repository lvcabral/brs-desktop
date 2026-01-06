/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app } from "electron";
import os from "node:os";
import network from "network";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

/**
 * Function to check if a string is a valid IP address
 * @param {string} ip - The IP address to check
 * @returns {boolean} - True if the IP address is valid, false otherwise
 */
export function isValidIP(ip) {
    if (typeof ip !== "string") {
        return false;
    }
    const parts = ip.split(".");
    return (
        parts.length === 4 &&
        parts.every((part) => {
            const num = Number(part);
            return !Number.isNaN(num) && num >= 0 && num <= 255;
        })
    );
}

/**
 * Function to check if a string is a valid URL
 * @param {string} string - The string to check
 * @returns {boolean} - True if the string is a valid URL, false otherwise
 */
export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Function to get the local IP addresses
 * @returns {string[]} - An array of local IP addresses
 */
export function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const ifname of Object.keys(ifaces)) {
        let alias = 0;
        for (const iface of ifaces[ifname]) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                continue;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                if (!app.isPackaged) {
                    console.log(`${ifname}:${alias}`, iface.address);
                }
                ips.push(`${ifname}:${alias},${iface.address}`);
            } else {
                // this interface has only one ipv4 address
                if (!app.isPackaged) {
                    console.log(ifname, iface.address);
                }
                ips.push(`${ifname},${iface.address}`);
            }
            ++alias;
        }
    }
    if (ips.length === 0) {
        ips.push("eth1,127.0.0.1");
    }
    return ips;
}

/**
 * Function to get the network gateway
 * @returns {object} - An object containing the gateway IP address, name, type, and SSID
 */
export async function getGateway() {
    const gateWayData = { ip: "", name: "", type: "", ssid: "" };
    try {
        const gw = getActiveInterface();
        gateWayData.ip = gw.gateway_ip ?? "";
        gateWayData.name = gw.name ?? "";
        gateWayData.type = gw.type === "Wireless" ? "WiFiConnection" : "WiredConnection";
        if (gateWayData.type === "WiFiConnection") {
            gateWayData.ssid = getSSID();
        }
        if (!app.isPackaged) {
            console.log(
                `Gateway: ${gateWayData.ip} - Interface: ${gateWayData.name} - Type: ${gateWayData.type} - SSID: ${gateWayData.ssid}`
            );
        }
    } catch (err) {
        console.error(`Unable to get the Network Gateway: ${err.message}`);
    }
    return gateWayData;
}

/**
 * Function to get the active network interface
 * @returns {object} - An object containing the gateway IP address, name, type, and SSID
 */
async function getActiveInterface() {
    return await new Promise((resolve, reject) => {
        if (!isWindows) {
            network.get_active_interface((err, obj) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(obj);
                }
            });
        } else {
            network.get_interfaces_list((err, list) => {
                if (err) {
                    reject(err);
                } else {
                    for (let iface of list) {
                        if (iface.gateway_ip) {
                            resolve(iface);
                            break;
                        }
                    }
                }
                reject(new Error("No active interface found"));
            });
        }
    });
}

/**
 * Function to get the SSID of the current WiFi connection
 * @returns {string} - The SSID of the current WiFi connection
 */
function getSSID() {
    const platform = os.platform();
    let ssid = "WiFi";
    let command = "";

    if (platform === "win32") {
        command = "netsh wlan show interfaces";
    } else if (platform === "darwin") {
        // Requires `sudo ipconfig setverbose 1` to get SSID info
        command = "ipconfig getsummary en0";
    } else if (platform === "linux") {
        command = "iwgetid -r";
    }
    // Run the command and parse the SSID
    try {
        const result = spawnSync(command, { shell: true, encoding: "utf8" }).stdout;
        if (platform === "win32") {
            const match = result.match(/SSID\s*:\s*(.+)/);
            ssid = match ? match[1].trim() : ssid;
        } else if (platform === "darwin") {
            const match = result.match(/ SSID : (.+)/);
            ssid = match ? match[1].trim() : ssid;
        } else if (platform === "linux") {
            ssid = result.trim() ?? ssid;
        }
    } catch (err) {
        // Log error but don't crash - just return null
        console.warn(`Unable to get SSID: ${err.message}`);
    }
    return ssid;
}

/**
 * Function to format a file path with POSIX separators
 * @param {string} path - The path to format
 * @returns {string} - The formatted path
 */
export function formatPath(path) {
    return isWindows ? path.replaceAll("\\", "/") : path;
}