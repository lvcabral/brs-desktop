/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, dialog, BrowserWindow, shell } from "electron";
import https from "node:https";
import packageInfo from "../../package.json";

let updateAvailable = false;
let latestVersion = null;
let dialogShown = false;

// Function to compare version strings
function compareVersions(current, latest) {
    const currentParts = current.replace("v", "").split(".").map(Number);
    const latestParts = latest.replace("v", "").split(".").map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;

        if (latestPart > currentPart) {
            return 1; // Latest is newer
        } else if (latestPart < currentPart) {
            return -1; // Current is newer
        }
    }
    return 0; // Same version
}

// Show update available dialog
function showUpdateAvailableDialog(version) {
    const mainWindow = BrowserWindow.fromId(1);

    if (!mainWindow || dialogShown) {
        return;
    }

    dialogShown = true;
    dialog
        .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Available",
            message: `A new version (${version}) is available!`,
            detail: "Click 'Download' to visit the releases page and download the latest version.",
            buttons: ["Download", "Later"],
            defaultId: 0,
        })
        .then((result) => {
            if (result.response === 0) {
                // User chose to download - open releases page
                const repoUrl = packageInfo.repository.url.replace(/\.git$/, "");
                shell.openExternal(`${repoUrl}/releases/latest`);
            }
            // Reset flag when dialog is dismissed
            dialogShown = false;
        });
}

// Show no updates available dialog
function showNoUpdatesDialog(version) {
    const mainWindow = BrowserWindow.fromId(1);

    if (!mainWindow) {
        return;
    }

    dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "No Updates Available",
        message: "You're up to date!",
        detail: `You are running the latest version (${version}).`,
        buttons: ["OK"],
    });
}

// Handle version comparison result
function handleVersionCheck(currentVersion, forceCheck, resolve) {
    if (compareVersions(currentVersion, latestVersion) === 1) {
        updateAvailable = true;
        if (!app.isPackaged) {
            console.log(`Update available: ${latestVersion}`);
        }
        showUpdateAvailableDialog(latestVersion);
        resolve({ updateAvailable: true, version: latestVersion });
    } else {
        updateAvailable = false;
        if (!app.isPackaged) {
            console.log("No updates available");
        }
        if (forceCheck) {
            showNoUpdatesDialog(currentVersion);
        }
        resolve({ updateAvailable: false, version: currentVersion });
    }
}

// Process release data from GitHub API
function processReleaseData(data, statusCode, currentVersion, forceCheck, resolve, reject) {
    try {
        const release = JSON.parse(data);

        if (statusCode !== 200 || !release.tag_name) {
            console.error("Failed to fetch release info:", statusCode, data);
            reject(new Error(`HTTP ${statusCode}: ${data}`));
            return;
        }

        latestVersion = release.tag_name;
        if (!app.isPackaged) {
            console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);
        }
        handleVersionCheck(currentVersion, forceCheck, resolve);
    } catch (error) {
        console.error("Error parsing release data:", error);
        reject(error);
    }
}

// Make HTTP request to GitHub API
function fetchLatestRelease(repoUrl, currentVersion, forceCheck, resolve, reject) {
    const options = {
        hostname: "api.github.com",
        path: `/repos/${repoUrl}/releases/latest`,
        method: "GET",
        headers: {
            "User-Agent": "brs-desktop-app",
            Accept: "application/vnd.github.v3+json",
        },
    };

    const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
            data += chunk;
        });

        res.on("end", () => {
            processReleaseData(data, res.statusCode, currentVersion, forceCheck, resolve, reject);
        });
    });

    req.on("error", (error) => {
        console.error("Error checking for updates:", error);
        reject(error);
    });

    req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
    });

    req.end();
}

// Function to check for updates via GitHub API
export function checkForUpdates(forceCheck = false) {
    if (!app.isPackaged) {
        console.log("Checking for updates...");
    }

    return new Promise((resolve, reject) => {
        const repoUrl = packageInfo.repository.url
            .replace(/^https?:\/\/github\.com\//, "")
            .replace(/\.git$/, "");
        const currentVersion = "v" + packageInfo.version;

        fetchLatestRelease(repoUrl, currentVersion, forceCheck, resolve, reject);
    });
}

export function getUpdateStatus() {
    return {
        updateAvailable,
        latestVersion,
    };
}
