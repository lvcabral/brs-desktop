/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared constants used across main and renderer processes

// Network services default ports
export const ECP_PORT = 8060;
export const TELNET_PORT = 8085;
export const DEBUG_PORT = 8080;
export const WEB_INSTALLER_PORT = 80;
export const SSDP_PORT = 1900;
// Remote Screen has no Roku counterpart, so the port is ours to pick: 8090 stays clear of
// the four above and of the 8080/8085 pair the debug and telnet services already occupy.
export const REMOTE_SCREEN_PORT = 8090;

// Default Roku authentication credentials
export const DEFAULT_USRPWD = "rokudev";

// BrightScript Home Application
export const BRS_HOME_APP_PATH = "./assets/brs-home.zip";

// Subdirectory of userData holding sideloaded apps' cached icons. Kept separate from the rest
// of userData (settings, window state, recent-files list) because it's the only part of userData
// exposed to the app windows over the "app" protocol (see helpers/protocol.js).
export const ICONS_DIR = "icons";

// Editor temporary file name
export const EDITOR_CODE_BRS = "editor_code.brs";

// Marker file in userData recording that helpers/files.js's migrateLocalStorage() already ran,
// so it doesn't spin up a hidden window on every subsequent launch once there's nothing left to
// migrate from the pre-2.5.0 file:// origin.
export const LOCAL_STORAGE_MIGRATED_MARKER = "local-storage-migrated";

// Maximum package size in MB
export const MAX_PACKAGE_SIZE_MB = 7;

// Update check intervals (in milliseconds)
export const UPDATE_CHECK_STARTUP = 15000; // 15 seconds
export const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
