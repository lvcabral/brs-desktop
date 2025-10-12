/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "os";
import network from "network";
import { execSync } from "child_process";

const isWindows = process.platform === "win32";

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

export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

export function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    Object.keys(ifaces).forEach(function (ifname) {
        let alias = 0;
        ifaces[ifname].forEach(function (iface) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(`${ifname}:${alias}`, iface.address);
                ips.push(`${ifname}:${alias},${iface.address}`);
            } else {
                // this interface has only one ipv4 address
                console.log(ifname, iface.address);
                ips.push(`${ifname},${iface.address}`);
            }
            ++alias;
        });
    });
    if (ips.length === 0) {
        ips.push("eth1,127.0.0.1");
    }
    return ips;
}

export async function getGateway() {
    const gateWayData = { ip: "", name: "", type: "", ssid: "" };
    try {
        const gw = await getActiveInterface();
        gateWayData.ip = gw.gateway_ip ?? "";
        gateWayData.name = gw.name ?? "";
        gateWayData.type = gw.type === "Wireless" ? "WiFiConnection" : "WiredConnection";
        if (gateWayData.type === "WiFiConnection") {
            gateWayData.ssid = getSSID() ?? "WiFi";
        }
        console.log(
            `Gateway: ${gateWayData.ip} - Interface: ${gateWayData.name} - Type: ${gateWayData.type} - SSID: ${gateWayData.ssid}`
        );
    } catch (err) {
        console.error(`Unable to get the Network Gateway: ${err.message}`);
    }
    return gateWayData;
}

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

function getSSID() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
        command = "netsh wlan show interfaces";
    } else if (platform === "darwin") {
        command =
            "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I";
    } else if (platform === "linux") {
        command = "iwgetid -r";
    }

    let ssid;
    const result = execSync(command).toString();
    if (platform === "win32") {
        const match = result.match(/SSID\s*:\s*(.+)/);
        ssid = match ? match[1] : null;
    } else if (platform === "darwin") {
        const match = result.match(/ SSID: (.+)/);
        ssid = match ? match[1] : null;
    } else if (platform === "linux") {
        ssid = result.trim();
    }
    return ssid;
}
