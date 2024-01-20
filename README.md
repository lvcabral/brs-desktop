# BrightScript Simulator - Desktop Application
<p align="center">
<img alt="Simulator Desktop Apps" src="docs/images/brs-desktop.png?raw=true"/>
</p>

![GitHub](https://img.shields.io/github/license/lvcabral/brs-desktop)
[![Build](https://github.com/lvcabral/brs-desktop/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-desktop/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu-app&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu-app)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu-app&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu-app)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)


This project was created to develop a _multiplatform desktop application_ for the **BrightScript Simulation Engine**, please visit the engine library repository and know all about the project history, features and limitations: http://github.com/lvcabral/brs-engine

The objective of this application is to extend the `brs-engine`, making it a full Roku device simulator, providing features such as:

- Web Installer (default port 80), allowing deploy of sideloaded apps and screenshots.
- ECP Service (default port 8060), that allows automation and data integration with external applications.
- ECP-2 Service (websockets), supporting the Roku mobile application to control the simulator.
- Telnet Server (port 8085), enabling remote Debugging.
- Customization of display, device model and information, controls and localization.

This way, the desktop simulator can be detected and handled by the [VS Code BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=RokuCommunity.brightscript), and other development tools, as a real Roku device, for deploy and debugging. You can find the installers for this desktop application (for all platforms) at this reporitory [Releases](releases) page.

## Documentation

Below you will find the links for the documentation of this project, how to use, build and contribute to the application.

### Application Architecture

- [Overview Diagram](docs/images/brs-desktop-architecture-overview.png)

### How to Use the Application

- [Menu Options](docs/how-to-use.md#menu-options)
- [Settings Screen](docs/how-to-use.md#settings-screen)
- [Command Line Options](docs/how-to-use.md#command-line-options)
- [Keyboard and Game Pad Control](docs/control-reference.md)
- [Remote Access Services](docs/remote-access.md)

### Contributing

- [How to build from source](docs/build-from-source.md)
- [How to contribute](docs/contributing.md)

### Changelog

- Click [here](CHANGELOG.md) to view the release changelog.

## Developer Links

- My website: [https://lvcabral.com](https://lvcabral.com)
- My threads: [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My twitter: [@lvcabral](https://twitter.com/lvcabral)
- My podcast: [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## License

Copyright © 2019-2024 Marcelo Lv Cabral. All rights reserved.

Licensed under [MIT](LICENSE) License.
