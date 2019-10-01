import path from "path";
import { BrowserWindow, shell } from "electron";
import openAboutWindow from 'electron-about-window';

export const helpMenuTemplate = {
    label: "&Help",
    submenu: [
      { 
        label: "Documentation", 
        accelerator: "F1", 
        click: () => {
          shell.openExternalSync("https://github.com/lvcabral/brs-emu-app/blob/master/README.md");
        }
      },
      { label: "Control Keyboard Reference", 
        accelerator: "CmdOrCtrl+F1",
        click: () => {
          shell.openExternalSync("https://github.com/lvcabral/brs-emu-app/blob/master/docs/control-reference.md");
        }
      },
      { type: "separator" },
      { 
        label: "Release Notes",
        click: () => {
          shell.openExternalSync("https://github.com/lvcabral/brs-emu/releases");
        }
      },
      { 
        label: "View License",
        click: () => {
          shell.openExternalSync("https://github.com/lvcabral/brs-emu-app/blob/master/LICENSE");
        }
      },
      { type: "separator" },
      { label: "Check for Updates...", enabled: false},
      { type: "separator" },
      { 
        label: "About", 
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          var x = Math.round(window.getPosition()[0] + Math.abs(window.getSize()[0]-350)/2);
          var y = Math.round(window.getPosition()[1] + window.getSize()[1]/4);
          openAboutWindow({
            icon_path: path.join(__dirname, 'images/icon512x512.png'),
            copyright: 'Copyright © 2019 Marcelo Lv Cabral',
            win_options: {
              parent: window,
              x: x,
              y: y,
              width: 350,
              height: 580,
              opacity: 0.9,
              resizable: false,
              modal: true
            }
          });
        }
      }
    ]
  };
  