/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrowserWindow, ipcMain } from "electron";
import { isLocalhostAddress } from "../helpers/util";
import { REMOTE_SCREEN_PORT, ECP_PORT } from "../constants";
import { isECPEnabled } from "./ecp";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const WebSocket = require("ws");
const url = require("node:url");

// Bundled, this module lives at app/main.js so __dirname is app/, alongside the copied
// web/ and css/ directories. Loaded directly from source -- by the tests -- __dirname is
// src/server/ and the same assets sit in src/app/. Resolve once, preferring the bundled
// layout, so both arrangements use one code path. Same approach as src/server/ecp.js;
// src/server/installer.js uses bare __dirname and consequently cannot serve its pages
// under vitest at all.
const ASSET_BASE =
    [__dirname, path.join(__dirname, "..", "app")].find((base) => fs.existsSync(path.join(base, "web"))) ?? __dirname;

// Every viewer is a full encode of the video track, so the cap is about protecting the
// simulator's frame rate rather than about security.
const MAX_VIEWERS = 4;
// A viewer that sends more than this in one paste is almost certainly not a person typing.
const MAX_PASTE_BYTES = 4096;
const SIGNALING_PATH = "/rtc-session";
// Sent with the close frame when the viewer cap is reached, so the page can explain itself
// instead of showing a generic disconnect. 4000-4999 is the range reserved for applications.
const CLOSE_CODE_BUSY = 4000;

/**
 * Rejects requests issued by a page from another origin.
 *
 * The local-only toggle filters by source address, which is not enough on its own: a page on any
 * website the user happens to be visiting can open ws://127.0.0.1:<port>/rtc-session (WebSockets
 * are exempt from CORS) or POST to /paste with no preflight (a body-only POST is a CORS-safelisted
 * simple request). Both arrive *from loopback*, so an address check waves them through -- the
 * first hands that page the live video of the screen, the second lets it type into the running
 * app. The opaque response does not help, because the damage is the side effect, not the reply.
 *
 * Treating a missing Origin as allowed is deliberate: browsers always send it on both of the
 * routes this guards, while non-browser clients (curl, a test harness) legitimately omit it and
 * are not the confused deputy this defends against.
 * @param {import("node:http").IncomingMessage} req - The request or upgrade
 * @returns {boolean} - True when the request did not come from a foreign origin
 */
function isSameOrigin(req) {
    const origin = req.headers?.origin;
    if (!origin) {
        return true;
    }
    let host;
    try {
        host = new URL(origin).host;
    } catch {
        return false; // unparseable Origin is not something a legitimate viewer sends
    }
    return host === req.headers.host;
}

// A lookup table rather than an if/else chain, so adding an asset is one line.
// styles.min.css is the same Roku-themed skin the web installer serves on port 80, so the two
// pages look like one application; remote.css only adds what that skin has no equivalent for.
// It sits in css/ rather than web/, next to it under both the bundled and the source layout.
const STATIC_ASSETS = {
    "/": { file: ["web", "remote.html"], type: "text/html" },
    "/index.html": { file: ["web", "remote.html"], type: "text/html" },
    "/css/styles.min.css": { file: ["css", "styles.min.css"], type: "text/css" },
    "/remote.css": { file: ["web", "remote.css"], type: "text/css" },
    "/remote.js": { file: ["web", "remote.js"], type: "text/javascript" },
    // The WebRTC protocol, shared by the viewer and the embed page so there is one copy of it.
    "/signaling.js": { file: ["web", "signaling.js"], type: "text/javascript" },
    // The video on its own, for dropping into an <iframe> in someone else's app. A page rather
    // than a stream URL because WebRTC has no such thing: the media is SRTP over UDP, set up by
    // the /rtc-session WebSocket, so there is nothing a <video src> could point at.
    "/embed": { file: ["web", "embed.html"], type: "text/html" },
    "/embed.js": { file: ["web", "embed.js"], type: "text/javascript" },
};

let server;
let wss;
let window;
let localOnly = false;
let screenPort = REMOTE_SCREEN_PORT;
let sessionSeq = 0;
// sessionId -> ws. The renderer addresses viewers by this id, so the map is the only thing
// that knows how to turn an id back into a socket.
const sessions = new Map();

let screenEnabled = false;

