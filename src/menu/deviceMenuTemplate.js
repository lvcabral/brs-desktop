import { BrowserWindow, Menu } from "electron";

export const deviceMenuTemplate = {
  label: "&Device",
  submenu: [
    {
      id: "device-480p",
      label: "SD 480p (Tyler)",
      type: "radio",
      checked: false,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setDevice', "480p");
      }
    },
    {
      id: "device-720p",
      label: "HD 720p (Midland)",
      type: "radio",
      checked: true,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setDevice', "720p");
      }
    },
    {
      id: "device-1080p",
      label: "FHD 1080p (Cooper)",
      type: "radio",
      checked: false,
      click: () => {
        var window = BrowserWindow.getFocusedWindow();
        window.webContents.send('setDevice', "1080p");
      }
    },
    { type: 'separator' },
    {
        label: "Reset Device",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => {
          BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
        }
      },
    ]
};
