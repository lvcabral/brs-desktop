import * as dialog from "../helpers/dialog";
const isMacOS = process.platform === "darwin";

export const fileMenuTemplate = {
    label: "&File",
    submenu: [
        { role: "about", visible: isMacOS },
        {
            label: "Check for Updates...",
            visible: isMacOS,
            enabled: false
        },
        {
            type: isMacOS ? "separator" : "normal", // Custom toolbar won't hide this separator
            label: "",
            visible: isMacOS
        },
        {
            label: "Open Channel Package...",
            accelerator: "CmdOrCtrl+O",
            click: () => {
                dialog.openChannelPackage();
            }
        },
        {
            label: "Open Source File...",
            accelerator: "CmdOrCtrl+Shift+O",
            click: () => {
                dialog.openBrightScriptFile();
            }
        },
        { type: "separator" },
        {
            label: "Save Screenshot...",
            accelerator: "CmdOrCtrl+S",
            click: () => {
                dialog.saveScreenshot();
            }
        },
        { type: "separator" },
        {
            role: "quit"
        }
    ]
};
