// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from "path";
import url from "url";
import minimist from "minimist";
import { app, screen, Menu } from "electron";
import { fileMenuTemplate } from "./menu/fileMenuTemplate";
import { editMenuTemplate } from "./menu/editMenuTemplate";
import { viewMenuTemplate } from "./menu/viewMenuTemplate";
import { helpMenuTemplate } from "./menu/helpMenuTemplate";
import createWindow from "./helpers/window";

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";

var argv = minimist(process.argv.slice(1), {
  string: ['o'],
  alias: {f: 'fullscreen', d: 'devtools' }
});

const setApplicationMenu = () => {
  const menus = [fileMenuTemplate, editMenuTemplate, viewMenuTemplate, helpMenuTemplate];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== "production") {
  const userDataPath = app.getPath("userData");
  app.setPath("userData", `${userDataPath} (${env.name})`);
}

app.on("ready", () => {
  setApplicationMenu();
  
  global.sharedObject = {
    backgroundColor: '#251135'
  }  
  const mainWindow = createWindow("main", {
    width: 1280,
    height: 770,
    backgroundColor: global.sharedObject.backgroundColor
  }, argv);
  
  let winBounds = mainWindow.getBounds();
  let display = screen.getDisplayNearestPoint({x: winBounds.x, y: winBounds.y});
  mainWindow.setMinimumSize(Math.min(900, display.size.width), Math.min(550, display.size.height));
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  if (env.name === "development" || argv.devtools) {
    mainWindow.openDevTools();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
