/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow } from "electron";
import { WEB_INSTALLER_PORT, DEFAULT_USRPWD } from "../constants";
import { isLocalhostAddress } from "../helpers/util";
import { cryptoUsingMD5, parseAuthenticationInfo, computeDigestResponse } from "../helpers/digest";
import { isRemoteScreenEnabled, getRemoteScreenPort } from "./remotescreen";
import Busboy from "busboy";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const credentials = {
    userName: DEFAULT_USRPWD,
    password: DEFAULT_USRPWD,
    realm: app.getName(),
};
let port = WEB_INSTALLER_PORT;
let server;
let hash;
let localOnly = false;
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
export function setInstallerLocalOnly(value) {
    localOnly = value;
}
export function enableInstaller(win, { localOnly: lo = false } = {}) {
    if (isInstallerEnabled) {
        return; // already started do nothing
    }
    localOnly = lo;
    const window = win ?? BrowserWindow.fromId(1);
    hash = cryptoUsingMD5(credentials.realm);
    server = http
        .createServer(function (req, res) {
            if (localOnly && !isLocalhostAddress(req.socket.remoteAddress)) {
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }
            // Skip authentication for image endpoints - they're accessed from already authenticated pages
            const urlPath = req.url.split("?")[0];
            if (urlPath === "/pkgs/dev.png" || urlPath === "/pkgs/dev.jpg") {
                serveImage(req, res);
                return;
            }

            // Digest Authentication
            if (!performDigestAuth(req, res)) {
                return;
            }

            if (req.method === "POST") {
                handlePostRequest(req, res, window);
            } else if (req.method === "GET" || req.method === "HEAD") {
                let filePath = "";
                let contentType = "";

                if (urlPath === "/css/styles.min.css") {
                    filePath = path.join(__dirname, "css", "styles.min.css");
                    contentType = "text/css";
                } else if (urlPath === "/" || urlPath === "/index.html" || urlPath === "/plugin_install") {
                    filePath = path.join(__dirname, "web", "installer.html");
                    contentType = "text/html";
                } else if (urlPath === "/plugin_inspect") {
                    // Built rather than served verbatim: the Remote Screen button depends on
                    // whether that service is running right now, and on the port it bound.
                    serveUtilitiesPage(req, res);
                    return;
                }
                // Note: /pkgs/dev.png is handled at the top without authentication
                if (filePath === "") {
                    res.writeHead(404);
                    res.end(req.method === "HEAD" ? undefined : "Error 404: Not Found\nFile not found");
                } else {
                    serveStaticFile(req, res, filePath, contentType);
                }
            }
        })
        .listen(port, () => {
            // Report the port actually bound, which differs from the requested one when
            // port 0 was used to let the OS choose.
            port = server.address().port;
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
        handlePostResponse(res, done, fileSize, fileError, req.headers.host);
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

export function handlePostResponse(res, done, fileSize, fileError, host) {
    if (done === "screenshot") {
        handleScreenshotResponse(res, host);
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

const REMOTE_SCREEN_PLACEHOLDER = "<!--REMOTE_SCREEN_BUTTON-->";

/**
 * Validates a Host header for use as a hostname inside an href.
 *
 * The header is supplied by the client and the value it yields is interpolated into an attribute,
 * so it is checked against an allow-list rather than escaped: anything that could close the
 * attribute, start another one, or graft a path onto the URL is rejected outright. Returning null
 * suppresses the link, which is the safe direction to fail in -- the page is still valid without it.
 * @param {string|undefined} host - The raw Host header
 * @returns {string|null} - The hostname, or null when it cannot be trusted
 */
export function safeHostname(host) {
    if (!host) {
        return null;
    }
    // IPv6 literals are bracketed and contain the colons the port split would otherwise trip on.
    const bracketed = /^\[[0-9A-Fa-f:.]+\]/.exec(host);
    if (bracketed) {
        return bracketed[0];
    }
    const hostname = host.split(":")[0];
    return /^[A-Za-z0-9.-]+$/.test(hostname) ? hostname : null;
}

/**
 * Builds the Utilities tab's link to the Remote Screen viewer.
 *
 * Absolute rather than relative because the viewer is on another port, and built from the host the
 * client used rather than from localhost so that someone browsing the installer from a phone is
 * sent back to the simulator instead of to their own loopback.
 * @param {boolean} enabled - Whether the Remote Screen service is running
 * @param {number} port - The port it bound
 * @param {string|null} hostname - The validated hostname the client reached this server on
 * @returns {string} - The HTML fragment, empty when there is nothing to link to
 */
export function buildRemoteScreenHtml(enabled, port, hostname) {
    if (!enabled || !hostname) {
        return "";
    }
    return `
                            <div class="Roku-Form" style="margin-top: 20px;">
                                <a class="roku-button" href="http://${hostname}:${port}/" target="_blank" rel="noopener" style="max-width: 240px;">Video Stream</a>
                            </div>`;
}

/**
 * Substitutes the request-time parts of the Utilities page into its template.
 * @param {string} html - The page as read from disk
 * @param {string|undefined} host - The request's Host header
 * @returns {string} - The rendered page
 */
function renderUtilitiesPage(html, host) {
    return html.replace(
        REMOTE_SCREEN_PLACEHOLDER,
        buildRemoteScreenHtml(isRemoteScreenEnabled, getRemoteScreenPort(), safeHostname(host))
    );
}

/**
 * Serves the Utilities page.
 * @param {import("node:http").IncomingMessage} req - The request
 * @param {import("node:http").ServerResponse} res - The response
 */
function serveUtilitiesPage(req, res) {
    const utilitiesPath = path.join(__dirname, "web", "utilities.html");
    fs.readFile(utilitiesPath, "utf8", (error, html) => {
        if (error) {
            res.writeHead(500);
            res.end("Error 500: Internal Server Error\nCould not read utilities page!");
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(req.method === "HEAD" ? undefined : renderUtilitiesPage(html, req.headers.host));
    });
}

function handleScreenshotResponse(res, host) {
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
            const modifiedHtml = renderUtilitiesPage(html, host).replace(
                "</div>\n                    </div>\n                </main>",
                `${contentDiv}\n                    </div>\n                </main>`
            );
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(modifiedHtml);
        });
    }, 1000);
}

export function buildScreenshotHtml(screenshotExists) {
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

export function buildInstallHtml(fileSize, fileError) {
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
function serveImage(req, res) {
    const filePath = path.join(app.getPath("userData"), "dev.png");
    fs.readFile(filePath, (error, pgResp) => {
        if (error) {
            res.writeHead(404);
            res.end(req.method === "HEAD" ? undefined : "Error 404: Not Found\nFile not found");
        } else {
            res.writeHead(200, { "Content-Type": "image/png" });
            res.end(req.method === "HEAD" ? undefined : pgResp);
        }
    });
}

function performDigestAuth(req, res) {
    if (!req.headers.authorization) {
        authenticateUser(req, res);
        return false;
    }
    const authInfo = req.headers.authorization.replace(/^Digest /, "");
    const parsedAuth = parseAuthenticationInfo(authInfo);
    if (parsedAuth.username !== credentials.userName) {
        authenticateUser(req, res);
        return false;
    }

    const expectedResponse = computeDigestResponse({
        ...parsedAuth,
        realm: credentials.realm,
        password: credentials.password,
        method: req.method,
    });
    if (parsedAuth.response !== expectedResponse) {
        authenticateUser(req, res);
        return false;
    }
    return true;
}

function serveStaticFile(req, res, filePath, contentType) {
    fs.readFile(filePath, (error, pgResp) => {
        if (error) {
            res.writeHead(404);
            res.end(req.method === "HEAD" ? undefined : "Error 404: Not Found\nFile not found");
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(req.method === "HEAD" ? undefined : pgResp);
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

function authenticateUser(req, res) {
    // The challenge nonce has to be unpredictable: a Math.random() value is guessable, which lets a
    // client precompute digest responses. Matches the cnonce generation in helpers/digest.js.
    const nonce = crypto.randomBytes(16).toString("hex");
    res.writeHead(401, {
        "WWW-Authenticate": `Digest realm="${credentials.realm}",qop="auth",nonce="${nonce}",opaque="${hash}"`,
    });
    res.end(req.method === "HEAD" ? undefined : "Authorization is needed.");
}