/**
 * Whether the service is listening.
 *
 * A function where the other services in this directory export a mutable `let` (`isECPEnabled` and
 * friends): those are live bindings that only work because every consumer re-reads them, which is
 * easy to break by destructuring or caching. The siblings are left alone rather than churned for
 * consistency's sake.
 * @returns {boolean} - True while the server is bound
 */
export function isRemoteScreenEnabled() {
    return screenEnabled;
}

/**
 * The port the service actually bound, which differs from the requested one when port 0 was
 * used. Read by the web installer, whose Utilities page links here.
 * @returns {number} - The listening port
 */
export function getRemoteScreenPort() {
    return screenPort;
}

/**
 * Relays a signaling message from the renderer to the viewer it is addressed to. Registered
 * at module scope because ipcMain handlers cannot be re-registered once removed, matching
 * how src/server/ecp.js handles "currentApp".
 */
ipcMain.on("rtcSignal", (_, data) => {
    const ws = sessions.get(data?.sessionId);
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
});

/**
 * Re-announces every open session once the renderer is ready to offer.
 *
 * "rtcViewerJoined" is fire-and-forget: if it is sent before the renderer has registered its
 * handler -- a viewer reconnecting into the gap after dom-ready drops the sockets, or a page
 * already open when the app starts -- it is silently dropped, and since offers are only ever sent
 * on join, that viewer waits forever on a socket that will never carry an offer. The renderer
 * announcing itself closes that window from the other side.
 */
ipcMain.on("rtcReady", () => {
    for (const sessionId of sessions.keys()) {
        window?.webContents.send("rtcViewerJoined", { sessionId });
    }
});

/**
 * Drops a session whose peer connection died in the renderer. Without this the socket stays open
 * around a dead connection: nothing renegotiates, and the viewer holds one of MAX_VIEWERS slots
 * until its tab is closed. Closing the socket makes the page reconnect and negotiate afresh.
 */
ipcMain.on("rtcSessionFailed", (_, data) => {
    const ws = sessions.get(data?.sessionId);
    if (ws) {
        ws.close();
        dropSession(data.sessionId);
    }
});

/**
 * Closes the viewer sessions opened from other machines. The upgrade handler only filters
 * new connections, so a session established while remote access was allowed would otherwise
 * keep streaming the screen after the user turned it off.
 */
function destroyRemoteSessions() {
    for (const [sessionId, ws] of sessions) {
        if (!isLocalhostAddress(ws.remoteAddress)) {
            ws.terminate();
            dropSession(sessionId);
        }
    }
}

/**
 * Turns Electron's background throttling on or off for the simulator window.
 *
 * Throttling is on by default, so when the window is minimized or fully occluded Chromium
 * throttles requestAnimationFrame and compositing to near zero -- exactly when someone is most
 * likely watching remotely. BrightScript execution is unaffected (the engine runs in a worker
 * over SharedArrayBuffer), but the paint stalls, so the mirror canvas stops updating and the
 * stream freezes on a stale frame.
 *
 * Scoped to this service rather than set once at window creation: it costs idle CPU on a
 * minimized window, and there is no reason to pay that for users who never enable streaming.
 * @param {boolean} enabled - True to allow throttling, false to keep painting when hidden
 */
function setBackgroundThrottling(enabled) {
    // Guarded because the setter arrived in Electron 12 and is absent from some test doubles.
    window?.webContents?.setBackgroundThrottling?.(enabled);
}

/**
 * Forgets a session and tells the renderer to tear down its peer connection.
 * @param {string} sessionId - The session to drop
 */
function dropSession(sessionId) {
    if (sessions.delete(sessionId)) {
        window?.webContents.send("rtcViewerLeft", { sessionId });
        if (sessions.size === 0) {
            setBackgroundThrottling(true);
        }
    }
}

/**
 * Drops every viewer. Called on shutdown and whenever the renderer reloads: the peer
 * connections live in the page, so they die with it and the sockets would otherwise sit
 * there holding a frozen frame.
 */
export function dropAllSessions() {
    for (const ws of sessions.values()) {
        ws.close();
    }
    sessions.clear();
    setBackgroundThrottling(true);
}

export function setRemoteScreenLocalOnly(value) {
    localOnly = value;
    if (!screenEnabled) return;
    if (localOnly) {
        destroyRemoteSessions();
    }
}

