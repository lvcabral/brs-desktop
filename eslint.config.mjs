/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";

// Ported from the brs-engine .eslintrc.js. The @typescript-eslint rules there have no
// meaning in a JavaScript codebase and are dropped; everything else is kept as is, so a
// pattern flagged in the engine is flagged here too.
const sharedRules = {
    eqeqeq: ["error", "smart"],
    "jsdoc/check-alignment": "error",
    "logical-assignment-operators": ["error", "always", { enforceForIfStatements: true }],
    "new-parens": "error",
    "no-case-declarations": "error",
    "no-debugger": "error",
    "no-fallthrough": "error",
    "no-sequences": "error",
    "unicorn/no-negated-condition": "error",
    "unicorn/no-this-assignment": "error",
    "unicorn/no-useless-spread": "error",
    "unicorn/no-zero-fractions": "error",
    "unicorn/prefer-array-flat": "error",
    "unicorn/prefer-array-some": "error",
    "unicorn/prefer-at": "error",
    "unicorn/prefer-code-point": "error",
    "unicorn/prefer-export-from": "error",
    "unicorn/prefer-includes": "error",
    "unicorn/prefer-math-min-max": "error",
    "unicorn/prefer-set-has": "error",
    "unicorn/prefer-string-raw": "error",
    "unicorn/prefer-string-replace-all": "error",
    "use-isnan": "error",
};

export default [
    {
        ignores: ["app/**", "dist/**", "out/**", "coverage/**", "src/app/web/**"],
    },
    js.configs.recommended,
    {
        files: ["**/*.{js,mjs}"],
        plugins: { import: importPlugin, jsdoc, unicorn },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                // Injected by the engine bundle (brs.api.js) into the renderer.
                brs: "readonly",
            },
        },
        settings: {
            // Electron is the runtime, not a bundled dependency, so it belongs in
            // devDependencies even though src/ imports it everywhere. Treating it as a
            // builtin is what keeps no-extraneous-dependencies meaningful for the rest.
            "import/core-modules": ["electron"],
        },
        rules: {
            ...sharedRules,
            // Nothing under src/ may reach for a devDependency: those are not installed in
            // the packaged app, so an import that lints clean here would throw at runtime.
            "import/no-extraneous-dependencies": ["error", { devDependencies: false }],
            // Unused arguments are unavoidable with positional callbacks such as Electron's
            // click(item, window, event); unused variables and imports are still errors.
            "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
        },
    },
    {
        // Build scripts, tests and config files are tooling; devDependencies are theirs to
        // use. preload*.js are copied unbundled and must stay CommonJS.
        files: ["build/**/*.js", "test/**/*.js", "*.mjs", "src/app/preload*.js"],
        rules: { "import/no-extraneous-dependencies": "off" },
    },
    {
        files: ["src/app/*.js"],
        languageOptions: {
            globals: {
                // contextBridge surface from preload.js.
                api: "readonly",
                // Defined by the inline theme script in index.ejs / editor.ejs.
                __setTheme: "readonly",
                __currentTheme: "readonly",
                Toastify: "readonly",
            },
        },
    },
    {
        files: ["build/**/*.js", "src/app/preload*.js"],
        languageOptions: { sourceType: "commonjs" },
    },
    // Must stay last: turns off every rule Prettier already decides.
    prettier,
];
