module.exports = { openChannelPackage, openBrightScriptFile, saveScreenshot };

const electron = require('electron');

/*
 * Show open dialog to open a .zip or .brs file.
 */
function openChannelPackage () {
    const opts = {
      title: 'Select a Channel package file.',
      filters: [
          { name: 'Channel Packages', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    }
    var window = electron.BrowserWindow.getFocusedWindow();
    electron.dialog.showOpenDialog(window, opts).then(result => {
        if (result.canceled) {
            console.log("cancelled");
            return;
        }
        window.webContents.send('fileSelected', result.filePaths);
    }).catch(err => {
        console.log(err);
    });
}

function openBrightScriptFile () {
    const opts = {
      title: 'Select a BrightScript source file.',
      filters: [
          { name: 'BrightScript source files', extensions: ['brs'] },
          { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    }
    var window = electron.BrowserWindow.getFocusedWindow();
    electron.dialog.showOpenDialog(window, opts).then(result => {
        if (result.canceled) {
            console.log("cancelled");
            return;
        }
        window.webContents.send('fileSelected', result.filePaths);
    }).catch(err => {
        console.log(err);
    });
}

function saveScreenshot () {
    const opts = {
      title: 'Save the Screenshot as',
      filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
      ],
    }
    var window = electron.BrowserWindow.getFocusedWindow();
    electron.dialog.showSaveDialog(window, opts).then(result => {
        if (result.canceled) {
            console.log("cancelled");
            return;
        }
        window.webContents.send('saveScreenshot', result.filePath);
    }).catch(err => {
        console.log(err);
    });
}
