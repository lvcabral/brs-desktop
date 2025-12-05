/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow } from "electron";
import { WEB_INSTALLER_PORT, DEFAULT_USRPWD } from "../constants";
import Busboy from "busboy";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypt from "node:crypto";

const credentials = {
    userName: DEFAULT_USRPWD,
    password: DEFAULT_USRPWD,
    realm: app.getName(),
};
let port = WEB_INSTALLER_PORT;
let server;
let hash;
export let isInstallerEnabled = false;
export function setPassword(password) {
    if (password && password !== "") {
        credentials.password = password;
    }
}
export function setPort(customPort) {
    if (typeof customPort === "number") {
        port = customPort;
    } else if (typeof customPort === "string" && !Number.isNaN(Number.parseInt(customPort))) {
        port = Number.parseInt(customPort);
    }
}
export function enableInstaller() {
    if (isInstallerEnabled) {
        return; // already started do nothing
    }
    const window = BrowserWindow.fromId(1);
    hash = cryptoUsingMD5(credentials.realm);
    server = http
        .createServer(function (req, res) {
            // Skip authentication for image endpoints - they're accessed from already authenticated pages
            const urlPath = req.url.split("?")[0];
            if (urlPath === "/pkgs/dev.png" || urlPath === "/pkgs/dev.jpg") {
                serveImage(res);
                return;
            }

            // Digest Authentication
            if (!performDigestAuth(req, res)) {
                return;
            }

            if (req.method === "POST") {
                handlePostRequest(req, res, window);
            } else if (req.method === "GET") {
                let filePath = "";
                let contentType = "";

                if (urlPath === "/css/styles.min.css") {
                    filePath = path.join(__dirname, "css", "styles.min.css");
                    contentType = "text/css";
                } else if (
                    urlPath === "/" ||
                    urlPath === "/index.html" ||
                    urlPath === "/plugin_install"
                ) {
                    filePath = path.join(__dirname, "web", "installer.html");
                    contentType = "text/html";
                } else if (urlPath === "/plugin_inspect") {
                    filePath = path.join(__dirname, "web", "utilities.html");
                    contentType = "text/html";
                }
                // Note: /pkgs/dev.png is handled at the top without authentication
                if (filePath !== "") {
                    serveStaticFile(res, filePath, contentType);
                } else {
                    res.writeHead(404);
                    res.end("Error 404: Not Found\nFile not found");
                }
            }
        })
        .listen(port, () => {
            isInstallerEnabled = true;
            notifyAll("enabled", { enabled: true, port: port });
        });
    server.on("error", (e) => {
        if (e.code === "EADDRINUSE") {
            window.webContents.send("console", `Web Installer server failed:${e.message}`, true);
            isInstallerEnabled = false;
        } else {
            window.webContents.send("console", e.message, true);
        }
    });
}

export function disableInstaller() {
    if (isInstallerEnabled) {
        if (server) {
            server.close();
        }
        isInstallerEnabled = false;
        notifyAll("enabled", { enabled: false, port: port });
    }
}

// POST Handler
function handlePostRequest(req, res, window) {
    let done = "";
    let fileSize = 0;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers });

    busboy.on("file", (fieldname, file, info) => {
        handleFileUpload(file, info.filename, (size, error) => {
            fileSize = size;
            fileError = error;
            done = "file";
        });
    });

    busboy.on("field", (fieldname, value, info) => {
        const result = handleFormField(fieldname, value, window);
        if (result === "screenshot" || result === "delete") {
            done = result;
        }
    });

    busboy.on("close", () => {
        handlePostResponse(res, done, fileSize, fileError);
    });

    req.pipe(busboy);
}

function handleFileUpload(file, filename, callback) {
    if (!filename?.length) {
        return;
    }

    let fileSize = 0;
    try {
        const devFile = filename.endsWith(".bpk") ? "dev.bpk" : "dev.zip";
        const saveTo = path.join(app.getPath("userData"), devFile);
        const writeStream = fs.createWriteStream(saveTo);

        file.on("data", (chunk) => {
            fileSize += chunk.length;
        });

        file.on("end", () => {
            callback(fileSize, null);
        });

        file.pipe(writeStream);

        writeStream.on("finish", () => {
            notifyAll("install", { file: saveTo, source: "auto-run-dev" });
        });

        writeStream.on("error", (error) => {
            callback(fileSize, error.message);
        });
    } catch (error) {
        callback(fileSize, error.message);
    }
}

function handleFormField(fieldname, value, window) {
    if (!fieldname || !value) {
        return value;
    }

    if (fieldname === "mysubmit" && value.toLowerCase() === "screenshot") {
        const saveTo = path.join(app.getPath("userData"), "dev.png");
        window.webContents.send("saveScreenshot", saveTo);
        return "screenshot";
    }

    if (fieldname === "mysubmit" && value.toLowerCase() === "delete") {
        const toDelete = path.join(app.getPath("userData"), "dev.zip");
        try {
            fs.unlinkSync(toDelete);
        } catch (error) {
            console.error("Error deleting dev.zip - ", error);
        }
        return "delete";
    }

    return value;
}

function handlePostResponse(res, done, fileSize, fileError) {
    if (done === "screenshot") {
        handleScreenshotResponse(res);
    } else if (done === "file") {
        handleFileInstallResponse(res, fileSize, fileError);
    } else if (done === "delete") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("File Deleted!");
    } else {
        console.warn(`[Web Installer] Invalid method: ${done}`);
        res.writeHead(501);
        res.end("Error 501: Not Implemented\nMethod not Implemented");
    }
}

