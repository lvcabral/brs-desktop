/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "os";
import network from "network";

export function isValidIP(ip) {
    if (typeof ip !== "string") {
        return false;
    }
    const parts = ip.split(".");
    return (
        parts.length === 4 &&
        parts.every((part) => {
            const num = Number(part);
            return !isNaN(num) && num >= 0 && num <= 255;
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
    return ips;
}

export async function getGateway() {
    const gateWayData = { ip: "", name: "", type: "" };
    try {
        const gw = await getActiveInterface();
        console.log(`Gateway: ${gw.gateway_ip} - Interface: ${gw.name} - Type: ${gw.type}`);
        gateWayData.ip = gw.gateway_ip ?? "127.0.0.1";
        gateWayData.name = gw.name ?? "eth1";
        gateWayData.type = gw.type === "Wireless" ? "WiFiConnection" : "WiredConnection";
    } catch (err) {
        console.error(`Unable to get the Network Gateway: ${err.message}`);
    }
    return gateWayData;
}

async function getActiveInterface()
{
    return await new Promise((resolve, reject) => {
        network.get_active_interface((err, obj) => {
            if (err) {
                reject(err);
            } else {
                resolve(obj);
            }
        });
    });
}