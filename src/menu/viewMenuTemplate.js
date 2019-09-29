import { BrowserWindow, Menu } from "electron";

export const viewMenuTemplate = {
  label: "&View",
  submenu: [
    {
      label: "Full Screen",
      role: "togglefullscreen",
    },
    {
      label: "Developer Tools",
      accelerator: "CmdOrCtrl+Shift+I",
      role: "toggleDevTools",
    },
    { type: 'separator' },
    {
      id: "theme-purple",
      label: "Purple Theme",
      type: "radio",
      checked: false,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setTheme', "purple");
      }
    },
    {
      id: "theme-light",
      label: "Light Theme",
      type: "radio",
      checked: false,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setTheme', "light");
      }
    },
    {
      id: "theme-dark",
      label: "Dark Theme",
      type: "radio",
      checked: true,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setTheme', "dark");
      }
    },
    { type: 'separator' },
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
