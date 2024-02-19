import * as CodeMirror from "codemirror";
import "codemirror/addon/comment/comment.js";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import { defineMode } from "./brightscript";

export class CodeMirrorManager {
    editor;

    config = {
        lineWrapping: true,
        theme: "vscode-dark",
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: true,
        electricChars: false,
        matchBrackets: true,
        autoCloseBrackets: "()[]{}``\"\"",
        mode: "brightscript",
    };

    // CTOR
    constructor(tagElement, theme) {
        defineMode(CodeMirror);
        this.config.theme = getThemeCss(theme);
        this.editor = CodeMirror.fromTextArea(tagElement, this.config);
        this.editor.setOption("extraKeys", {
            "Ctrl-/": function (cm) {
                cm.toggleComment();
            },
        });
    }
}

export function getThemeCss(theme) {
    let themeCss = "vscode-dark";
    if (theme === "light") {
        themeCss = "xq-light";
    } else if (theme === "purple") {
        themeCss = "material-palenight";
    }
    return themeCss;
}