function handleScreenshotResponse(res) {
    setTimeout(() => {
        const utilitiesPath = path.join(__dirname, "web", "utilities.html");
        fs.readFile(utilitiesPath, "utf8", (error, html) => {
            if (error) {
                res.writeHead(500);
                res.end("Error 500: Internal Server Error\nCould not read utilities page!");
                return;
            }

            const screenshotPath = path.join(app.getPath("userData"), "dev.png");
            const screenshotExists = fs.existsSync(screenshotPath);
            const contentDiv = buildScreenshotHtml(screenshotExists);
            const modifiedHtml = html.replace(
                "</div>\n                    </div>\n                </main>",
                `${contentDiv}\n                    </div>\n                </main>`
            );
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(modifiedHtml);
        });
    }, 1000);
}

function buildScreenshotHtml(screenshotExists) {
    if (screenshotExists) {
        const timestamp = Date.now();
        return `
                                <div style="margin-top: 20px;">
                                    <div style="background-color: #d4edda; color: #155724; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; font-weight: 500;">
                                        Screenshot ok
                                    </div>
                                    <div style="text-align: center;">
                                        <img src="pkgs/dev.png?time=${timestamp}" alt="Screenshot" style="max-width: 100%; height: auto; border: 1px solid #ccc;"/>
                                    </div>
                                </div>
                            </div>`;
    }

    return `
                                <div style="margin-top: 20px;">
                                    <div style="background-color: #f8d7da; color: #721c24; padding: 12px 20px; border-radius: 8px; font-weight: 500;">
                                        Screenshot failed: Could not capture screenshot
                                    </div>
                                </div>
                            </div>`;
}

function handleFileInstallResponse(res, fileSize, fileError) {
    const installerPath = path.join(__dirname, "web", "installer.html");
    fs.readFile(installerPath, "utf8", (error, html) => {
        if (error) {
            res.writeHead(500);
            res.end("Error 500: Internal Server Error\nCould not read installer page!");
            return;
        }

        const contentDiv = buildInstallHtml(fileSize, fileError);
        const modifiedHtml = html.replace(
            "</div>\n                        </div>\n                    </div>\n                </main>",
            `${contentDiv}\n                        </div>\n                    </div>\n                </main>`
        );
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(modifiedHtml);
    });
}

function buildInstallHtml(fileSize, fileError) {
    if (fileError) {
        return `
                                <div style="margin-top: 20px;">
                                    <div style="background-color: #f8d7da; color: #721c24; padding: 12px 20px; border-radius: 8px; font-weight: 500;">
                                        Installation failed: ${fileError}
                                    </div>
                                </div>
                            </div>`;
    }

    return `
                                <div style="margin-top: 20px;">
                                    <div style="background-color: #d4edda; color: #155724; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px; font-weight: 500;">
                                        Application Received: ${fileSize} bytes stored.
                                    </div>
                                    <div style="background-color: #d4edda; color: #155724; padding: 12px 20px; border-radius: 8px; font-weight: 500;">
                                        Install Success
                                    </div>
                                </div>
                            </div>`;
}

// Request Handler Helper Functions
function serveImage(res) {
    const filePath = path.join(app.getPath("userData"), "dev.png");
    fs.readFile(filePath, (error, pgResp) => {
        if (error) {
            res.writeHead(404);
            res.end("Error 404: Not Found\nFile not found");
        } else {
            res.writeHead(200, { "Content-Type": "image/png" });
            res.end(pgResp);
        }
    });
}

function performDigestAuth(req, res) {
    if (!req.headers.authorization) {
        authenticateUser(res);
        return false;
    }
    const authInfo = req.headers.authorization.replace(/^Digest /, "");
    const parsedAuth = parseAuthenticationInfo(authInfo);
    if (parsedAuth.username !== credentials.userName) {
        authenticateUser(res);
        return false;
    }

    const ha1 = cryptoUsingMD5(
        `${parsedAuth.username}:${credentials.realm}:${credentials.password}`
    );
    const ha2 = cryptoUsingMD5(`${req.method}:${parsedAuth.uri}`);
    const expectedResponse = cryptoUsingMD5(
        [ha1, parsedAuth.nonce, parsedAuth.nc, parsedAuth.cnonce, parsedAuth.qop, ha2].join(":")
    );
    if (parsedAuth.response !== expectedResponse) {
        authenticateUser(res);
        return false;
    }
    return true;
}

function serveStaticFile(res, filePath, contentType) {
    fs.readFile(filePath, (error, pgResp) => {
        if (error) {
            res.writeHead(404);
            res.end("Error 404: Not Found\nFile not found");
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(pgResp);
        }
    });
}

// Observers Handling
const observers = new Map();
export function subscribeInstaller(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeInstaller(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    for (const callback of observers.values()) {
        callback(eventName, eventData);
    }
}

// Helper Functions
function cryptoUsingMD5(data) {
    return crypt.createHash("md5").update(data).digest("hex");
}

function authenticateUser(res) {
    res.writeHead(401, {
        "WWW-Authenticate": `Digest realm="${
            credentials.realm
        }",qop="auth",nonce="${Math.random()}",opaque="${hash}"`,
    });
    res.end("Authorization is needed.");
}

function parseAuthenticationInfo(authData) {
    let authenticationObj = {};
    for (const d of authData.split(", ")) {
        const [key, value] = d.split("=");
        authenticationObj[key] = value.replace(/"/g, "");
    }
    return authenticationObj;
}
