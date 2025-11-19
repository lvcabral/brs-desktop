/*---------------------------------------------------------------------------------------------
 *  BrightScript Language Support for Monaco Editor
 *
 *  Based on the VS Code BrightScript Language Extension:
 *  https://github.com/rokucommunity/vscode-brightscript-language
 *
 *  Copyright (c) 2023-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/


/*
BrightScript Language Mode

Grammar converted from TextMate grammar in vscode-brightscript-language extension
https://github.com/rokucommunity/vscode-brightscript-language

*/

export function defineBrightScriptLanguage(monaco) {
    // Register the language
    monaco.languages.register({ id: "brightscript" });

    // Set Monarch tokenizer (syntax highlighting)
    monaco.languages.setMonarchTokensProvider("brightscript", {
        defaultToken: "",
        ignoreCase: true,

        keywords: [
            "and", "as", "catch", "continue", "dim", "do", "each", "else", "elseif", "end",
            "endfor", "endfunction", "endif", "endsub", "endtry", "endwhile", "eval", "exit",
            "false", "for", "function", "goto", "if", "in", "invalid", "let", "library",
            "loop", "mod", "next", "not", "or", "print", "rem", "return", "run", "step",
            "stop", "sub", "then", "throw", "to", "true", "try", "while"
        ],

        typeKeywords: [
            "boolean", "integer", "longinteger", "float", "double", "string", "object",
            "interface", "dynamic", "brsub", "void", "as"
        ],

        operators: ["=", ">=", "<=", "<", ">", "<>", "+", "-", "*", "/", "^", "\\", "&"],

        symbols: /[=><!~?:&|+\-*\/\^%]+/,

        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

        tokenizer: {
            root: [
                // Comments
                [/^\s*rem\b.*$/i, "comment"],
                [/'.*$/, "comment"],

                // Region markers
                [/^\s*'\s*#region/i, "comment.region"],
                [/^\s*'\s*#endregion/i, "comment.region"],

                // Preprocessor directives
                [/#\s*(const|if|elseif|else|endif|error)/i, "keyword.preprocessor"],

                // Template strings
                [/`/, { token: "string.backtick", bracket: "@open", next: "@templateString" }],

                // Double quoted strings
                [/"([^"\\]|\\.)*$/, "string.invalid"],
                [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

                // Hex numbers
                [/&H[0-9a-f]+/i, "number.hex"],

                // Octal numbers
                [/&O[0-7]+/i, "number.octal"],

                // Floats
                [/\d*\.\d+([eE][+-]?\d+)?[fFdD]?/, "number.float"],

                // Integers
                [/\d+[fFdDlL]?/, "number"],

                // Function/Sub declarations - MUST come before general keyword matching
                [/\bfunction\b/i, { token: "keyword", next: "@functionName" }],
                [/\bsub\b/i, { token: "keyword", next: "@subName" }],

                // End function/sub statements
                [/\b(end\s+function|endfunction)\b/i, "keyword"],
                [/\b(end\s+sub|endsub)\b/i, "keyword"],

                // Other end statements
                [/\b(end\s+if|endif)\b/i, "keyword"],
                [/\b(end\s+for|endfor)\b/i, "keyword"],
                [/\b(end\s+while|endwhile)\b/i, "keyword"],
                [/\b(end\s+try|endtry)\b/i, "keyword"],

                // Multi-word keywords
                [/\belse\s+if\b/i, "keyword"],
                [/\bend\s+if\b/i, "keyword"],
                [/\bend\s+for\b/i, "keyword"],
                [/\bend\s+while\b/i, "keyword"],
                [/\bend\s+sub\b/i, "keyword"],
                [/\bend\s+function\b/i, "keyword"],
                [/\bfor\s+each\b/i, "keyword"],
                [/\bexit\s+for\b/i, "keyword"],
                [/\bexit\s+while\b/i, "keyword"],
                [/\bcontinue\s+for\b/i, "keyword"],
                [/\bcontinue\s+while\b/i, "keyword"],

                // Keywords (function and sub are handled separately in declarations)
                [/\b(?:if|then|else|elseif|for|to|step|while|end|exit|return|as|next|stop|goto|dim|print|rem|new|try|catch|throw|run|library|continue|do|loop|each|in)\b/i, "keyword"],

                // Boolean and null constants
                [/\b(?:true|false)\b/i, "constant.language"],
                [/\b(?:invalid)\b/i, "constant.language"],

                // Special keywords
                [/\b(?:m|super|global)\b/i, "variable.language"],
                [/\bLINE_NUM\b/, "variable.language"],

                // Logical operators
                [/\b(?:and|or|not|mod)\b/i, "keyword.operator"],

                // Type keywords (function/sub as types only after 'as' keyword)
                [/(?<=\bas\s+)(function|sub)\b/i, "type"],

                // Other type keywords
                [/\b(?:boolean|integer|longinteger|float|double|string|object|interface|dynamic|brsub|void)\b/i, "type"],

                // Class, namespace, interface declarations
                [/\b(class|namespace|interface|enum)\s+([a-z_]\w*)/i, ["keyword", "type.identifier"]],

                // Roku built-in types (roXXX)
                [/\b(ro[A-Z]\w*)\b/, "type.roku"],

                // Function calls
                [/\b([a-z_]\w*)(?=\s*\()/i, "entity.name.function"],

                // Identifiers
                [/[a-z_]\w*/i, "identifier"],

                // Operators
                [/@symbols/, {
                    cases: {
                        "@operators": "operator",
                        "@default": ""
                    }
                }],

                // Delimiters and brackets
                [/[{}()\[\]]/, "@brackets"],
                [/[<>](?!@symbols)/, "@brackets"],
                [/[,;:.]/, "delimiter"],

                // Whitespace
                { include: "@whitespace" },
            ],

            whitespace: [
                [/\s+/, "white"],
            ],

            string: [
                [/[^\\"]+/, "string"],
                [/@escapes/, "string.escape"],
                [/\\./, "string.escape.invalid"],
                [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }]
            ],

            templateString: [
                [/\$\{/, { token: "delimiter.bracket", next: "@templateExpression" }],
                [/[^`$]+/, "string.backtick"],
                [/\$[^{]/, "string.backtick"],
                [/`/, { token: "string.backtick", bracket: "@close", next: "@pop" }]
            ],

            templateExpression: [
                [/\}/, { token: "delimiter.bracket", next: "@pop" }],
                { include: "root" }
            ],

            functionName: [
                [/\s+/, "white"],
                [/[a-z_]\w*/i, { token: "entity.name.function", next: "@pop" }],
                [/./, { token: "@rematch", next: "@pop" }]
            ],

            subName: [
                [/\s+/, "white"],
                [/[a-z_]\w*/i, { token: "entity.name.function", next: "@pop" }],
                [/./, { token: "@rematch", next: "@pop" }]
            ],
        },
    });

    // Set language configuration
    monaco.languages.setLanguageConfiguration("brightscript", {
        comments: {
            lineComment: "'",
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
        ],
        autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"', notIn: ["string"] },
            { open: "`", close: "`", notIn: ["string", "comment"] },
        ],
        surroundingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"' },
            { open: "`", close: "`" },
        ],
        folding: {
            markers: {
                start: /^\s*('|rem)\s*#region\b/i,
                end: /^\s*('|rem)\s*#endregion\b/i,
            },
        },
        onEnterRules: [
            {
                // Increase indent after function/sub declaration
                beforeText: /^\s*(?:function|sub)\s+\w+/i,
                action: { indentAction: monaco.languages.IndentAction.Indent },
            },
            {
                // Increase indent after if/for/while (without inline then)
                beforeText: /^\s*(?:if\b(?!.*\bthen\b.*$)|for\b|while\b|try\b)/i,
                action: { indentAction: monaco.languages.IndentAction.Indent },
            },
        ],
        indentationRules: {
            increaseIndentPattern: /^\s*(?:(?:function|sub)\s+\w+|(?:if\b(?!.*\bthen\b.*$))|(?:for\b)|(?:while\b)|(?:try\b)|(?:else\s*$))/i,
            decreaseIndentPattern: /^\s*(?:(?:end\s+(?:function|sub|if|for|while|try))|(?:endfunction|endsub|endif|endfor|endwhile|endtry)|(?:else\b)|(?:elseif\b)|(?:catch\b))/i,
        },
        wordPattern: /[a-zA-Z_]\w*/,
    });
}

/**
 * Defines BrightScript theme colors matching VS Code's default theme
 * These colors match the token colors used in the VS Code BrightScript extension
 */
export function defineBrightScriptTheme(monaco, theme) {
    const isDark = theme === "dark";

    // VS Code Dark+ theme colors (default dark theme)
    const darkColors = [
        // Keywords - blue (#569CD6 in VS Code Dark+)
        { token: "keyword", foreground: "569CD6" },
        { token: "keyword.operator", foreground: "569CD6" },
        { token: "keyword.preprocessor", foreground: "569CD6" },

        // Types - light blue/teal (#4EC9B0 in VS Code Dark+)
        { token: "type", foreground: "4EC9B0" },
        { token: "type.identifier", foreground: "4EC9B0" },
        { token: "type.roku", foreground: "4EC9B0" },

        // Strings - orange/brown (#CE9178 in VS Code Dark+)
        { token: "string", foreground: "CE9178" },
        { token: "string.quote", foreground: "CE9178" },
        { token: "string.backtick", foreground: "CE9178" },
        { token: "string.escape", foreground: "D7BA7D" },
        { token: "string.escape.invalid", foreground: "D7BA7D" },
        { token: "string.invalid", foreground: "F44747" },

        // Comments - green (#6A9955 in VS Code Dark+)
        { token: "comment", foreground: "6A9955" },
        { token: "comment.region", foreground: "6A9955" },

        // Numbers - light green (#B5CEA8 in VS Code Dark+)
        { token: "number", foreground: "B5CEA8" },
        { token: "number.hex", foreground: "B5CEA8" },
        { token: "number.octal", foreground: "B5CEA8" },
        { token: "number.float", foreground: "B5CEA8" },

        // Functions - yellow (#DCDCAA in VS Code Dark+)
        { token: "entity.name.function", foreground: "DCDCAA" },

        // Constants - blue (#569CD6 in VS Code Dark+)
        { token: "constant.language", foreground: "569CD6" },

        // Variables - light blue (#9CDCFE in VS Code Dark+)
        { token: "variable.language", foreground: "569CD6" },
        { token: "identifier", foreground: "9CDCFE" },

        // Operators - white/gray (#D4D4D4 in VS Code Dark+)
        { token: "operator", foreground: "D4D4D4" },

        // Delimiters - white/gray (#D4D4D4 in VS Code Dark+)
        { token: "delimiter", foreground: "D4D4D4" },
        { token: "delimiter.bracket", foreground: "FFD700" },
    ];

    // VS Code Light+ theme colors (default light theme)
    const lightColors = [
        // Keywords - blue (#0000FF in VS Code Light+)
        { token: "keyword", foreground: "0000FF" },
        { token: "keyword.operator", foreground: "0000FF" },
        { token: "keyword.preprocessor", foreground: "0000FF" },

        // Types - teal (#267F99 in VS Code Light+)
        { token: "type", foreground: "267F99" },
        { token: "type.identifier", foreground: "267F99" },
        { token: "type.roku", foreground: "267F99" },

        // Strings - red/brown (#A31515 in VS Code Light+)
        { token: "string", foreground: "A31515" },
        { token: "string.quote", foreground: "A31515" },
        { token: "string.backtick", foreground: "A31515" },
        { token: "string.escape", foreground: "EE0000" },
        { token: "string.escape.invalid", foreground: "EE0000" },
        { token: "string.invalid", foreground: "CD3131" },

        // Comments - green (#008000 in VS Code Light+)
        { token: "comment", foreground: "008000" },
        { token: "comment.region", foreground: "008000" },

        // Numbers - dark green (#098658 in VS Code Light+)
        { token: "number", foreground: "098658" },
        { token: "number.hex", foreground: "098658" },
        { token: "number.octal", foreground: "098658" },
        { token: "number.float", foreground: "098658" },

        // Functions - brown (#795E26 in VS Code Light+)
        { token: "entity.name.function", foreground: "795E26" },

        // Constants - blue (#0000FF in VS Code Light+)
        { token: "constant.language", foreground: "0000FF" },

        // Variables - blue (#001080 in VS Code Light+)
        { token: "variable.language", foreground: "0000FF" },
        { token: "identifier", foreground: "001080" },

        // Operators - black (#000000 in VS Code Light+)
        { token: "operator", foreground: "000000" },

        // Delimiters - black (#000000 in VS Code Light+)
        { token: "delimiter", foreground: "000000" },
        { token: "delimiter.bracket", foreground: "AF00DB" },
    ];

    const colors = isDark ? darkColors : lightColors;
    const baseTheme = isDark ? "vs-dark" : "vs";
    const customThemeName = isDark ? "brightscript-dark" : "brightscript-light";

    // Define a custom theme that inherits from the base theme
    monaco.editor.defineTheme(customThemeName, {
        base: baseTheme,
        inherit: true,
        rules: colors,
        colors: {},
    });

    // Return the theme name so it can be set by the caller
    return customThemeName;
}
