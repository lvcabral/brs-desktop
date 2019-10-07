import path from "path";
import { BrowserWindow, shell } from "electron";
import openAboutWindow from 'electron-about-window';
const isMacOS = (process.platform === "darwin");

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
      { type: "separator", visible: !isMacOS},
      { label: "Check for Updates...", visible: !isMacOS, enabled: false},
      { type: "separator", visible: !isMacOS},
      { 
        label: "About", 
        visible: !isMacOS,
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          var w = 350;
          var h = 450;
          var x = Math.round(window.getPosition()[0] + Math.abs(window.getSize()[0]-w)/2);
          var y = Math.round(window.getPosition()[1] + Math.abs(window.getSize()[1]-h+25)/2);
          const about = openAboutWindow({
            icon_path: path.join(__dirname, 'images/icon512x512.png'),
            copyright: 'Copyright © 2019 Marcelo Lv Cabral',
            win_options: {
              parent: window,
              x: x,
              y: y,
              width: w,
              height: h,
              opacity: 0.9,
              modal: true
            }
          });
          about.setMenuBarVisibility(false);
          about.setResizable(false);
        }
      }
    ]
  };
  