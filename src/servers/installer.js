import { app } from "electron";
import Busboy from "busboy";
import fs from "fs";
import path from "path";
import http from "http";
import crypt from "crypto";
import { enableTelnet, disableTelnet } from "./telnet";

const PORT = 80;
const credentials = {
    userName: "rokudev",
    password: "rokudev",
    realm: "BrightScript Emulator"
};
let window;
let server;
let hash;
export let hasInstaller = false;
export function initInstaller(mainWindow) {
    window = mainWindow;
}
export function setPassword(password) {
    if (password && password !== "") {
        credentials.password = password;
    }
}
export function enableInstaller() {
    if (hasInstaller) {
        return; // already started do nothing
    }
    hash = cryptoUsingMD5(credentials.realm);
    server = http.createServer(function(req, res) {
        let authInfo, digestAuthObject = {};
        if (!req.headers.authorization) {
            authenticateUser(res);
            return;
        }
        authInfo = req.headers.authorization.replace(/^Digest /, '');
        authInfo = parseAuthenticationInfo(authInfo);
        if (authInfo.username !== credentials.userName) {
            authenticateUser(res); 
            return;
        }
        digestAuthObject.ha1 = cryptoUsingMD5(authInfo.username + ':' + credentials.realm + ':' + credentials.password);
        digestAuthObject.ha2 = cryptoUsingMD5(req.method + ':' + authInfo.uri);
        let resp = cryptoUsingMD5([digestAuthObject.ha1, authInfo.nonce, authInfo.nc, authInfo.cnonce, authInfo.qop, digestAuthObject.ha2].join(':'));            
        digestAuthObject.response = resp;
        if (authInfo.response !== digestAuthObject.response) {
            authenticateUser(res); 
            return;
        }
        if (req.method === "POST") {
            const busboy = new Busboy({ headers: req.headers });
            busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {
                console.log(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
                let saveTo = path.join(app.getPath("userData"), "dev.zip");
                file.pipe(fs.createWriteStream(saveTo));
                file.on("end", function() {
                    console.log(`File [${fieldname}] Finished`);
                    window.webContents.send("fileSelected", [saveTo]);
                });
            });
            busboy.on("finish", function() {
                console.log("Done parsing form!");
                res.end("Channel Installed!");
            });
            req.pipe(busboy);
        } else if (req.method === "GET") {
            let filePath = "";
            let contentType = "";
            if (req.url === "/css/global.css") {
                filePath = path.join(__dirname, "css", "global.css");
                contentType = "text/css";
            } else if (req.url === "/" || req.url === "/index.html" || req.url === "/plugin_install" ) {
                filePath = path.join(__dirname, "installer.html");
                contentType = "text/html";
            }
            if (filePath !== "") {
                fs.readFile(filePath, function (error, pgResp) {
                    if (error) {
                        res.writeHead(404);
                        res.write("Error 404: Not Found\nFile not found");
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.write(pgResp);
                    }                 
                    res.end();
                });
            } else {
                res.writeHead(404);
                res.write("Error 404: Not Found\nFile not found");
                res.end();
            }
        }
    }).listen(PORT, function() {
        console.log(`Installer server started listening port ${PORT}`);
        hasInstaller = true;
        enableTelnet();
    });
}

export function disableInstaller() {
    if (server) {
        server.close();
        disableTelnet();
    }
    hasInstaller = false;
    console.log("Installer server disabled.");
}

// Helper Functions
function cryptoUsingMD5(data) {
    return crypt.createHash('md5').update(data).digest('hex');
}

function authenticateUser(res) {
    res.writeHead(401, { 'WWW-Authenticate': 'Digest realm="' + credentials.realm + '",qop="auth",nonce="' + Math.random() + '",opaque="' + hash + '"' });
    res.end('Authorization is needed.');
}

function parseAuthenticationInfo(authData) {
    let authenticationObj = {};
    authData.split(', ').forEach(function (d) {
        d = d.split('=');
 
        authenticationObj[d[0]] = d[1].replace(/"/g, '');
    });
    //console.log(JSON.stringify(authenticationObj));
    return authenticationObj;
}
