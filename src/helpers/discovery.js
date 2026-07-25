/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Parsing helpers for Roku device discovery: SSDP response headers and the XML returned by
// a device's /query/device-info endpoint. All pure string and regex work, kept apart from
// settings.js so they can be tested without electron-preferences or an SSDP client.
//
// updateDeviceMetadata() and getRokuDeviceOptions() deliberately stay in settings.js:
// they close over the module-level discoveredDevices map.

export function extractFirmwareFromServer(serverHeader) {
    if (!serverHeader) {
        return "";
    }
    const match = serverHeader.match(/Roku\/[\d.]+\s+UPnP\/[\d.]+\s+Roku\/([^(]+)/);
    return match ? match[1].trim() : "";
}

export function extractSerialNumberFromUSN(usnHeader) {
    if (!usnHeader) {
        return "";
    }
    const match = usnHeader.match(/uuid:roku:ecp:([^:]+)/i);
    return match ? match[1] : "";
}

export function normalizeIpAddress(ipAddress) {
    if (!ipAddress) {
        return "";
    }
    return ipAddress.startsWith("::ffff:") ? ipAddress.slice(7) : ipAddress;
}

export function isRokuDiscoveryResponse(headers) {
    if (!headers) {
        return false;
    }
    const serviceType = headers.ST?.toLowerCase() ?? "";
    const uniqueServiceName = headers.USN?.toLowerCase() ?? "";
    return serviceType.includes("roku:ecp") || uniqueServiceName.includes("roku:ecp");
}

export function parseDeviceMetadata(ipAddr, sn, data) {
    if (!data) {
        return {
            ipAddr,
            serialNumber: sn || "",
            friendlyName: "",
            modelNumber: "",
            modelName: "",
        };
    }
    const serialNumber =
        sn ||
        extractAny(
            [/<serial-number>(.*?)<\/serial-number>/i, /<serialNumber>(.*?)<\/serialNumber>/i],
            data
        );
    const friendlyName = extractAny(
        [
            /<friendly-device-name>(.*?)<\/friendly-device-name>/i,
            /<user-device-name>(.*?)<\/user-device-name>/i,
        ],
        data
    );
    const modelNumber = extractAny(
        [/<model-number>(.*?)<\/model-number>/i, /<modelNumber>(.*?)<\/modelNumber>/i],
        data
    );
    const modelName = extractAny(
        [/<model-name>(.*?)<\/model-name>/i, /<friendly-model-name>(.*?)<\/friendly-model-name>/i],
        data
    );

    return {
        ipAddr,
        serialNumber,
        friendlyName,
        modelNumber,
        modelName,
    };
}

// Use a regular expression to extract a field from some data,
// returning an empty string if the field is not found
export function extract(re, data) {
    const match = re.exec(data);
    return Array.isArray(match) && match.length === 2 ? match[1].trim() : "";
}

// Try each pattern in turn, returning the first non-empty match
export function extractAny(patterns, data) {
    for (const pattern of patterns) {
        const value = extract(pattern, data);
        if (value) {
            return value;
        }
    }
    return "";
}
