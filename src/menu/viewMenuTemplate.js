import { BrowserWindow, Menu } from "electron";

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
      id: "theme-purple",
      label: "Purple Theme",
      type: "checkbox",
      checked: false,
      enabled: false
    },
    {
      id: "theme-light",
      label: "Light Theme",
      type: "checkbox",
      checked: false,
      enabled: false
    },
    {
      id: "theme-dark",
      label: "Dark Theme",
      type: "checkbox",
      checked: true,
      enabled: false
    },
    { type: 'separator' },
    {
      id: "dev-tools",
      label: "Toggle Developer Tools",
      checked: false,
      accelerator: "CmdOrCtrl+Shift+I",
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.toggleDevTools();
      }
    },
    {
      id: "status-bar",
      label: "Status Bar",
      type: "checkbox",
      checked: true,
      enabled: true,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('toggleStatusBar');
      }
    },
  ]
};
