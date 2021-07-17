import { showSettings } from "../helpers/settings";
const isMacOS = process.platform === "darwin";

export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            enabled: false,
            click: (item, window) => {
                window.webContents.send("copyScreenshot");
            }
        },
        { type: "separator" },
        { 
            id: "settings",
            label: "Settings...", 
            visible: !isMacOS,
            accelerator: "CmdOrCtrl+,",
            click: (item, window) => {
                showSettings();
            }
        }
    ]
};
