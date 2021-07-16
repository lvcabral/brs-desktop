import { app, nativeTheme } from "electron";
import { DateTime } from "luxon";
import path from "path";
import ElectronPreferences from "electron-preferences";
import { enableECP, disableECP } from "../servers/ecp";
import { enableTelnet, disableTelnet } from "../servers/telnet";
import { enableInstaller, disableInstaller, setPort, hasInstaller, setPassword } from "../servers/installer";

const isMacOS = process.platform === "darwin";
const timeZoneLabels = new Map();
const w = 800;
const h = 650;
let settings;
export function getSettings(window) {
    if (settings === undefined) {
        const bounds = window.getBounds();    
        const x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
        const y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);
        settings = new ElectronPreferences({
            dataStore: path.resolve(app.getPath("userData"), "brs-settings.json"),
            defaults: {
                emulator: {
                    options: ["statusBar"],
                    theme: "purple"
                },
                services: {
                    installer: ["enabled"],
                    webPort: 80,
                    password: "rokudev",
                    ecp: ["enabled"],
                    telnet: ["enabled"],
                },
                device: {
                    deviceModel: global.sharedObject.deviceInfo.deviceModel,
                    serialNumber: global.sharedObject.deviceInfo.serialNumber,
                    clientId: global.sharedObject.deviceInfo.clientId,
                    RIDA: global.sharedObject.deviceInfo.RIDA,
                    developerId: global.sharedObject.deviceInfo.developerId,
                },
                display: {
                    displayMode: "720p",
                    overscan: "disabled"
                },
                audio: {
                    maxSimulStreams: global.sharedObject.deviceInfo.maxSimulStreams,
                    audioVolume: global.sharedObject.deviceInfo.audioVolume
                },
                localization: {
                    locale: global.sharedObject.deviceInfo.locale,
                    countryCode: global.sharedObject.deviceInfo.countryCode,
                    clockFormat: global.sharedObject.deviceInfo.clockFormat,
                    timeZone: "system"
                },
            },
            webPreferences: {
                devTools: true
            },
            browserWindowOverrides: {
                title: "Settings",
                parent: window,
                modal: !isMacOS,
                icon: __dirname + "/images/icon48x48.ico",
                x: x,
                y: y,
                width: w,
                maxWidth: w,
                height: h,
                maxHeight: h,
                minimizable: false,
                maximizable: false,
            },
            sections: [
                {
                    id: "emulator",
                    label: "Emulator",
                    icon: "settings-gear-63",
                    form: {
                        groups: [
                            {
                                fields: [
                                    {
                                        label: "Emulator Options",
                                        key: "options",
                                        type: "checkbox",
                                        options: [
                                            { label: "Enter Fullscreen Mode on Startup", value: "fullScreen" },
                                            { label: "Run last channel on Startup", value: "runLastChannel" },
                                            { label: "Open Developer Tools on Startup", value: "devTools" },
                                            { label: "Enable Always on Top Mode", value: "alwaysOnTop" },
                                            { label: "Show Status Bar", value: "statusBar" },
                                        ],
                                        help: "Select one or more configuration options."
                                    },
                                    {
                                        label: "App UI Theme",
                                        key: "theme",
                                        type: "radio",
                                        options: [
                                            { label: "Purple (default)", value: "purple" },
                                            { label: "Light", value: "light" },
                                            { label: "Dark", value: "dark" },
                                            { label: "System", value: "system" },
                                        ],
                                        help: "Select the application theme, 'System' will follow your OS configuration"
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    id: "services",
                    label: "Services",
                    icon: "layers-3",
                    form: {
                        groups: [
                            {
                                label: "Remote Access Services",
                                fields: [
                                    {
                                        label: "Application Installer (Web)",
                                        key: "installer",
                                        type: "checkbox",
                                        options: [
                                            { label: "Service Enabled", value: "enabled" },
                                        ],
                                        help: "This service allows to remotely side load a channel, to change port and password restart the service "
                                    },
                                    {
                                        label: "Port (default: 80)",
                                        key: "webPort",
                                        type: "text",
                                        inputType: "number"
                                    },
                                    {
                                        label: "Password (default: rokudev)",
                                        key: "password",
                                        type: "text",
                                        inputType: "password"
                                    },
                                    {
                                        label: "External Control Protocol (ECP)",
                                        key: "ecp",
                                        type: "checkbox",
                                        options: [
                                            { label: "Service Enabled", value: "enabled" },
                                        ],
                                        help: "ECP service allows the emulator to be controlled over the network"
                                    },
                                    {
                                        label: "BrightScript Remote Console (Telnet)",
                                        key: "telnet",
                                        type: "checkbox",
                                        options: [
                                            { label: "Service Enabled", value: "enabled" },
                                        ],
                                        help: "Remote Console can be accessed using an application such as PuTTY or terminal on Mac and Linux"
                                    },
                                ]
                            }
                        ]
                    }
                },
                {
                    id: "device",
                    label: "Device",
                    icon: "spaceship",
                    form: {
                        groups: [
                            {
                                label: "Device Information",
                                fields: [
                                    {
                                        label: "Roku Model",
                                        key: "deviceModel",
                                        type: "dropdown",
                                        options: getRokuModelArray(),
                                        help: "Device model returned by ifDeviceInfo.GetModel(). This setting doesn't affect any behavior of the emulator"
                                    },
                                    {
                                        label: "Serial Number",
                                        key: "serialNumber",
                                        type: "text",
                                        help: "Device serial number, must be 12 characters long, only letters and numbers"
                                    },
                                    {
                                        label: "Channel Client Id",
                                        key: "clientId",
                                        type: "text",
                                        help: "Unique device identifier returned by ifDeviceInfo.GetChannelClientId()"
                                    },
                                    {
                                        label: "RIDA",
                                        key: "RIDA",
                                        type: "text",
                                        help: "Unique identifier for advertisement tracking returned by ifDevideInfo.GetRIDA()"
                                    },
                                    {
                                        label: "Developer Id",
                                        key: "developerId",
                                        type: "text",
                                        help: "Unique id to segregate registry among channels"
                                    },
                                ]
                            }
                        ]
                    }
                },
                {
                    id: "display",
                    label: "Display",
                    icon: "image",
                    form: {
                        groups: [
                            {
                                fields: [
                                    {
                                        label: "Display Mode",
                                        key: "displayMode",
                                        type: "radio",
                                        options: [
                                            { label: "SD 480p (4:3)", value: "480p" },
                                            { label: "HD 720p (16:9)", value: "720p" },
                                            { label: "FHD 1080p (16:9)", value: "1080p" },
                                        ],
                                        help: "Device display mode. Changing this setting will close any running channel"
                                    },
                                    {
                                        label: "TV Overscan",
                                        key: "overscan",
                                        type: "radio",
                                        options: [
                                            { label: "Overscan Disabled", value: "disabled" },
                                            { label: "Show Overscan Guide Lines", value: "guideLines" },
                                            { label: "Enable Overscan Effect", value: "enabled" },
                                        ],
                                        help: "Enable overscan to verify potential cuts of the UI on the TV borders"
                                    },
                                ]
                            }
                        ]
                    }
                },
                {
                    id: "audio",
                    label: "Audio",
                    icon: "preferences",
                    form: {
                        groups: [
                            {
                                label: "Audio Settings",
                                fields: [
                                    {
                                        label: "Maximum Simultaneous Streams",
                                        key: "maxSimulStreams",
                                        type: "slider",
                                        min: 1,
                                        max: 3,
                                        help: "Maximum number of audio streams that can be mixed together and played simultaneously"
                                    },
                                    {
                                        label: "Sound Effects Volume",
                                        key: "audioVolume",
                                        type: "slider",
                                        min: 0,
                                        max: 100,
                                        help: "Volume level of the channel user interface sound effects"
                                    },
                                ]
                            }
                        ]
                    }
                },
                {
                    id: "localization",
                    label: "Localization",
                    icon: "world",
                    form: {
                        groups: [
                            {
                                fields: [
                                    {
                                        label: "Channels UI Locale",
                                        key: "locale",
                                        type: "radio",
                                        options: getLocaleIdArray(),
                                        help: "Configure the localization, this setting only affects channels not the emulator UI"
                                    },
                                    {
                                        label: "Clock Format",
                                        key: "clockFormat",
                                        type: "radio",
                                        options: [
                                            { value: "12h", label: "12-hour AM/PM format" },
                                            { value: "24h", label: "24-hour format" },
                                        ],
                                    },
                                    {
                                        label: "Channel Store Country",
                                        key: "countryCode",
                                        type: "dropdown",
                                        options: getCountryArray(),
                                        help: "Configure the country store associated with the device returned by ifDeviceInfo.GetCountryCode()"
                                    },
                                    {
                                        label: "Time Zone",
                                        key: "timeZone",
                                        type: "dropdown",
                                        options: getTimezonArray(),
                                    },
                                ]
                            }
                        ]
                    }
                },
            ]
        });
        setThemeSource();
        settings.on("save", (preferences) => {
            const appMenu = app.applicationMenu;
            if (preferences.emulator) {
                const options = preferences.emulator.options;
                const onTop = options.includes("alwaysOnTop");
                const statusBar = options.includes("statusBar");
                appMenu.getMenuItemById("on-top").checked = onTop;
                window.setAlwaysOnTop(onTop);
                if (appMenu.getMenuItemById("status-bar").checked != statusBar) {
                    appMenu.getMenuItemById("status-bar").checked = statusBar;
                    window.webContents.send("toggleStatusBar");
                }
                window.webContents.send("setTheme", setThemeSource());
            }
            if (preferences.services) {
                const services = preferences.services;
                if (services.installer.includes("enabled")) {
                    if (!hasInstaller) {
                        setPort(services.webPort);
                        setPassword(services.password);
                        enableInstaller(window);    
                    }
                } else {
                    disableInstaller(window);
                }                
                if (services.ecp.includes("enabled")) {
                    enableECP(window);
                } else {
                    disableECP(window);
                }                
                if (services.telnet.includes("enabled")) {
                    enableTelnet(window);
                } else {
                    disableTelnet(window);
                }                
            }
            if (preferences.localization) {
                const localeId = preferences.localization.locale;
                if (global.sharedObject.deviceInfo.locale !== localeId) {
                    global.sharedObject.deviceInfo.locale = localeId;
                    app.applicationMenu.getMenuItemById(localeId).checked = true;
                    window.webContents.send("setLocale", localeId);
                }
                const clockFormat = preferences.localization.clockFormat;
                if (global.sharedObject.deviceInfo.clockFormat !== clockFormat) {
                    global.sharedObject.deviceInfo.clockFormat = clockFormat;
                    window.webContents.send("setDeviceInfo", "clockFormat", clockFormat);
                }
                const countryCode = preferences.localization.countryCode;
                if (global.sharedObject.deviceInfo.countryCode !== countryCode) {
                    global.sharedObject.deviceInfo.countryCode = countryCode;
                    window.webContents.send("setDeviceInfo", "countryCode", countryCode);
                }
                updateTimeZone(window);
            }
        });
        nativeTheme.on("updated", () => {
            if (settings.value("emulator.theme") === "system") {
                const userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
                window.webContents.send("setTheme", userTheme);
                global.sharedObject.theme = userTheme;
            }
        });
    }
    return settings;
}

export function showSettings() {
    if (settings.browserWindowOverrides.parent) {
        const bounds = settings.browserWindowOverrides.parent.getBounds();    
        settings.browserWindowOverrides.x = Math.round(bounds.x + Math.abs(bounds.width - w) / 2);
        settings.browserWindowOverrides.y = Math.round(bounds.y + Math.abs(bounds.height - h + 25) / 2);
    }
    settings.show();
}

export function setPreference(key, value) {
    settings.value(key, value);
}

export function setThemeSource(userTheme) {
    if (userTheme) {
        settings.value("emulator.theme", userTheme);
    } else {
        userTheme = settings.value("emulator.theme");
    }   
    app.applicationMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    let systemTheme = userTheme === "purple" ? "system" : userTheme;
    nativeTheme.themeSource = systemTheme;
    if (userTheme === "system") {
        userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    global.sharedObject.theme = userTheme;
    return userTheme;
}

export function getEmulatorOption(key) {
    let options = settings.value("emulator.options");
    return options ? options.includes(key) : false;
}

export function setEmulatorOption(key, enable, menuId) {
    let options = settings.value("emulator.options");
    if (options) {
        if (enable && !options.includes(key)) {
            options.push(key);
        } else if (!enable && options.includes(key)) {
            options = options.filter(item => item !== key);
        }
        settings.value("emulator.options", options);
        if (menuId) {
            app.applicationMenu.getMenuItemById(menuId).checked = enable;
        }
    }
}

export function updateTimeZone(window) {
    let timeZone = settings.value("localization.timeZone");
    if (timeZone) {
        const di = global.sharedObject.deviceInfo;
        const dt = DateTime.now().setZone(timeZone.replace("Other/", ""));
        if (dt.invalidReason) {
            console.warn(`Warning: ${dt.invalidReason} - ${dt.invalidExplanation}`);
            return;
        }
        const timeZoneIANA = timeZone === "system" ? dt.zoneName : timeZone;
        if (di.timeZoneIANA !== timeZoneIANA) {
            di.timeZone = timeZoneLabels.get(timeZoneIANA) || timeZoneIANA;
            di.timeZoneIANA = timeZoneIANA;
            di.timeZoneAuto = timeZone === "system";
            di.timeZoneOffset = dt.offset;
            if (window) {
                window.webContents.send("setDeviceInfo", "timeZone", di.timeZone); // TODO: Implement the handling of this message
            }
        }    
    }
}

// Data Arrays

function getRokuModelArray() {
    return [
        { value: "N1050", label: "Roku SD Classic - N1050" },
        { value: "N1000", label: "Roku DVP Classsic - N1000" },
        { value: "N1100", label: "Roku HD Classsic - N1100" },
        { value: "N1101", label: "Roku HD-XR Classic - N1101" },
        { value: "2050X", label: "Roku XD - 2050X" },
        { value: "2050N", label: "Roku XD - 2050N" },
        { value: "2100X", label: "Roku XD|S - 2100X" },
        { value: "2100N", label: "Roku XD|S - 2100N" },
        { value: "2000C", label: "Roku HD - 2000C" },
        { value: "2400X", label: "Roku LT - 2400X" },
        { value: "2450X", label: "Roku LT - 2450X" },
        { value: "2500X", label: "Roku HD - 2500X" },
        { value: "2710X", label: "Roku 1 - 2710X" },
        { value: "2700X", label: "Roku LT (3d. Gen) - 2700X" },
        { value: "2710SE", label: "Roku SE - 2710SE" },
        { value: "2720X", label: "Roku 2 - 2720X" },
        { value: "3000X", label: "Roku 2 HD - 3000X" },
        { value: "3050X", label: "Roku 2 XD - 3050X" },
        { value: "3100X", label: "Roku 2 XS - 3100X" },
        { value: "4200X", label: "Roku 3 - 4200X" },
        { value: "4210X", label: "Roku 3 (US) - 4210X" },
        { value: "4230X", label: "Roku 3 (US) - 4230X" },
        { value: "4400X", label: "Roku 4 - 4400X" },
        { value: "4500SK", label: "Sky Now TV (UK) - 4500SK" },
        { value: "3400X", label: "Roku Stick - 3400X" },
        { value: "3420X", label: "Roku Stick - 3420X" },
        { value: "3500X", label: "Roku Stick (HDMI) - 3500X" },
        { value: "3600X", label: "Roku Stick (2016) - 3600X" },
        { value: "5000X", label: "Roku TV (MIPS) - 5000X" },
        { value: "6000X", label: "4K Roku TV - 6000X" },
        { value: "7000X", label: "4K Roku TV (TCL) - 7000X" },
        { value: "3700X", label: "Roku Express - 3700X" },
        { value: "3710X", label: "Roku Express+ - 3710X" },
        { value: "4620X", label: "Roku Premiere - 4620X" },
        { value: "4630X", label: "Roku Premiere+ - 4630X" },
        { value: "3920X", label: "Roku Premiere (2018) - 3920X" },
        { value: "3921X", label: "Roku Premiere+ (2018) - 3921X" },
        { value: "3800X", label: "Roku Stick (2017) - 3800X" },
        { value: "3810X", label: "Roku Stick+ - 3810X" },
        { value: "3900X", label: "Roku Express (2017) - 3900X" },
        { value: "3900EU", label: "Roku Express EU (2017) - 3900EU" },
        { value: "3910X", label: "Roku Express+ (2017) - 3910X" },
        { value: "3930X", label: "Roku Express (2019) - 3930X" },
        { value: "3931X", label: "Roku Express+ (2019) - 3931X" },
        { value: "3940X", label: "Roku Express 4K - 3940X" },
        { value: "3941X", label: "Roku Express 4K+ - 3941X" },
        { value: "4640X", label: "Roku Ultra - 4640X" },
        { value: "4660X", label: "Roku Ultra (2017) - 4660X" },
        { value: "4661X", label: "Roku Ultra (2018) - 4661X" },
        { value: "4662X", label: "Roku Ultra LT - 4662X" },
        { value: "4670X", label: "Roku Ultra (2019) - 4670X" },
        { value: "4800X", label: "Roku Ultra (2020) - 4800X" },
        { value: "8000X", label: "Roku TV (ARM) - 8000X" },
        { value: "9100X", label: "Roku Smart Soundbar - 9100X" },
        { value: "9102X", label: "Roku Streambar - 9102X" },
        { value: "A000X", label: "Roku TV 4K - A000X" },
        { value: "C000X", label: "Roku TV 4K - C000X" },
    ]    
}

function getLocaleIdArray() {
    return [
        { value: "en_US", label: "US English (en-US)" },
        { value: "en_GB", label: "British English (en-GB)" },
        { value: "fr_CA", label: "Canadian French (fr-CA)" },
        { value: "es_ES", label: "International Spanish (es-ES)" },
        { value: "es_MX", label: "Mexican Spanish (es-MX)" },
        { value: "de_DE", label: "German (de-DE)" },
        { value: "it_IT", label: "Italian (it-IT)" },
        { value: "pt_BR", label: "Brazilian Portuguese (pt-BR)" },
    ];
}

function getCountryArray() {
    return [
        { label: "United States (US)", value: "US" },
        { label: "Argentina (AR)", value: "AR" },
        { label: "Brazil (BR)", value: "BR" },
        { label: "Canada (CA)", value: "CA" },
        { label: "Chile (CL)", value: "CL" },
        { label: "Colombia (CO)", value: "CO" },
        { label: "Costa Rica (CR)", value: "CR" },
        { label: "El Salvador (SV)", value: "SV" },
        { label: "France (FR)", value: "FR" },
        { label: "Guatemala (GT)", value: "GT" },
        { label: "Germany (DE)", value: "DE" },
        { label: "Honduras (HN)", value: "HN" },
        { label: "Ireland (IE)", value: "IE" },
        { label: "Mexico (MX)", value: "MX" },
        { label: "Nicaragua (NI)", value: "NI" },
        { label: "Panama (PA)", value: "PA" },
        { label: "Peru (PE)", value: "PE" },
        { label: "United Kingdom (GB)", value: "GB" },
        { label: "Rest of the World (OT)", value: "OT" },
    ]
}

function getTimezonArray() {
    const dt = DateTime.now().setZone("system");
    const tzArray = [
        { label: `System: ${dt.zoneName}`, value: "system" },
        { label: "US/Puerto Rico-Virgin Islands", value: "America/Antigua" },
        { label: "US/Guam", value: "Pacific/Truk" },
        { label: "US/Samoa ", value: "Pacific/Pago_Pago" },
        { label: "US/Hawaii" },
        { label: "US/Aleutian" },
        { label: "US/Alaska" },
        { label: "US/Pacific" },
        { label: "US/Arizona", value: "America/Phoenix" },
        { label: "US/Mountain" },
        { label: "US/Central" },
        { label: "US/Eastern" },
        { label: "Canada/Pacific" },
        { label: "Canada/Mountain" },
        { label: "Canada/Central" },
        { label: "Canada/Eastern" },
        { label: "Canada/Mountain Standard", value: "America/Creston" },
        { label: "Canada/Central Standard", value: "America/Regina" },
        { label: "Canada/Atlantic" },
        { label: "Canada/Newfoundland" },
        { label: "Mexico/Pacific", value: "America/Santa_Isabel" },
        { label: "Mexico/Mountain", value: "America/Chihuahua" },
        { label: "Mexico/Central", value: "America/Bahia_Banderas" },
        { label: "Mexico/Eastern", value: "America/Cancun" },
        { label: "America/Argentina/Buenos_Aires" },
        { label: "America/Santiago" },
        { label: "America/Bogota" },
        { label: "America/Costa_Rica" },
        { label: "America/El_Salvador" },
        { label: "America/Guatemala" },
        { label: "America/Tegucigalpa" },
        { label: "America/Managua" },
        { label: "America/Panama" },
        { label: "America/Lima" },
        { label: "America/Campo_Grande" },
        { label: "America/Fortaleza" },
        { label: "America/Manaus" },
        { label: "America/Noronha" },
        { label: "America/Rio_Branco" },
        { label: "America/Sao_Paulo" },
        { label: "Europe/Iceland", value: "Atlantic/Reykjavik" },
        { label: "Europe/Ireland", value: "Europe/Dublin" },
        { label: "Europe/United Kingdom", value:"Europe/Guernsey" },
        { label: "Europe/Portugal", value: "Europe/Lisbon" },
        { label: "Europe/Central European Time", value: "Europe/Amsterdam" },
        { label: "Europe/France", value: "Europe/Paris" },
        { label: "Europe/Greece/Finland", value: "Europe/Athens" },
        { label: "Australia/WA", value: "Australia/Perth" },
        { label: "Australia/Eucla" },
        { label: "Australia/NT", value: "Australia/Darwin" },
        { label: "Australia/SA", value: "Australia/Adelaide" },
        { label: "Australia/QLD", value: "Australia/Brisbane" },
        { label: "Australia/Lord Howe", value: "Australia/LHI" },
        { label: "Australia/NSW" },
        { label: "Australia/VIC", value: "Australia/Melbourne" },
        { label: "Australia/TAS", value: "Australia/Currie" },
        { label: "Australia/ACT" },
        { label: "Africa/CAT", value: "Africa/Bujumbura" },
        { label: "Africa/CET", value: "Africa/Algiers" },
        //{ label: "Africa/CVT" },
        { label: "Africa/EAT", value: "Africa/Asmera" },
        { label: "Africa/EET", value: "Africa/Cairo" },
        { label: "Africa/GMT", value: "Africa/Abidjan" },
        { label: "Africa/MUT", value: "Indian/Mauritius" },
        { label: "Africa/RET", value: "Indian/Reunion" },
        { label: "Africa/SAST", value: "Africa/Johannesburg" },
        // { label: "Africa/SCT" },
        // { label: "Africa/WAST" },
        { label: "Africa/WAT", value: "Africa/Bangui"},
        { label: "Africa/WEST", value: "Atlantic/Madeira" },
        { label: "Africa/WET", value: "Africa/Casablanca" },
        // { label: "Africa/WST" },
        // { label: "Africa/WT" },
        { label: "Asia/Arabia", value:"Asia/Aden" },
        { label: "Asia/Afghanistan", value: "Asia/Kabul" },
        { label: "Asia/Alma-Ata", value: "Asia/Almaty" },
        { label: "Asia/Anadyr" },
        { label: "Asia/Aqtobe" },
        { label: "Asia/Armenia", value: "Asia/Yerevan" },
        { label: "Asia/Azerbaijan", value: "Asia/Baku" },
        { label: "Asia/Bangladesh", value: "Asia/Dhaka" },
        { label: "Asia/Bhutan", value: "Asia/Thimphu" },
        { label: "Asia/Brunei" },
        { label: "Asia/China", value: "Asia/Chongqing" },
        { label: "Asia/Choibalsan" },
        { label: "Asia/EastTimor", value: "Asia/Dili" },
        { label: "Asia/Georgia", value: "Asia/Tbilisi" },
        { label: "Asia/Gulf", value: "Asia/Dubai" },
        { label: "Asia/Hong_Kong" },
        { label: "Asia/Hovd" },
        { label: "Asia/India", value: "Asia/Calcutta" },
        { label: "Asia/Indochina", value: "Asia/Bangkok" },
        { label: "Asia/Irkutsk" },
        { label: "Asia/Japan", value: "Asia/Tokyo" },
        { label: "Asia/Kamchatka" },
        { label: "Asia/Korea", value: "Asia/Pyongyang" },
        { label: "Asia/Krasnoyarsk" },
        { label: "Asia/Kyrgyzstan", value: "Asia/Bishkek" },
        { label: "Asia/Malaysia", value: "Asia/Kuala_Lumpur" },
        { label: "Asia/Magadan" },
        { label: "Asia/Myanmar", value: "Asia/Rangoon" },
        { label: "Asia/Nepal", value: "Asia/Kathmandu" },
        { label: "Asia/Novosibirsk" },
        { label: "Asia/Omsk" },
        { label: "Asia/Oral" },
        { label: "Asia/Pakistan", value: "Asia/Karachi" },
        { label: "Asia/Philippines", value: "Asia/Manila" },
        { label: "Asia/Qyzylorda" },
        { label: "Asia/Sakhalin" },
        { label: "Asia/Singapore" },
        { label: "Asia/Tajikistan", value: "Asia/Dushanbe" },
        { label: "Asia/Turkmenistan", value: "Asia/Ashgabat" },
        { label: "Asia/Uzbekistan", value: "Asia/Samarkand" },
        { label: "Asia/Ulaanbaatar" },
        { label: "Asia/Vladivostok" },
        { label: "Asia/Yakutsk" },
        { label: "Asia/Yekaterinburg" },
        { label: "Asia/Eastern Indonesia", value: "Asia/Jayapura" },
        { label: "Asia/Central Indonesia", value: "Asia/Makassar" },
        { label: "Asia/Western Indonesia", value: "Asia/Jakarta" },
        { label: "Asia/Beirut" },
        { label: "Asia/Damascus" },
        { label: "Asia/Gaza" },
        { label: "Asia/Nicosia" },
        { label: "Other/UTC-11" },
        { label: "Other/UTC-10" },
        { label: "Other/UTC-9" },
        { label: "Other/UTC-8" },
        { label: "Other/UTC-7" },
        { label: "Other/UTC-6" },
        { label: "Other/UTC-5" },
        { label: "Other/UTC-4" },
        { label: "Other/UTC-3" },
        { label: "Other/UTC-2" },
        { label: "Other/UTC-1" },
        { label: "Other/UTC+0" },
        { label: "Other/UTC+1" },
        { label: "Other/UTC+2" },
        { label: "Other/UTC+3" },
        { label: "Other/UTC+4" },
        { label: "Other/UTC+5" },
        { label: "Other/UTC+6" },
        { label: "Other/UTC+7" },
        { label: "Other/UTC+8" },
        { label: "Other/UTC+9" },
        { label: "Other/UTC+10" },
        { label: "Other/UTC+11" },
        { label: "Other/UTC+12" },
        { label: "Other/UTC+13" },
        { label: "Other/UTC+14" },
    ]
    tzArray.forEach(function(item) {
        timeZoneLabels.set(item.value || item.label, item.label);
    });
    return tzArray;
}