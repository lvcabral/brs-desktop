/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "os";
import defaultGateway from "default-gateway";

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

export function getGateway() {
    const gateWayData = { ip: "127.0.0.1", name: "eth1" };
    try {
        const gw = defaultGateway.v4.sync();
        console.log(`Gateway: ${gw.gateway} - Interface: ${gw.interface}`);
        gateWayData.ip = gw.gateway;
        gateWayData.name = gw.interface ?? "eth1";
    } catch (err) {
        console.error(`Unable to get the Network Gateway: ${err.message}`);
    }
    return gateWayData;
}

