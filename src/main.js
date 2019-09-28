// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from "path";
import url from "url";
import { app, Menu } from "electron";
import { fileMenuTemplate } from "./menu/fileMenuTemplate";
import { editMenuTemplate } from "./menu/editMenuTemplate";
import { viewMenuTemplate } from "./menu/viewMenuTemplate";
import { helpMenuTemplate } from "./menu/helpMenuTemplate";
import createWindow from "./helpers/window";

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";

const opts = process.argv.slice(1);

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

  const mainWindow = createWindow("main", {
    width: 1280,
    height: 720,
  }, opts[1]);
  
  mainWindow.setBackgroundColor('#1E1E1E');
  mainWindow.setMinimumSize(900, 580);
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  if (env.name === "development") {
    mainWindow.openDevTools();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
