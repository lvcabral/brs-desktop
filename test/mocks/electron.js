/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for the `electron` module, wired up by the alias list in `vitest.config.mjs`.
 *
 * It exports every name imported anywhere under `src/` (app, BrowserWindow, clipboard,
 * contextBridge, dialog, ipcMain, ipcRenderer, Menu, nativeTheme, screen, session, shell)
 * plus a handful of test-only helpers prefixed with `__`.
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

// --- window registry --------------------------------------------------------

const windows = new Map();

/**
 * Build a fake BrowserWindow. `webContents.send` is a spy that also appends to a
 * `sent` log, so specs can assert on IPC pushes without reaching into mock internals.
 * @param {number} id - The window id; the simulator window is always 1
 * @returns {object} - The fake window
 */
export function createFakeWindow(id = 1) {
    const sent = [];
    return {
        id,
        sent,
        sentOn: (channel) => sent.filter((msg) => msg.channel === channel),
        webContents: {
            send: vi.fn((channel, ...args) => sent.push({ channel, args })),
            on: vi.fn(),
            once: vi.fn(),
            openDevTools: vi.fn(),
            closeDevTools: vi.fn(),
            isDevToolsOpened: vi.fn(() => false),
            getURL: vi.fn(() => "file:///index.html"),
            setWindowOpenHandler: vi.fn(),
            capturePage: vi.fn(() => Promise.resolve({ toPNG: () => Buffer.alloc(0) })),
        },
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1280, height: 770 })),
        setBounds: vi.fn(),
        getSize: vi.fn(() => [1280, 770]),
        setSize: vi.fn(),
        setMinimumSize: vi.fn(),
        setAspectRatio: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        isAlwaysOnTop: vi.fn(() => false),
        setFullScreen: vi.fn(),
        isFullScreen: vi.fn(() => false),
        setMenuBarVisibility: vi.fn(),
        setResizable: vi.fn(),
        isMinimized: vi.fn(() => false),
        isMaximized: vi.fn(() => false),
        isVisible: vi.fn(() => true),
        isDestroyed: vi.fn(() => false),
        show: vi.fn(),
        hide: vi.fn(),
        focus: vi.fn(),
        blur: vi.fn(),
        restore: vi.fn(),
        reload: vi.fn(),
        close: vi.fn(),
        destroy: vi.fn(),
        loadURL: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
        once: vi.fn(),
    };
}

/**
 * Register a fake window so `BrowserWindow.fromId()` can resolve it
 * @param {object} win - The fake window to register
 * @returns {object} - The same window, for chaining
 */
export function __registerWindow(win) {
    windows.set(win.id, win);
    return win;
}

/**
 * Reset all mutable mock state; called from the global `beforeEach`
 */
export function __resetElectronMock() {
    windows.clear();
    nativeTheme.shouldUseDarkColors = false;
    nativeTheme.themeSource = "system";
    app.applicationMenu = makeDefaultApplicationMenu();
    // Deliberately NOT removing ipcMain listeners: modules such as src/server/ecp.js and
    // src/helpers/files.js register theirs at module-evaluation time and have no way to
    // register again. Clearing them here would silently disable the code under test.
    // The forks pool already isolates spec files from each other; a test that needs a
    // clean slate should call ipcMain.removeAllListeners(channel) for its own channel.
}

/**
 * Electron ships a default application menu, so `app.applicationMenu` is already populated
 * before any `Menu.setApplicationMenu()` call. `rebuildMenu()` in src/menu/menuService.js
 * reads it unguarded, so starting from null here would fail in a way the real app cannot.
 * @returns {object} - An empty built menu
 */
function makeDefaultApplicationMenu() {
    return {
        template: [],
        items: [],
        getMenuItemById: () => undefined,
        popup: vi.fn(),
        closePopup: vi.fn(),
    };
}

// --- app --------------------------------------------------------------------

// Normally set by test/setup/global.js. The fallback creates a private directory via
// mkdtemp rather than naming a fixed path under the shared temp directory: a predictable
// name in a world-writable location is both a hazard and a way for one run to observe
// another's leftovers. mkdtemp gives a unique name with owner-only permissions.
// The fallback matters for specs that call vi.resetModules(), which hands them a fresh
// copy of this module that the setup file has not initialised.
let userDataPath;

export const app = {
    getName: vi.fn(() => "BrightScript Simulator"),
    getVersion: vi.fn(() => "2.3.0"),
    getPath: vi.fn(() => {
        userDataPath ??= fs.mkdtempSync(path.join(os.tmpdir(), "brs-desktop-mock-"));
        return userDataPath;
    }),
    getLocale: vi.fn(() => "en-US"),
    isPackaged: false,
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    applicationMenu: makeDefaultApplicationMenu(),
    /**
     * Point `app.getPath()` at a throwaway directory so tests never touch the real profile
     * @param {string} dir - The directory to use
     */
    __setUserData(dir) {
        userDataPath = dir;
    },
};

