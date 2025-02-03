/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getPeerRoku } from "./settings";
import { isValidIP } from "./util";
import request from "postman-request";

let sendECPKeys = false;

ipcMain.on("keySent", (_, data) => {
    if (sendECPKeys) {
        const device = getPeerRoku();
        if (data.mod === 0) {
            postEcpRequest(device, `/keydown/${data.key}`);
        } else {
            postEcpRequest(device, `/keyup/${data.key}`);
        }
        if (data.key === "poweroff") {
            const window = BrowserWindow.fromId(1);
            window.close();
            app.quit()
        }
    }
});

ipcMain.on("currentApp", (_, data) => {
    if (data.id === "") {
        // Terminate current app
        const device = getPeerRoku();
        if (!device.deploy) {
            return;
        }
        if (isValidIP(device.ip)) {
            postEcpRequest(device, "/exit-app/dev");
            postEcpRequest(device, "/keypress/home");
        }
    }
});

export function resetPeerRoku() {
    sendECPKeys = false;
}

export async function runOnPeerRoku(fileData) {
    const window = BrowserWindow.fromId(1);
    const device = getPeerRoku();
    sendECPKeys = false;
    if (!device.deploy) {
        return;
    }
    if (isValidIP(device.ip)) {
        try {
            // Press home button twice to ensure we are on the home screen
            postEcpRequest(device, "/keypress/home");
            await new Promise(r => setTimeout(r, 500));
            postEcpRequest(device, "/keypress/home");
            postInstallerRequest(
                device,
                "/plugin_install",
                {
                    mysubmit: "Replace",
                    archive: {
                        value: fileData,
                        options: {
                            filename: "dev.zip",
                            contentType: "application/zip",
                        },
                    },
                },
                (err, response, body) => {
                    let message = "";
                    let isError = false;
                    if (err) {
                        message = `Error installing app: ${err} ${body}`;
                        isError = true;
                    } else if (response?.statusCode !== 200) {
                        message = `Response Installing app: ${response.statusCode} ${err ?? ""}`;
                        if (isCompileError(body)) {
                            message = `Error compiling app: ${response.statusCode} check telnet console for details`;
                        }
                        isError = true;
                    } else {
                        message = `App installed on peer Roku at ${device.ip} with success!`;
                        if (response.body.indexOf("Identical to previous version") > -1) {
                            message = `Identical to previous version, starting "dev" app...`;
                            postEcpRequest(device, "/launch/dev");
                        }
                        sendECPKeys = device.syncControl;
                    }
                    window.webContents.send("console", message, isError);
                }
            );
        } catch (error) {
            window.webContents.send(
                "console",
                `Error running on peer Roku ${device.ip}:${error.message}`,
                true
            );
        }
    } else if (device.ip?.length) {
        window.webContents.send("console", `Invalid peer Roku IP address: ${device.ip}`, true);
    } else {
        window.webContents.send("console", `Missing peer Roku IP address!`, true);
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

function isCompileError(responseHtml) {
    return !!/install\sfailure:\scompilation\sfailed/i.exec(responseHtml);
}
