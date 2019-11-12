# BrightScript 2D API Emulator - Desktop App

This project was created to build a _multiplatform desktop application_ for the **BrightScript 2D API emulator**, please follow the link below to visit the emulator repository and read about the project features (and limitations):
- http://github.com/lvcabral/brs-emu

The binaries of this application are released together with the emulator library at:
- https://github.com/lvcabral/brs-emu/releases

## Documentation

### Color Themes
![Screen Themes](/../master/docs/images/screeshot-themes.png?raw=true)

### Remote Control Emulation

* [Control Keyboard Reference](https://github.com/lvcabral/brs-emu-app/blob/master/docs/control-reference.md)

### Command Line Options

Here are **optional** arguments you can use when starting the emulator at the command line:

```
"BrightScript Emulator" [-o <path>] [-f] [-m <mode>] [-e] [-i] [-p <newpwd>] [-d]

"BrightScript Emulator" [<path>] [--fullscreen] [--mode=<dm>] [--ecp] [--installer] [--pwd=<newpwd>] [--devtools]
```

|Argument                                |Description                                                                  |
|----------------------------------------|-----------------------------------------------------------------------------|
|**-o** `<path>` or `<path>`             | Opens  a `.zip` or `.brs` when starting the emulator.                       |
|**-f** or **--fullscreen**             | Opens the emulator in **full screen mode** (double-click screen to restore).|
|**-m** `<dm>` or **--mode=**`<dm>`     | Change the **display mode**. Options are: `sd`, `hd`, or `fhd`              |
|**-e** or **--ecp**                     | Enables [ECP and SSDP servers](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md) to allow remote control and detection.   |
|**-i** or **--installer**               | Enables **Web Installer** (port 80) and **Telnet Server** (port 8085).     |
|**-p** `<newpwd>` or **--pwd=**`<newpwd>`| Changes (and saves) the **Web Installer** password.                      |
|**-d** or **--devtools**                | Opens the **developer tools** when starting the emulator.                  |

## Author Links
- My website is [https://lvcabral.com](https://lvcabral.com)
- My twitter is [@lvcabral](https://twitter.com/lvcabral)
- My podcast is [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories ](https://github.com/lvcabral)

## License

Copyright © 2019 Marcelo Lv Cabral. All rights reserved.

Licensed under [MIT](LICENSE) License.