// --- BrowserWindow ----------------------------------------------------------

export class BrowserWindow {
    constructor(options = {}) {
        Object.assign(this, createFakeWindow(windows.size + 1), options);
        __registerWindow(this);
    }
    static fromId(id) {
        return windows.get(id) ?? null;
    }
    static fromWebContents(contents) {
        return [...windows.values()].find((win) => win.webContents === contents) ?? null;
    }
    static getAllWindows() {
        return [...windows.values()];
    }
}

// --- ipcMain ----------------------------------------------------------------

/**
 * A real EventEmitter, so specs can drive registered handlers directly with
 * `ipcMain.emit("addRecentPackage", {}, payload)`.
 */
class IpcMainMock extends EventEmitter {
    handle = vi.fn();
    handleOnce = vi.fn();
    removeHandler = vi.fn();
}

export const ipcMain = new IpcMainMock();
// console.js and settings.js both listen on "telnet"; the default limit of 10 is tight
// once several modules are imported in the same spec file.
ipcMain.setMaxListeners(50);

// --- everything else --------------------------------------------------------

export const nativeTheme = {
    shouldUseDarkColors: false,
    themeSource: "system",
    on: vi.fn(),
};

const defaultDisplay = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
};

export const screen = {
    getAllDisplays: vi.fn(() => [defaultDisplay]),
    getPrimaryDisplay: vi.fn(() => defaultDisplay),
    getDisplayNearestPoint: vi.fn(() => defaultDisplay),
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    /**
     * Replace the display list to exercise multi-monitor branches
     * @param {object[]} displays - The displays to report
     */
    __setDisplays(displays) {
        screen.getAllDisplays.mockReturnValue(displays);
        screen.getPrimaryDisplay.mockReturnValue(displays[0]);
    },
};

export const dialog = {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 1 })),
    showMessageBoxSync: vi.fn(() => 1),
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: "" })),
    showErrorBox: vi.fn(),
};

/**
 * Walk a menu template looking for an item by id, descending into submenus
 * @param {object[]} template - The menu template to search
 * @param {string} id - The item id to find
 * @returns {object|undefined} - The matching item, mutable in place
 */
function findItemById(template, id) {
    for (const item of template ?? []) {
        if (item.id === id) {
            return item;
        }
        const found = findItemById(item.submenu, id);
        if (found) {
            return found;
        }
    }
    return undefined;
}

/**
 * Give every submenu in a template a `getMenuItemById`, the way Electron does.
 *
 * In Electron a MenuItem's `submenu` is a Menu instance, not the plain array from the
 * template, so code can chain `getMenuItemById("x").submenu.getMenuItemById("y")` — which
 * src/menu/menuService.js does on every platform except macOS. The method is defined
 * non-enumerably and in place, so the arrays stay arrays for the code paths that index
 * them positionally, and mutations still land on the original template objects that the
 * tests assert against.
 * @param {object[]} template - The menu template to augment, recursively
 * @returns {object[]} - The same template
 */
function addSubmenuLookup(template) {
    if (!Array.isArray(template) || Object.hasOwn(template, "getMenuItemById")) {
        return template;
    }
    Object.defineProperty(template, "getMenuItemById", {
        value: (id) => findItemById(template, id),
        enumerable: false,
        configurable: true,
    });
    for (const item of template) {
        addSubmenuLookup(item?.submenu);
    }
    return template;
}

export const Menu = {
    buildFromTemplate: vi.fn((template) => ({
        template: addSubmenuLookup(template),
        items: template,
        getMenuItemById: (id) => findItemById(template, id),
        popup: vi.fn(),
        closePopup: vi.fn(),
    })),
    setApplicationMenu: vi.fn((menu) => {
        app.applicationMenu = menu;
    }),
    getApplicationMenu: vi.fn(() => app.applicationMenu),
};

export const clipboard = {
    readText: vi.fn(() => ""),
    writeText: vi.fn(),
    writeImage: vi.fn(),
};

export const shell = {
    openExternal: vi.fn(() => Promise.resolve()),
    openPath: vi.fn(() => Promise.resolve("")),
    showItemInFolder: vi.fn(),
};

export const session = {
    defaultSession: {
        webRequest: { onHeadersReceived: vi.fn() },
        clearCache: vi.fn(() => Promise.resolve()),
    },
};

export const contextBridge = { exposeInMainWorld: vi.fn() };

export const ipcRenderer = new EventEmitter();
ipcRenderer.send = vi.fn();
ipcRenderer.invoke = vi.fn(() => Promise.resolve());

export const nativeImage = {
    createFromPath: vi.fn(() => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) })),
    createFromBuffer: vi.fn(() => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) })),
};

export default {
    app,
    BrowserWindow,
    clipboard,
    contextBridge,
    dialog,
    ipcMain,
    ipcRenderer,
    Menu,
    nativeImage,
    nativeTheme,
    screen,
    session,
    shell,
};