export function enableRemoteScreen(win, port = REMOTE_SCREEN_PORT, { localOnly: lo = false } = {}) {
    if (screenEnabled) {
        return; // already started do nothing
    }
    localOnly = lo;
    screenPort = port;
    window = win ?? BrowserWindow.fromId(1);
    server = http
        .createServer(function (req, res) {
            if (localOnly && !isLocalhostAddress(req.socket.remoteAddress)) {
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }
            handleRequest(req, res);
        })
        .listen(port, () => {
            // Report the port actually bound, which differs from the requested one when
            // port 0 was used to let the OS choose.
            screenPort = server.address().port;
            screenEnabled = true;
            attachSignaling();
            notifyAll("enabled", { enabled: true, port: screenPort });
        });
    server.on("error", (e) => {
        if (e.code === "EADDRINUSE") {
            screenEnabled = false;
        }
        window?.webContents.send("console", `Remote Screen server error:${e.message}`, true);
    });
}

export function disableRemoteScreen() {
    if (screenEnabled) {
        dropAllSessions();
        if (wss) {
            wss.close();
            wss = undefined;
        }
        if (server) {
            server.close();
            server = undefined;
        }
        screenEnabled = false;
        notifyAll("enabled", { enabled: false, port: screenPort });
    }
}

/**
 * Attaches the signaling WebSocket server to the running HTTP server. Uses noServer plus a
 * manual upgrade handler so one port serves both the viewer page and the signaling channel.
 */
function attachSignaling() {
    wss = new WebSocket.Server({ noServer: true });
    wss.on("connection", function connection(ws, request) {
        if (sessions.size >= MAX_VIEWERS) {
            ws.send(JSON.stringify({ type: "busy", maxViewers: MAX_VIEWERS }));
            ws.close(CLOSE_CODE_BUSY, "Too many viewers");
            return;
        }
        // Kept on the socket so a later switch to local-only can tell which sessions came
        // from the network without reaching into the ws library internals.
        ws.remoteAddress = request.socket.remoteAddress;
        sessionSeq++;
        const sessionId = `s${sessionSeq}`;
        sessions.set(sessionId, ws);
        ws.on("message", function incoming(message) {
            processSignal(sessionId, message);
        });
        ws.on("close", function closed() {
            dropSession(sessionId);
        });
        ws.on("error", function errored() {
            dropSession(sessionId);
        });
        ws.send(JSON.stringify({ type: "hello", sessionId }));
        // Keep painting while someone is watching, even if the window is minimized.
        setBackgroundThrottling(false);
        // The renderer owns the media track, so it is the offerer: telling it a viewer
        // arrived is what kicks off the exchange.
        window?.webContents.send("rtcViewerJoined", { sessionId });
    });
    server.on("upgrade", function upgrade(request, socket, head) {
        if (localOnly && !isLocalhostAddress(request.socket.remoteAddress)) {
            socket.destroy();
            return;
        }
        // No legitimate viewer is cross-origin: the page is served from this very port.
        if (!isSameOrigin(request)) {
            socket.destroy();
            return;
        }
        if (url.parse(request.url).pathname === SIGNALING_PATH) {
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit("connection", ws, request);
            });
        } else {
            socket.destroy();
        }
    });
}

/**
 * Forwards an answer or ICE candidate from a viewer to the renderer. The sessionId is added
 * here rather than trusted from the message, so a viewer cannot address another's session.
 * @param {string} sessionId - The session the message arrived on
 * @param {Buffer|string} message - The raw frame
 */
export function processSignal(sessionId, message) {
    let msg;
    try {
        msg = JSON.parse(message);
    } catch {
        console.warn("invalid remote screen signal:", message?.toString());
        return;
    }
    if (msg.type === "answer" || msg.type === "candidate") {
        window?.webContents.send("rtcSignal", { ...msg, sessionId });
    }
}

/**
 * Routes a viewer HTTP request.
 * @param {import("node:http").IncomingMessage} req - The request
 * @param {import("node:http").ServerResponse} res - The response
 */
function handleRequest(req, res) {
    const urlPath = req.url.split("?")[0];
    if (req.method === "POST" && urlPath === "/paste") {
        handlePaste(req, res);
        return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end(req.method === "HEAD" ? undefined : "Error 405: Method Not Allowed");
        return;
    }
    if (urlPath === "/config") {
        serveConfig(req, res);
        return;
    }
    const asset = STATIC_ASSETS[urlPath];
    if (asset) {
        serveStaticFile(req, res, path.join(ASSET_BASE, ...asset.file), asset.type);
        return;
    }
    res.writeHead(404);
    res.end(req.method === "HEAD" ? undefined : "Error 404: Not Found\nFile not found");
}

