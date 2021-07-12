import { app, nativeTheme } from "electron";
import path from "path";
import ElectronPreferences from "electron-preferences";
import { enableECP, disableECP } from "../servers/ecp";
import { enableTelnet, disableTelnet } from "../servers/telnet";
import { enableInstaller, disableInstaller, setPort, hasInstaller, setPassword } from "../servers/installer";

const isMacOS = process.platform === "darwin";
let settings;

export function getSettings(window) {
    if (settings === undefined) {
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
                    timeZone: "detected"
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
                width: 800,
                maxWidth: 800,
                height: 630,
                maxHeight: 630,
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
                                        help: "Maximum number of audio streams that can be mixed together and presented simultaneously"
                                    },
                                    {
                                        label: "Sound Effects Volume",
                                        key: "audioVolume",
                                        type: "slider",
                                        min: 0,
                                        max: 100,
                                        help: "User interface sound effects volume level"
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
                                        help: "Configure channel localization, this setting doesn't affect the emulator UI only channels"
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
                                        help: "Configure the country store associated with the device"
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
        setThemeSource(settings.preferences);
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
                window.webContents.send("setTheme", setThemeSource(preferences));
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

export function setThemeSource(preferences) {
    let userTheme = preferences.emulator.theme || "purple";
    let systemTheme = userTheme === "purple" ? "system" : userTheme;
    app.applicationMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
    nativeTheme.themeSource = systemTheme;
    if (userTheme === "system") {
        userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    global.sharedObject.theme = userTheme;
    return userTheme;
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
            if (!isMacOS) {
                enable = !enable; // For some reason the toolbar has inverted logic in Windows
            }
            app.applicationMenu.getMenuItemById(menuId).checked = enable;
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
    return [
        { label: `Detected: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, value: "detected" },
        { label: "US/Puerto Rico-Virgin Islands" },
        { label: "US/Guam" },
        { label: "US/Samoa " },
        { label: "US/Hawaii" },
        { label: "US/Aleutian" },
        { label: "US/Alaska" },
        { label: "US/Pacific" },
        { label: "US/Arizona" },
        { label: "US/Mountain" },
        { label: "US/Central" },
        { label: "US/Eastern" },
        { label: "Canada/Pacific" },
        { label: "Canada/Mountain" },
        { label: "Canada/Central" },
        { label: "Canada/Eastern" },
        { label: "Canada/Mountain Standard" },
        { label: "Canada/Central Standard" },
        { label: "Canada/Atlantic" },
        { label: "Canada/Newfoundland" },
        { label: "Mexico/Pacific" },
        { label: "Mexico/Mountain" },
        { label: "Mexico/Central" },
        { label: "Mexico/Eastern" },
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
        { label: "Europe/Iceland" },
        { label: "Europe/Ireland" },
        { label: "Europe/United Kingdom" },
        { label: "Europe/Portugal" },
        { label: "Europe/Central European Time" },
        { label: "Europe/France" },
        { label: "Europe/Greece/Finland" },
        { label: "Australia/WA" },
        { label: "Australia/Eucla" },
        { label: "Australia/NT" },
        { label: "Australia/SA" },
        { label: "Australia/QLD" },
        { label: "Australia/Lord Howe" },
        { label: "Australia/NSW" },
        { label: "Australia/VIC" },
        { label: "Australia/TAS" },
        { label: "Australia/ACT" },
        { label: "Asia/Arabia" },
        { label: "Asia/Afghanistan" },
        { label: "Asia/Alma-Ata" },
        { label: "Asia/Anadyr" },
        { label: "Asia/Aqtobe" },
        { label: "Asia/Armenia" },
        { label: "Asia/Azerbaijan" },
        { label: "Asia/Bangladesh" },
        { label: "Asia/Bhutan" },
        { label: "Asia/Brunei" },
        { label: "Asia/China" },
        { label: "Asia/Choibalsan" },
        { label: "Asia/EastTimor" },
        { label: "Asia/Georgia" },
        { label: "Asia/Gulf" },
        { label: "Asia/Hong Kong" },
        { label: "Asia/Hovd" },
        { label: "Asia/India" },
        { label: "Asia/Indochina" },
        { label: "Asia/Irkutsk" },
        { label: "Asia/Japan" },
        { label: "Asia/Kamchatka" },
        { label: "Asia/Korea" },
        { label: "Asia/Krasnoyarsk" },
        { label: "Asia/Kyrgyzstan" },
        { label: "Asia/Malaysia" },
        { label: "Asia/Magadan" },
        { label: "Asia/Myanmar" },
        { label: "Asia/Nepal" },
        { label: "Asia/Novosibirsk" },
        { label: "Asia/Omsk" },
        { label: "Asia/Oral" },
        { label: "Asia/Pakistan" },
        { label: "Asia/Philippines" },
        { label: "Asia/Qyzylorda" },
        { label: "Asia/Sakhalin" },
        { label: "Asia/Singapore" },
        { label: "Asia/Tajikistan" },
        { label: "Asia/Turkmenistan" },
        { label: "Asia/Uzbekistan" },
        { label: "Asia/Ulaanbaatar" },
        { label: "Asia/Vladivostok" },
        { label: "Asia/Yakutsk" },
        { label: "Asia/Yekaterinburg" },
        { label: "Asia/Eastern Indonesia" },
        { label: "Asia/Central Indonesia" },
        { label: "Asia/Western Indonesia" },
        { label: "Asia/Beirut" },
        { label: "Asia/Damascus" },
        { label: "Asia/Gaza" },
        { label: "Asia/Nicosia" },
        { label: "Africa/CAT" },
        { label: "Africa/CET" },
        { label: "Africa/CVT" },
        { label: "Africa/EAT" },
        { label: "Africa/EET" },
        { label: "Africa/GMT" },
        { label: "Africa/MUT" },
        { label: "Africa/RET" },
        { label: "Africa/SAST" },
        { label: "Africa/SCT" },
        { label: "Africa/WAST" },
        { label: "Africa/WAT" },
        { label: "Africa/WEST" },
        { label: "Africa/WET" },
        { label: "Africa/WST" },
        { label: "Africa/WT" },
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
}