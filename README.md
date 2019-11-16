# BrightScript 2D API Emulator - Desktop App

This project was created to build a _multiplatform desktop application_ for the **BrightScript 2D API emulator**, please follow the link below to visit the emulator repository and read about the project features (and limitations):
- http://github.com/lvcabral/brs-emu

The binaries of this application are released together with the emulator library at:
- https://github.com/lvcabral/brs-emu/releases



## Documentation

### Contributing

There are many ways in which you can participate in the project, read documents below to know the details:

* [How to contribute](docs/contributing.md)
* [How to build from source](docs/build-from-source.md)

### Color Themes
![Screen Themes](docs/images/screeshot-themes.png?raw=true)

### Remote Control Emulation

* [Control Keyboard Reference](docs/control-reference.md)

### Command Line Options

Here are **optional** arguments you can use when starting the emulator at the command line:

```
"BrightScript Emulator" [-o <path>] [-f] [-m <dm>] [-e] [-t] [-w [<port>]] [-p <newpwd>] [-d]

"BrightScript Emulator" [<path>] [--fullscreen] [--mode=<dm>] [--ecp] [--rc] 
                        [--web[=<port>]] [--pwd=<newpwd>] [--devtools]
```

|Argument                                |Description                                                                  |
|----------------------------------------|-----------------------------------------------------------------------------|
|**-o** `<path>` or `<path>`             | Opens  a `.zip` or `.brs` when starting the emulator.                       |
|**-f** or **--fullscreen**             | Opens the emulator in **full screen mode** (double-click screen to restore).|
|**-m** `<dm>` or **--mode=**`<dm>`     | Changes the **display mode**. Options are: `sd`, `hd`, or `fhd`              |
|**-e** or **--ecp**                     | Enables [ECP and SSDP servers](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md) to allow remote control and detection.|
|**-r** or **--rc**                 | Enables a telnet server on port 8085 to allow **Remote Console** monitoring.|
|**-w** `[<port>]` or **--web**`[=<port>]`   | Enables **Web Installer** on port 80, optionally set a custom `<port>`|
|**-p** `<newpwd>` or **--pwd=**`<newpwd>`| Changes the **Web Installer** password and saves it on local storage. |
|**-d** or **--devtools**                | Opens the **developer tools** when starting the emulator.              |

## Author Links
- My website is [https://lvcabral.com](https://lvcabral.com)
- My twitter is [@lvcabral](https://twitter.com/lvcabral)
- My podcast is [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories ](https://github.com/lvcabral)

## License

Copyright © 2019 Marcelo Lv Cabral. All rights reserved.

Licensed under [MIT](LICENSE) License.