/**
 * The address another machine on the LAN should use to reach this service.
 *
 * The viewer page cannot work this out for itself: opened from the status bar it is on
 * localhost, so `location.origin` yields an address that is useless to anyone else -- which is
 * the whole point of showing an address to copy. deviceInfo.localIps holds "<iface>,<address>"
 * entries, and the first is the one main.js already advertises as the device's connection info,
 * so using it keeps this link and ECP/SSDP naming the same interface.
 *
 * Returns null when the service is restricted to localhost, because then a LAN address is a
 * link to something that would refuse the connection.
 * @returns {string|null} - The host to embed in the copyable URL, or null to use the page's own
 */
function getLanHost() {
    if (localOnly) {
        return null;
    }
    const entry = globalThis.sharedObject?.deviceInfo?.localIps?.[0];
    const address = entry?.split(",")[1];
    return address && !isLocalhostAddress(address) ? address : null;
}

/**
 * Serves the settings the viewer page needs to build itself. ECP state is included because
 * the page drives the remote buttons with no-cors requests and therefore cannot see whether
 * they landed -- this is its only way to warn that the remote will do nothing.
 * @param {import("node:http").IncomingMessage} req - The request
 * @param {import("node:http").ServerResponse} res - The response
 */
export function serveConfig(req, res) {
    const body = JSON.stringify({
        ecpPort: ECP_PORT,
        ecpEnabled: isECPEnabled,
        displayMode: globalThis.sharedObject?.deviceInfo?.displayMode ?? "720p",
        maxViewers: MAX_VIEWERS,
        // Both are needed to build the embed URL: the page may be on localhost, and the bound
        // port differs from the constant when port 0 was used.
        lanHost: getLanHost(),
        port: screenPort,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(req.method === "HEAD" ? undefined : body);
}

/**
 * Receives text typed in the viewer and replays it into the simulator. Reuses the renderer's
 * existing "pasteText" handler, which already converts newlines to "enter", maps every other
 * character to a Lit_ keypress and paces the queue. Deliberately not routed through ECP:
 * restana does not percent-decode path params, so /keypress/lit_%20 arrives undecoded and the
 * engine rejects it as a multi-character key.
 * @param {import("node:http").IncomingMessage} req - The request
 * @param {import("node:http").ServerResponse} res - The response
 */
function handlePaste(req, res) {
    // A body-only POST needs no preflight, so without this any website could type into the
    // running app while the user is looking at something else entirely.
    if (!isSameOrigin(req)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }
    // Chunks are collected as Buffers and decoded once at the end: a multi-byte UTF-8 character
    // can straddle a TCP chunk boundary, and decoding each chunk on its own turns it into
    // replacement characters, which would then be typed into the app as the wrong keypresses.
    const chunks = [];
    let length = 0;
    let aborted = false;
    req.on("data", (chunk) => {
        if (aborted) {
            return;
        }
        chunks.push(chunk);
        length += chunk.length;
        if (length > MAX_PASTE_BYTES) {
            aborted = true;
            // Closing the connection rather than destroying the socket: req.destroy() can discard
            // the still-buffered response, so the viewer would see a network error instead of the
            // 413 its "Text too long" message is keyed to.
            res.writeHead(413, { Connection: "close" });
            res.end("Payload Too Large");
        }
    });
    req.on("end", () => {
        if (aborted) {
            return;
        }
        const body = Buffer.concat(chunks).toString("utf8");
        if (body.length > 0) {
            window?.webContents.send("pasteText", body);
        }
        res.writeHead(204);
        res.end();
    });
}

/**
 * Reads a bundled asset from disk and writes it out.
 * @param {import("node:http").IncomingMessage} req - The request
 * @param {import("node:http").ServerResponse} res - The response
 * @param {string} filePath - Absolute path to the asset
 * @param {string} contentType - The Content-Type to report
 */
function serveStaticFile(req, res, filePath, contentType) {
    fs.readFile(filePath, function (err, content) {
        if (err) {
            res.writeHead(404);
            res.end(req.method === "HEAD" ? undefined : "Error 404: Not Found\nFile not found");
            return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(req.method === "HEAD" ? undefined : content);
    });
}

// Observers Handling
const observers = new Map();
export function subscribeRemoteScreen(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeRemoteScreen(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    for (const callback of observers.values()) {
        callback(eventName, eventData);
    }
}
