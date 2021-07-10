import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";

export function loadFile(file) {
    let window = BrowserWindow.fromId(1);
    if (file == undefined) return;
    let filePath;
    if (file.length >= 1 && file[0].length > 1 && fs.existsSync(file[0])) {
        filePath = file[0];
    } else {
        window.webContents.send("clientException",`Invalid file: ${file[0]}`);
        return;
    }
    const fileName = path.parse(filePath).base;
    const fileExt = path.parse(filePath).ext.toLowerCase();
    if (fileExt === ".zip" || fileExt === ".brs") {
        try {
            window.webContents.send("fileSelected", filePath, fs.readFileSync(filePath));
        } catch (error) {
            window.webContents.send("clientException",`Error opening ${fileName}:${error.message}`);
        }
    } else {
        window.webContents.send("clientException",`File format not supported: ${fileExt}`);
    }
}

export function saveFile(file, data) {
    fs.writeFileSync(file, new Buffer.from(data, "base64"));
    console.log(`file saved: ${file}`);
}