import { BrowserWindow } from "electron";

export const viewMenuTemplate = {
  label: "&View",
  submenu: [
    {
      label: "Full Screen",
      accelerator: "F11",
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.setFullScreen(!window.isFullScreen());
      }
    },
    { type: 'separator' },
    {
      label: "Light Mode",
      type: "checkbox",
      checked: false,
      enabled: false
    },
    {
      label: "Dark Mode",
      type: "checkbox",
      checked: true,
      enabled: false
    },
    { type: 'separator' },
    {
      label: "Developer Tools",
      accelerator: "CmdOrCtrl+Shift+I",
      click: () => {
        BrowserWindow.getFocusedWindow().toggleDevTools();
      }
    }
  ]
};
