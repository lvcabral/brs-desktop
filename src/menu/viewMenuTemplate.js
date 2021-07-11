import { getSettings, setThemeSource, setEmulatorOption } from "../helpers/settings";

export const viewMenuTemplate = {
    label: "&View",
    submenu: [
        {
            label: "Full Screen",
            role: "togglefullscreen"
        },
        {
            label: "Developer Tools",
            accelerator: "CmdOrCtrl+Shift+I",
            role: "toggleDevTools"
        },
        { type: "separator" },
        {
            id: "theme-purple",
            label: "Purple Theme",
            type: "radio",
            checked: true,
            click: (item, window) => {
                getSettings(window).value("emulator.theme", "purple");
                window.webContents.send("setTheme", setThemeSource(getSettings(window).preferences));
            }
        },
        {
            id: "theme-light",
            label: "Light Theme",
            type: "radio",
            checked: false,
            click: (item, window) => {
                getSettings(window).value("emulator.theme", "light");
                window.webContents.send("setTheme", setThemeSource(getSettings(window).preferences));
            }
        },
        {
            id: "theme-dark",
            label: "Dark Theme",
            type: "radio",
            checked: false,
            click: (item, window) => {
                getSettings(window).value("emulator.theme", "dark");
                window.webContents.send("setTheme", setThemeSource(getSettings(window).preferences));
            }
        },
        {
            id: "theme-system",
            label: "System Theme",
            type: "radio",
            checked: false,
            click: (item, window) => {
                getSettings(window).value("emulator.theme", "system");
                window.webContents.send("setTheme", setThemeSource(getSettings(window).preferences));
            }
        },
        { type: "separator" },
        {
            id: "on-top",
            label: "Always on Top",
            type: "checkbox",
            checked: false,
            enabled: true,
            click: (item, window) => {
                const onTop = !window.isAlwaysOnTop();
                setEmulatorOption("alwaysOnTop", onTop, item.id);
                window.setAlwaysOnTop(onTop);
            }
        },
        {
            id: "status-bar",
            label: "Status Bar",
            type: "checkbox",
            checked: true,
            enabled: true,
            click: (item, window) => {
                setEmulatorOption("statusBar", item.checked, item.id);
                window.webContents.send("toggleStatusBar");
            }
        }
    ]
};
