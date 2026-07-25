/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Help text for the MicroDebugger command shell (src/server/debug.js). Kept apart from
// debug.js so it can be exercised without pulling in electron and node:net.
//
// Note that some entries here are documented but not implemented; debug.js answers those
// with "Command not implemented yet". The list mirrors a real Roku dev console.

export const HELP_COMMANDS = [
    { cmd: "?", args: "[str]", desc: "Display the help." },
    {
        cmd: "brightscript_warnings",
        args: "<num-warnings>",
        desc: "Set the maximum number of brightscript warnings displayed",
    },
    { cmd: "bsprof-pause", args: "", desc: "Pause BS profiling" },
    { cmd: "bsprof-resume", args: "", desc: "Resume BS profiling" },
    { cmd: "bsprof-status", args: "", desc: "Get BS profiling status" },
    { cmd: "chanperf", args: "[-r <repeat-seconds>]", desc: "Show channel CPU and memory usage" },
    { cmd: "clear_launch_caches", args: "", desc: "Clear all caches that can affect channel launch time" },
    { cmd: "exit", args: "", desc: "Exits the debug terminal." },
    { cmd: "fps_display", args: "", desc: "display onscreen graphics statistics [1|0]." },
    { cmd: "free", args: "", desc: "Return the output of the free(1) command" },
    { cmd: "genkey", args: "", desc: "Generate a new developer key." },
    { cmd: "help", args: "[str]", desc: "Display the help." },
    { cmd: "loaded_textures", args: "[overlay]", desc: "Show loaded textures (default main RenderContext)" },
    { cmd: "logrendezvous", args: "[on|off]", desc: "Turn Rendezvous Logging on or off" },
    { cmd: "plugins", args: "", desc: "Show list of all installed plugins." },
    { cmd: "press", args: "{hudrlsp<fb>yikoteacn}", desc: "Simulate a keypress. (no param lists keys)" },
    { cmd: "quit", args: "", desc: "Exits the debug terminal." },
    { cmd: "q", args: "", desc: "Exits the debug terminal." },
    { cmd: "r2d2_bitmaps", args: "", desc: "Enumerate R2D2 bitmaps" },
    { cmd: "remove_plugin", args: "", desc: "Remove a plugin from the account and device." },
    { cmd: "sgnodes", args: "", desc: "List SceneGraph nodes." },
    { cmd: "sgperf", args: "", desc: "SceneGraph node operation performance metrics." },
    { cmd: "showkey", args: "", desc: "Show the current developer key." },
    { cmd: "target", args: "list | <n> | <name> | -p <pid>)", desc: "List or select command execution target" },
    { cmd: "type", args: "", desc: "Send a literal text sequence." },
];

export const PRESS_HELP = [
    "h            Home",
    "u            Up",
    "d            Down",
    "r            Right",
    "l            Left",
    "s            Select",
    "f,>          Fwd",
    "b,<          Rev",
    "p            Play",
    "y            InstantReplay",
    "i            Info",
    "k            Back",
    "=            Backspace",
    "o            PlayOnly",
    "t            Stop",
    "e            Enter",
    "v            Pause",
    "+            Channel Up",
    "-            Channel Down",
    String.raw`\            Volume Mute`,
    "#            PowerOff",
    "a            A",
    "c            B",
    "0-9          Digits 0 to 9",
].join("\r\n");

/**
 * Render the help listing, or the entry for a single command
 * @param {string} [command] - The command to describe; omit for the full listing
 * @returns {string} - CRLF-terminated help text
 */
export function getHelpText(command) {
    if (!command) {
        return (
            HELP_COMMANDS.map((c) => {
                const prefix = c.cmd + (c.args ? ` ${c.args}` : "");
                const padding = prefix.length >= 24 ? " " : " ".repeat(24 - prefix.length);
                return `${prefix}${padding}${c.desc}`;
            }).join("\r\n") + "\r\n"
        );
    }
    const found = HELP_COMMANDS.find((c) => c.cmd.toLowerCase() === command.toLowerCase());
    if (found) {
        const prefix = found.cmd + (found.args ? ` ${found.args}` : "");
        const padding = prefix.length >= 24 ? " " : " ".repeat(24 - prefix.length);
        return `${prefix}${padding}${found.desc}\r\n`;
    }
    return `No help found for '${command}'.\r\n`;
}
