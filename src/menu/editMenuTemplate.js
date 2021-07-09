import { getSettings } from "../helpers/settings";

export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            click: (item, window) => {
                window.webContents.send("copyScreenshot");
            }
        },
        { type: "separator" },
        { 
            id: "settings",
            label: "Settings...", 
            accelerator: "CmdOrCtrl+,",
            click: (item, window) => {
                getSettings(window).show();
            }
        }
    ]
};
