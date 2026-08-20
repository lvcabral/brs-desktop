/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { protocol } from "electron";
import fs from "node:fs";
import path from "node:path";

// Electron 43 stopped granting `crossOriginIsolated` to file:// documents even with COOP/COEP
// set (electron/electron#50789), which brs-engine's worker needs for `SharedArrayBuffer`. The app
// windows load from this "app" scheme instead — registered "standard"/"secure" like http(s), it
// gets a real origin that COOP/COEP can isolate.
export const APP_SCHEME = "app";
const APP_ORIGIN = `${APP_SCHEME}://simulator`;
// Runtime-written files (helpers/files.js's "saveIcon", e.g.) live in userData, outside the
// webpack output dir `rootDir` serves — this prefix routes to that second root.
const USER_DATA_PREFIX = "/userdata/";

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".zip": "application/zip",
    ".wasm": "application/wasm",
    ".map": "application/json",
    ".txt": "text/plain",
    ".mp4": "video/mp4",
};

// Must run before `app` is ready; registers the scheme's privileges only, no I/O yet.
export function registerAppScheme() {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: APP_SCHEME,
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                corsEnabled: true,
            },
        },
    ]);
}

// Serves `rootDir` (the webpack output dir, `app/`) under the "app" scheme, plus `userDataDir`
// under the `/userdata/` prefix. Must run after `app` is ready.
//
// Stays synchronous (fs.readFileSync, not fs.promises): brs-engine's RoURLTransfer opens its
// XMLHttpRequest with `async = false`, and an async handler here resolves that request with
// `status === 200` but an empty body — `fetch()` to the same URL is unaffected.
export function enableAppProtocol(rootDir, userDataDir) {
    protocol.handle(APP_SCHEME, (request) => {
        const { pathname } = new URL(request.url);
        const decoded = decodeURIComponent(pathname);
        const [baseDir, relative] = decoded.startsWith(USER_DATA_PREFIX)
            ? [userDataDir, decoded.slice(USER_DATA_PREFIX.length)]
            : [rootDir, decoded];
        const filePath = path.normalize(path.join(baseDir, relative));
        if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
            return new Response("Forbidden", { status: 403 });
        }
        try {
            const data = fs.readFileSync(filePath);
            const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
            return new Response(data, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Content-Length": String(data.length),
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch {
            return new Response("Not Found", { status: 404 });
        }
    });
}

export function appUrl(fileName) {
    return `${APP_ORIGIN}/${fileName}`;
}

export function userDataUrl(fileName) {
    return `${APP_ORIGIN}${USER_DATA_PREFIX}${fileName}`;
}
