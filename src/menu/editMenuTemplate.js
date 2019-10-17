export const editMenuTemplate = {
    label: "&Edit",
    submenu: [
        {
            label: "Copy Screenshot",
            accelerator: "CmdOrCtrl+C",
            click: (event, window) => {
                window.webContents.send("copyScreenshot");
            }
        },
        { type: "separator" },
        { label: "Settings...", accelerator: "CmdOrCtrl+,", enabled: false }
    ]
};
