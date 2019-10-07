import { BrowserWindow } from "electron";
import * as dialog from "../helpers/dialog";
const isMacOS = (process.platform === "darwin");

export const fileMenuTemplate = {
  label: "&File",
  submenu: [
    { role: "about",visible: isMacOS},
    { 
      label: "Check for Updates...", 
      visible: isMacOS,
      enabled: false
    },
    { type: "separator", visible: isMacOS },
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
    {
      label: "Save Screenshot...",
      accelerator: "CmdOrCtrl+S",
      click: () => {
        dialog.saveScreenshot();
      }
    },
    { type: 'separator' },    
    {
      label: "Reset Emulator",
      accelerator: "CmdOrCtrl+Shift+R",
      click: () => {
        BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
      }
    },
    { type: 'separator' },    
    {
      role: "quit",
    }
  ]
};
