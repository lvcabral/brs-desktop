import { preferences } from "../helpers/settings";
export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            id: "copy-screen",
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            click: (event, window) => {
                window.webContents.send("copyScreenshot");
            }
        },
        { type: "separator" },
        { 
            id: "settings",
            label: "Settings...", 
            accelerator: "CmdOrCtrl+,",
            click: (event, window) => {
                preferences.show();
            }
        }
    ]
};
