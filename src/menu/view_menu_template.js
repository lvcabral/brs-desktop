import { BrowserWindow } from "electron";

export const viewMenuTemplate = {
  label: "&View",
  submenu: [
    {
      label: "Toggle Full Screen",
      accelerator: "F11",
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.setFullScreen(!window.isFullScreen());
      }
    },
    {
      label: "Dark Mode",
      type: "checkbox",
      checked: true,
      enabled: false
    },
    { type: 'separator' },    
    {
      label: "Toggle Developer Tools",
      accelerator: "CmdOrCtrl+Shift+I",
      click: () => {
        BrowserWindow.getFocusedWindow().toggleDevTools();
      }
    }
  ]
};
