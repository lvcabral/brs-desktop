import { showSettings } from "../helpers/settings";
import { copyScreenshot } from "../helpers/window";
const isMacOS = process.platform === "darwin";

export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            enabled: false,
            click: () => {
                copyScreenshot();
            }
        },
        { type: "separator" },
        { 
            id: "settings",
            label: "Settings...", 
            visible: !isMacOS,
            accelerator: "CmdOrCtrl+,",
            click: () => {
                showSettings();
            }
        }
    ]
};
