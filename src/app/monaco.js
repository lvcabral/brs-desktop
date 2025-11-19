import * as monaco from "monaco-editor";
// Monaco Editor CSS is automatically imported by monaco-editor-webpack-plugin
import { defineBrightScriptLanguage, defineBrightScriptTheme } from "./brightscript";

// MonacoEnvironment is automatically configured by monaco-editor-webpack-plugin
// No manual configuration needed - webpack plugin handles web workers

export class MonacoManager {
    editor;

    // CTOR
    constructor(containerElement, theme) {
        // Register BrightScript language
        defineBrightScriptLanguage(monaco);

        // Define BrightScript theme matching VS Code colors and get the theme name
        const brightscriptTheme = defineBrightScriptTheme(monaco, theme);

        this.editor = monaco.editor.create(containerElement, {
            value: "",
            language: "brightscript",
            theme: brightscriptTheme,
            lineNumbers: "on",
            wordWrap: "on",
            tabSize: 4,
            insertSpaces: false,
            automaticLayout: false,
            minimap: {
                enabled: false,
            },
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "monospace",
            autoIndent: "full",
            formatOnPaste: false,
            formatOnType: false,
        });

        // Add comment toggle shortcut
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
            this.editor.getAction("editor.action.commentLine")?.run();
        });
    }

    setTheme(theme) {
        // Update BrightScript theme colors for the new theme and get the theme name
        const brightscriptTheme = defineBrightScriptTheme(monaco, theme);
        monaco.editor.setTheme(brightscriptTheme);
    }

    setMode(mode) {
        monaco.editor.setModelLanguage(this.editor.getModel(), mode);
    }

    getValue() {
        return this.editor.getValue();
    }

    setValue(value) {
        this.editor.setValue(value);
    }

    focus() {
        this.editor.focus();
    }

    hasFocus() {
        return this.editor.hasTextFocus();
    }

    dispose() {
        this.editor.dispose();
    }
}
