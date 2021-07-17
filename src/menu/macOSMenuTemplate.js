import { showSettings } from "../helpers/settings";

export const macOSMenuTemplate = {
    label: "BrightScript Emulator",
    submenu: [
        {
            label: "About BrightScript Emulator",
            role: "about"
        },
        { type: "separator" },
        {
            id: "settings",
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: (item, window) => {
                showSettings();
            }
        },
        { type: "separator" },
        {
            label: "Services",
            role: "services",
            submenu: []
        },
        {
            type: "separator"
        },
        {
            label: "Hide BrightScript Emulator",
            role: "hide"
        },
        {
            label: "Hide Others",
            role: "hideothers"
        },
        {
            label: "Show All",
            role: "unhide"
        },
        {
            type: "separator"
        },
        {
            label: "Quit BrightScript Emulator",
            role: "quit"
        }
    ]
}
