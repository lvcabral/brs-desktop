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
    // `w` belongs here with the other value-taking options: left undeclared, minimist
    // infers the type, so a bare `-w` becomes boolean true and `-w 8080` a number.
    string: ["o", "p", "m", "w"],
    boolean: ["b", "c", "d", "e", "f", "r", "s"],
    alias: {
        b: "debug",
        c: "console",
        d: "devtools",
        e: "ecp",
        f: "fullscreen",
        w: "web",
        p: "pwd",
        m: "mode",
        r: "rc",
        s: "screen",
    },
};
