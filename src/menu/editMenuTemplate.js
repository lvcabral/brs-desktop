
import { BrowserWindow } from "electron";

export const editMenuTemplate = {
  label: "&Edit",
  submenu: [
    { 
      label: "Copy Screenshot", 
      accelerator: "CmdOrCtrl+C", 
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('copyScreenshot');
      }
    },
    { type: "separator" },
    { label: "Settings...", accelerator: "CmdOrCtrl+,", enabled: false }
  ]
};
