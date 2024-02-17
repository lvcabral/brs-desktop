/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrowserWindow, ipcMain } from "electron";
import { getPeerRoku, getSyncControl } from "./settings";
import * as fsExtra from "fs-extra";
import request from "postman-request";

ipcMain.on("keySent", (_, data) => {
    if (getSyncControl()) {
        const device = getPeerRoku();
        if (data.mod === 0) {
            postEcpRequest(device, `/keydown/${data.key}`);
        } else {
            postEcpRequest(device, `/keyup/${data.key}`);
        }
    }
});

export async function runOnPeerRoku(filePath) {
    const window = BrowserWindow.fromId(1);
    const device = getPeerRoku();
    if (isValidIP(device.ip)) {
        try {
            // Press home button twice to ensure we are on the home screen
            postEcpRequest(device, "/keypress/home");
            await new Promise(r => setTimeout(r, 500));
            postEcpRequest(device, "/keypress/home");
            const readStream = fsExtra.createReadStream(filePath);
            await new Promise((resolve) => {
                readStream.on("open", resolve);
            });
            postInstallerRequest(
                device,
                "/plugin_install",
                {
                    mysubmit: "Replace",
                    archive: readStream,
                },
                (err, response, body) => {
                    if (err) {
                        window.webContents.send(
                            "console",
                            `Error installing app: ${err} ${body}`,
                            true
                        );
                    } else if (response?.statusCode !== 200) {
                        window.webContents.send(
                            "console",
                            `Response Installing app: ${response?.statusCode} ${body}`,
                            false
                        );
                    } else {
                        if (response.body.indexOf("Identical to previous version") > -1) {
                            window.webContents.send(
                                "console",
                                `Identical to previous version, starting "dev" app...`,
                                false
                            );
                            postEcpRequest(device, "/launch/dev");
                        } else {
                            window.webContents.send(
                                "console",
                                `App installed on peer Roku at ${device.ip} with success!`,
                                false
                            );
                        }
                    }
                    try {
                        // Prevent file locking
                        readStream?.close();
                    } catch (e) {
                        console.info("Error closing read stream", e);
                    }
                }
            );
        } catch (error) {
            window.webContents.send(
                "console",
                `Error running on peer Roku ${device.ip}:${error.message}`,
                true
            );
        }
    } else if (device?.ip?.length) {
        window.webContents.send("console", `Invalid peer Roku IP address: ${device.ip}`, true);
    }
}

function postInstallerRequest(device, path, formData, callback) {
    request(
        {
            method: "POST",
            url: `http://${device.ip}${path}`,
            auth: {
                user: device.username,
                pass: device.password,
                sendImmediately: false,
            },
            timeout: 30000,
            formData: formData,
            agentOptions: { keepAlive: false },
        },
        (err, httpResponse, body) => {
            if (typeof callback === "function") {
                if (!err && httpResponse.statusCode == 401) {
                    err = "unauthorized";
                }
                callback(err, httpResponse, body);
            }
        }
    );
}

function postEcpRequest(device, path, callback) {
    request(
        {
            method: "POST",
            url: `http://${device.ip}:8060${path}`,
            timeout: 30000,
        },
        (err, httpResponse, body) => {
            if (typeof callback === "function") {
                if (!err && httpResponse.statusCode == 401) {
                    err = "unauthorized";
                }
                callback(err, httpResponse, body);
            }
        }
    );
}

export function isValidIP(ip) {
    if (ip && ip.length >= 7) {
        const ipFormat = /^(\d{1,3}\.){3}\d{1,3}$/;
        return ipFormat.test(ip);
    }
    return false;
}
