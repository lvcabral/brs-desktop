/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, ipcMain } from "electron";
import { getPeerRoku } from "./settings";
import { isValidIP } from "./util";
import { ECP_PORT } from "../constants";
import { parseDigestChallenge, generateDigestResponse, formatDigestHeader } from "./digest";

let sendECPKeys = false;

// Event Handlers
ipcMain.on("keySent", (_, data) => {
    if (sendECPKeys && typeof data?.key === "string") {
        const device = getPeerRoku();
        let ecpKey = data.key;
        if (ecpKey.toLowerCase().startsWith("lit_")) {
            ecpKey = `lit_${encodeURIComponent(ecpKey.charAt(4))}`;
        }
        if (data.mod === 0) {
            postEcpRequest(device, `/keydown/${ecpKey}`);
        } else {
            postEcpRequest(device, `/keyup/${ecpKey}`);
        }
        if (data.key === "poweroff") {
            const window = BrowserWindow.fromId(1);
            window.close();
            app.quit();
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
            if (!device.keepAppOpen) {
                postEcpRequest(device, "/exit-app/dev");
                postEcpRequest(device, "/keypress/home");
            }
        }
    }
});

// Function to reset peer Roku control
export function resetPeerRoku() {
    sendECPKeys = false;
}

// Function to run app on peer Roku
export async function runOnPeerRoku(fileData, deepLink) {
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
            await new Promise((r) => setTimeout(r, 500));
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
                async (err, response, body) => {
                    let message = "";
                    let isError = false;
                    if (err) {
                        message = `Error installing app: ${err} ${body}`;
                        isError = true;
                    } else if (response?.status === 200) {
                        message = `App installed on peer device ${device.friendlyName || device.ip} with success!`;
                        let queryString = "";
                        if (deepLink instanceof Map && deepLink.size > 1) {
                            queryString = "?";
                            for (const [key, value] of deepLink.entries()) {
                                queryString += `${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
                            }
                            queryString = queryString.slice(0, -1); // Remove trailing '&'
                            // Return to home screen before launching with deep link
                            await postEcpRequest(device, "/keypress/home");
                        }
                        if (body.includes("Identical to previous version") || queryString !== "") {
                            message =
                                queryString === ""
                                    ? `Identical to previous version, starting "dev" app...`
                                    : `Launching "dev" app with deep link parameters...`;
                            await postEcpRequest(device, `/launch/dev${queryString}`);
                        }
                        sendECPKeys = device.syncControl;
                    } else {
                        message = `Response Installing app: ${response.status} ${err ?? ""}`;
                        if (isCompileError(body)) {
                            message = `Error compiling app: ${response.status} check telnet console for details`;
                        }
                        isError = true;
                    }
                    window.webContents.send("console", message, isError);
                }
            );
        } catch (error) {
            window.webContents.send("console", `Error running on peer Roku ${device.ip}:${error.message}`, true);
        }
    } else if (device.ip?.length) {
        window.webContents.send("console", `Invalid peer Roku IP address: ${device.ip}`, true);
    } else {
        window.webContents.send("console", `Missing peer Roku IP address!`, true);
    }
}

// Function to perform simple POST request for ECP
async function postEcpRequest(device, path, callback) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`http://${device.ip}:${ECP_PORT}${path}`, {
            method: "POST",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const body = await response.text();

        if (typeof callback === "function") {
            let err = null;
            if (response.status === 401) {
                err = "unauthorized";
            }
            callback(err, response, body);
        }
    } catch (error) {
        if (typeof callback === "function") {
            callback(error.message, null, "");
        }
    }
}

// Function to perform POST request with digest authentication
async function postInstallerRequest(device, path, formData, callback) {
    try {
        const form = new FormData();
        form.append("mysubmit", formData.mysubmit);
        form.append(
            "archive",
            new Blob([formData.archive.value], {
                type: formData.archive.options.contentType,
            }),
            formData.archive.options.filename
        );

        const url = `http://${device.ip}${path}`;

        // First request to get the digest challenge
        const controller1 = new AbortController();
        const timeoutId1 = setTimeout(() => controller1.abort(), 30000);

        let response = await fetch(url, {
            method: "POST",
            body: form,
            signal: controller1.signal,
        });

        clearTimeout(timeoutId1);

        // If we get 401, parse the challenge and retry with auth
        if (response.status === 401) {
            const authHeader = response.headers.get("www-authenticate");
            if (authHeader?.toLowerCase().startsWith("digest")) {
                const challenge = parseDigestChallenge(authHeader);
                const digestParams = generateDigestResponse(device.username, device.password, "POST", path, challenge);
                const authHeaderValue = formatDigestHeader(digestParams);

                // Recreate the form data for the second request
                const form2 = new FormData();
                form2.append("mysubmit", formData.mysubmit);
                form2.append(
                    "archive",
                    new Blob([formData.archive.value], {
                        type: formData.archive.options.contentType,
                    }),
                    formData.archive.options.filename
                );

                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 30000);

                response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: authHeaderValue,
                    },
                    body: form2,
                    signal: controller2.signal,
                });

                clearTimeout(timeoutId2);
            }
        }

        const body = await response.text();

        if (typeof callback === "function") {
            let err = null;
            if (response.status === 401) {
                err = "unauthorized";
            }
            callback(err, response, body);
        }
    } catch (error) {
        if (typeof callback === "function") {
            callback(error.message, null, "");
        }
    }
}

// Helper function to parse digest authentication challenge

// Helper function to generate digest authentication response

// Helper function to format digest auth header

// Helper function to check for compilation error in response body
export function isCompileError(responseHtml) {
    // \s+ rather than \s: the phrase is embedded in an HTML page whose whitespace and line
    // wrapping vary between Roku firmware versions, so a single-space match is too strict.
    return !!/install\s+failure:\s+compilation\s+failed/i.exec(responseHtml);
}
