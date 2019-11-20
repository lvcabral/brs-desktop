# Remote Access Services

The **BrightScript Emulator** desktop app, the same way all Roku devices, implements some remote access services in order to enable automation and monitoring of the channels being executed. It allows among other possibilities, to integrate the emulator to the [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript). Below you will find a quick referece documentation about the services available.

## Web Application Installer

This service allows to remotely _side load_ a channel in the emulator, it has a web interface that can be accessed using a web browser, or any http client application. It also has a `Utilities` option where the user can request a screenshot of the currently running channel.

<p align="center">
<img alt="Emulator Web Installer" src="images/web-installer.png"/>
</p>

The Web Installer is disabled by default and when enabled it listens to the TCP port 80 and requires authentication to be used. Because this port is the default HTTP port, it may cause conflict with existing services or be blocked by IT security policies. To overcome that, is possible to run the emulator with the command line `--web=<newport>` to load the Web Installer listening to the defined port, this option is saved in the app local storage. An icon is shown in the status bar with the listening port number indicating the service is active, if the icon is clicked it will opoen the Web Installer page on the default driver (image above).

The Web Installer default user and password are both `rokudev`, the password can be changed (and saved) by using the command line `--pwd=<newpwd>`.

## ECP (External Control Protocol)

Once it's enabled the ECP API allows the emulator to be controlled over the network by providing a number of external control services. When the ECP is enabled it is discoverable using **SSDP** (Simple Service Discovery Protocol) just like a Roku device. ECP is a simple RESTful API that can be accessed by programs in virtually any programming environment. Please check the [ECP official documentation](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md) for detailed documentation of the protocol.

The ECP listens to the TCP port 8060 and is disabled by default, it can be enabled either by using the options under the [Device Menu](how-to-use.md#device-menu) or via the [command line option](how-to-use.md#command-line-options) `--ecp`. An icon on the status bar with the port number indicates that the service is active, if the icon is clicked it shows the XML result of the `query/device-info` command on the default browser.

### Emulator Implementation

The emulator desktop app only implements a subset of ECP commands, here a list of supported commands:

| Command             | Description                                                                                                       |
|---------------------|-------------------------------------------------------------------------------------------------------------------|
| query/device-info   | Retrieves device information similar to that returned by roDeviceInfo. (HTTP GET) |
| query/apps          | Returns a map of all the recent opened channels paired with their application ID. (HTTP GET) |
| query/active-app    | Returns a child element named 'app' with the active application, in the same format as 'query/apps'. (HTTP GET) |
| query/icon/`appID`  | Returns an icon corresponding to the application identified by appID. (HTTP GET) |
| launch/`appID`      | Launches the channel identified by appID. (HTTP POST) |
| keypress/`key`      | Equivalent to pressing down and releasing the remote control key identified after the slash. (HTTP POST) |
| keydown/`key`       | Equivalent to pressing the remote control key identified after the slash. (HTTP POST) |
| keyup/`key`         | Equivalent to releasing the remote control key identified after the slash. (HTTP POST) |

**Note:** The Application ID in the emulator is a simple hash of the full path of the channel zip file.

## BrightScript Remote Console

The remote console can be accessed using telnet through a shell application such as [PuTTY](http://www.putty.org/) for Windows or terminal on Mac and Linux:
```
telnet <emulator-ip-address> 8085
```
Unlike a Roku device, the emulator still do not allow interactive debugging using the remote console, currently it only displays console output (`print` statements results and exceptions). However there are a couple of commands that can be executed using the remote console:
- `exit` or `quit` - Finishes current channel execution
- `close` - Disconnect from the remote console
- `help` - Show a list of supported commands

If the Remote Console is enabled an icon is shown in the status bar together with the port number 8085.