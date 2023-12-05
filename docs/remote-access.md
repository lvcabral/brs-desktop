# Remote Access Services

The **BrightScript Simulator** desktop app, the same way all Roku devices, implements some remote access services in order to enable automation and monitoring of the apps being executed. It allows among other possibilities, to integrate the emulator to the [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript). Below you will find a quick referece documentation about the services available.

## Web Application Installer

This service allows to remotely _side load_ an app in the emulator, it has a web interface that can be accessed using a web browser, or any _HTTP_ client application. It also has a `Utilities` option where the user can request a screenshot of the currently running app.

<p align="center">
<img alt="Emulator Web Installer" src="images/web-installer.png?raw=true"/>
</p>

The **Web Installer** is disabled by default and when enabled it listens to the _TCP_ port 80 and requires authentication to be used. Because this port is the default _HTTP_ port, it may cause conflict with existing services or be blocked by IT security policies. To overcome that, is possible to run the emulator with the command line `--web=<newport>` to load the Web Installer listening to the defined port, this option is saved in the app local storage. An icon is shown in the status bar with the listening port number indicating the service is active, if the icon is clicked it will open the Web Installer page on the default driver (image above).

The **Web Installer** default user and password are both `rokudev`, the password can be changed (and saved) by using the command line `--pwd=<newpwd>`.

## ECP (External Control Protocol)

Once it's enabled the **ECP API** allows the emulator to be controlled over the network by providing a number of external control commands. When the **ECP** is enabled it is discoverable using **SSDP** (Simple Service Discovery Protocol) just like a Roku device. **ECP** is a simple _RESTful API_ that can be accessed by programs in virtually any programming environment. Please check the [ECP official documentation](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md) for detailed documentation of the protocol.

The **ECP** listens to the _TCP_ port 8060 and is disabled by default, it can be enabled either by using the options under the [Device Menu](how-to-use.md#device-menu) or via the [command line option](how-to-use.md#command-line-options) `--ecp`. An icon on the status bar with the port number indicates that the service is active, if the icon is clicked it shows the XML result of the `query/device-info` command on the default browser.

### Supported Commands

The **BrightScript Simulator** desktop app only implements a subset of **ECP** commands, here a list of supported commands:

| Command             | Description                                                                                                       |
|---------------------|-------------------------------------------------------------------------------------------------------------------|
| query/device-info   | Retrieves device information similar to that returned by roDeviceInfo. (HTTP GET) |
| query/apps          | Returns a map of all the recent opened apps paired with their application ID. (HTTP GET) |
| query/active-app    | Returns a child element named 'app' with the active application, in the same format as 'query/apps'. (HTTP GET) |
| query/icon/`appID`  | Returns an icon corresponding to the application identified by appID. (HTTP GET) |
| launch/`appID`      | Launches the app identified by appID. (HTTP POST) |
| keypress/`key`      | Equivalent to pressing down and releasing the remote control key identified after the slash. (HTTP POST) |
| keydown/`key`       | Equivalent to pressing the remote control key identified after the slash. (HTTP POST) |
| keyup/`key`         | Equivalent to releasing the remote control key identified after the slash. (HTTP POST) |

**Note:** The Application ID in the emulator is a simple hash of the full path of the app zip/bpk file.

## BrightScript Remote Console

The **Remote Console** can be accessed using telnet through a shell application such as [PuTTY](http://www.putty.org/) for Windows or terminal on Mac and Linux:
```
$ telnet <emulator-ip-address> 8085
```
The emulator now supports the interactive debugging using the **Remote Console**, the list below has the Roku MicroDebugger commands currently implemented:

- `bt` - Print backtrace of call function context frames
- `cont|c` - Continue script execution
- `down|d` - Move down the function context chain one
- `exit|q` - Exit shell
- `gc` - Run garbage collector"
- `last|l` - Show last line that executed
- `next|n` - Show the next line to execute
- `list` - List current function
- `step|s|t` - Step one program statement
- `thread|th` - Show selected thread
- `threads|ths` - List all threads of execution
- `over|v` - Step over one program statement (for now act as step)
- `out|o` - Step out from current function (for now act as step)
- `var` - Display local variables and their types/values
- `print|p|?` - Print variable value or expression
- `exit` or `quit` - Finishes current app execution
- `close` - Disconnect from the remote console
- `help` - Show a list of supported commands

When the debugger is activated (either with `STOP` statement or via `Ctrl+Break`) you can type any expression for a live compile and run, in the context of the current function.


If the **Remote Console** is enabled an icon is shown in the status bar together with the port number 8085.
