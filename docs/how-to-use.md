# How to Use the Application

## Menu Options
This section will describe the options available on the application menu, please notice that in **macOS** the options will be possibly in different location, as the OS has different standards than **Windows** an **Linux**.

<p align="center">
<img alt="Emulator Web and Desktop" src="images/app-menu.gif?raw=true"/>
</p>

### File Menu

- Open Channel Package
- Open Source File
- Open Recent
- Save Screenshot
- Close Channel

### Edit Menu

- Copy Screenshot
- Settings

### Device Menu

- Display Modes
- TV Overscan Modes
- Web Application Installer
- External Control Protocol
- BrightScript Remote Console
- Reset Device

### View Menu

- Full Screen
- Color Themes</br>
![Screen Themes](images/screeshot-themes.png?raw=true)
- Status Bar

### Help Menu

- Documentation
- Control Keyboard Reference
- Release Notes
- View License
- Check for Update
- About

## Command Line Options

Here are **optional** arguments you can use when starting the emulator at the command line:

```
"BrightScript Emulator" [-o <path>] [-f] [-m <dm>] [-e] [-t] [-w [<port>]] [-p <newpwd>] [-d]

"BrightScript Emulator" [<path>] [--fullscreen] [--mode=<dm>] [--ecp] [--rc] 
                        [--web[=<port>]] [--pwd=<newpwd>] [--devtools]
```

|Argument                                |Description                                                                  |
|----------------------------------------|-----------------------------------------------------------------------------|
|**-o** `<path>` or `<path>`             | Opens  a `.zip` or `.brs` when starting the emulator.                       |
|**-f** or **--fullscreen**             | Opens the emulator in **full screen mode** (double-click screen to switch).|
|**-m** `<dm>` or **--mode=**`<dm>`     | Changes the **display mode**. Options are: `sd`, `hd`, or `fhd`              |
|**-e** or **--ecp**                     | Enables [ECP and SSDP servers](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md) to allow remote control and detection.|
|**-r** or **--rc**                 | Enables a telnet server on port 8085 to allow **Remote Console** monitoring.|
|**-w** `[<port>]` or **--web**`[=<port>]`   | Enables **Web Installer** on port 80, optionally set a custom `<port>`|
|**-p** `<newpwd>` or **--pwd=**`<newpwd>`| Changes the **Web Installer** password and saves it on local storage. |
|**-d** or **--devtools**                | Opens the **developer tools** when starting the emulator.              |
