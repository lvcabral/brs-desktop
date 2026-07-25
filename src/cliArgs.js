/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// minimist configuration for the command line documented in docs/how-to-use.md.
// Extracted from main.js, which has no exports and performs Electron work at module scope.
export const cliArgumentsConfig = {
    string: ["o", "p", "m"],
    boolean: ["c", "d", "e", "f", "r"],
    alias: {
        c: "console",
        d: "devtools",
        e: "ecp",
        f: "fullscreen",
        w: "web",
        p: "pwd",
        m: "mode",
        r: "rc",
    },
};
