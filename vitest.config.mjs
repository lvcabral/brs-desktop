/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";
import path from "node:path";

const mock = (name) => path.resolve(import.meta.dirname, "test/mocks", name);

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        include: ["test/**/*.spec.js"],
        setupFiles: ["./test/setup/global.js"],
        // Real sockets are used by the integration suites; forks gives each spec file its
        // own process so module-level server state can never leak between files.
        pool: "forks",
        testTimeout: 10000,
        hookTimeout: 10000,
        // Electron is never loaded. These aliases only rewrite bare imports inside
        // transformed files (src/** and test/**); packages under node_modules keep
        // resolving the real thing, which is why electron-preferences needs its own
        // entry (it destructures the electron namespace at module scope).
        alias: {
            electron: mock("electron.js"),
            "@electron/remote/main": mock("electron-remote-main.js"),
            "@electron/remote": mock("electron-remote.js"),
            "@lvcabral/node-ssdp": mock("node-ssdp.js"),
            "@lvcabral/electron-preferences": mock("electron-preferences.js"),
            network: mock("network.js"),
            // These two resolve Electron's main-process exports through @electron/remote
            // at module load and throw outside a real Electron runtime.
            "electron-prompt": mock("electron-prompt.js"),
            "electron-about-window": mock("electron-about-window.js"),
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.js"],
            // Webpack entry points with module-scope side effects; not unit testable.
            exclude: [
                "src/main.js",
                "src/app/app.js",
                "src/app/editor.js",
                "src/app/monaco.js",
            ],
        },
    },
});
