<a name="v1.0.0"></a>

# [v1.0.0 - BrightScript Simulator](https://github.com/lvcabral/brs-desktop/releases/tag/v1.0.0) - 20 Jan 2024

After 4 years of Alpha and Beta stages, the project is stable and performant enough to finally be released as version 1.0 and with that, we decided to give it a new name:

## BrightScript Simulator

The term _simulator_ was chosen instead of the former _emulator_ to better represent the nature and purpose of the project, as there is no intention to fully emulate a Roku device (OS and Hardware), but rather simulate the behavior, as a development tool that allow us to run BrightScript apps in different platforms.

### Release Changes

* Renamed to "BrightScript Simulator" and updated the icon
* Upgraded `brs-engine` to v1.2.3
  * Added support for Game Pad controllers
  * Added support for `roVideoPlayer`
  * Added configurable limit for BrightScript app framerate
  * Added option to switch control behavior based on `manifest` entry
  * Added way to detect the BrightScript app is running on the simulator
  * Micro Debugger now can be triggered when a crash happens
  * Multiple fixes and improvements on BrightScript language support (see [engine changelog](https://github.com/lvcabral/brs-engine/blob/master/CHANGELOG.md))
* Upgraded `custom-electron-titlebar` to v4.2.8
  * Fixed issue with title moving left (Windows and Linux)
  * Fixed issue with menu alignment (Windows and Linux)
* Menu updates:
  * Reduced Menu options spacing
  * Open Dev Tools detached and enabled Edit commands on Mac OS
  * Changed Dev Tools shortcut to F12
* Settings screen updates:
  * Added new option `debugOnCrash` on settings
  * Added Developer Password option for decrypting `.bpk` packages
  * Added support for `maxFps` new display configuration
  * Added option to pause App when Simulator loses the focus
  * Updated Settings TitleBar customization
  * Updated Settings screen configuration on Mac OS
  * Fixed #143 - Edit commands are now working on Settings Screen in MacOS
  * Fixed Linux issue when showing Settings Screen
  * Fixed settings.css for Linux
* Remote Access Services updates:
  * Updated web Installer to support bpk, improve reliability
  * Updated initialization source for ECP and Installer to match Roku
  * ECP-2 now generates control events with remote type "RMOB"
  * Fixed: Do not disable Web Installer on error
* Closed #38 - Integrated `toastify` to show messages to the user
* About Box improvements for Mac OS
* Update dynamically AboutBox and Menu with package.json information
* Fixed TitleBar text alignment on old MacOS
* Removed several bugs and code smells reported by Sonar Cloud
* Added CHANGELOG.md
* Updated documentation

[Full Changelog][v1.0.0]

<a name="v0.10.31"></a>

# [v0.10.31 - Fixed Menu and Theme issues](https://github.com/lvcabral/brs-desktop/releases/tag/v0.10.31) - 22 Aug 2023

* Bump custom-electron-titlebar from 4.2.4 to 4.2.7 by [@lvcabral](https://github.com/lvcabral)
  * Fixed issue [#128](https://github.com/lvcabral/brs-desktop/issues/128)  (theme switch in macOS)
  * Fixed issue with menu hover in Windows and Linux
  * Fixed issue with debug console messages
* Bump async from 2.6.3 to 2.6.4 by [@dependabot](https://github.com/dependabot) in [#126](https://github.com/lvcabral/brs-desktop/pull/126)
* Bump ajv from 6.12.0 to 6.12.6 by [@dependabot](https://github.com/dependabot) in [#127](https://github.com/lvcabral/brs-desktop/pull/127)
* Bump glob-parent from 5.1.0 to 5.1.2 by [@dependabot](https://github.com/dependabot) in [#131](https://github.com/lvcabral/brs-desktop/pull/131)
* Bump semver from 5.7.1 to 5.7.2 by [@dependabot](https://github.com/dependabot) in [#132](https://github.com/lvcabral/brs-desktop/pull/132)

[Full Changelog][v0.10.31]

<a name="v0.10.30"></a>

# [v0.10.30 - Better Performance, Debugger and Settings screen](https://github.com/lvcabral/brs-desktop/releases/tag/v0.10.30) - 29 May 2023

* Refactored the app to use the new library [brs-emu v0.10.22](https://www.npmjs.com/package/brs-emu)
  * Improved performance, the simulation is multiple times faster than v0.9.x
  * App code was simplified with the usage of the new [engine API](https://github.com/lvcabral/brs-engine/blob/master/docs/engine-api.md)
* Upgrade electron, added settings screen and other improvements by [@lvcabral](https://github.com/lvcabral) in [#123](https://github.com/lvcabral/brs-desktop/pull/123)
  * Removed borders between the simulator display and the container window
  * Changed the application icon
  * Added a  **Settings screen** allowing new configurations and customizations
  * Added a switchable performance overlay to show rendering performance on the simulator display
  * Added support to the **Micro Debugger** via the telnet service, allowing debug using VSCode extension
  * Upgraded to Electron 20 and Webpack 5
  * Upgraded multiple dependencies
  * Fixed several small bugs
* Fixed SonarCloud bugs and code smells by [@lvcabral](https://github.com/lvcabral) in [#124](https://github.com/lvcabral/brs-desktop/pull/124)
* Upgrade `custom-electron-titlebar` dependency by [@lvcabral](https://github.com/lvcabral) in [#125](https://github.com/lvcabral/brs-desktop/pull/125)

[Full Changelog][v0.10.30]


<a name="v0.9.0-app"></a>

# [v0.9.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.9.0-app) - 28 Jun 2021

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.9.0-app]

<a name="v0.8.1-app"></a>

# [v0.8.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.8.1-app) - 07 Jun 2021

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.8.1-app]

<a name="v0.8.0-app"></a>

# [v0.8.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.8.0-app) - 11 Mar 2020

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.8.0-app]

<a name="v0.7.2-app"></a>

# [v0.7.2-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.2-app) - 02 Dec 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.2-app]

<a name="v0.7.1-app"></a>

# [v0.7.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.1-app) - 21 Nov 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.1-app]

<a name="v0.7.0-app"></a>

# [v0.7.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.0-app) - 17 Nov 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.0-app]

<a name="v0.6.0-app"></a>

# [v0.6.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.6.0-app) - 24 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.6.0-app]

<a name="v0.5.2-app"></a>

# [v0.5.2-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.2-app) - 09 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.2-app]

<a name="v0.5.1-app"></a>

# [v0.5.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.1-app) - 07 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.1-app]

<a name="v0.5.0-app"></a>

# [v0.5.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.0-app) - 07 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.0-app]

[v1.0.0]: https://github.com/lvcabral/brs-desktop/compare/v0.10.30...v1.0.0
[v0.10.31]: https://github.com/lvcabral/brs-desktop/compare/v0.10.30...v0.10.31
[v0.10.30]: https://github.com/lvcabral/brs-desktop/compare/v0.9.0-app...v0.10.30
[v0.9.0-app]: https://github.com/lvcabral/brs-desktop/compare/v0.8.1-app...v0.9.0-app
[v0.8.1-app]: https://github.com/lvcabral/brs-desktop/compare/v0.8.0-app...v0.8.1-app
[v0.8.0-app]: https://github.com/lvcabral/brs-desktop/compare/v0.7.2-app...v0.8.0-app
[v0.7.2-app]: https://github.com/lvcabral/brs-desktop/compare/v0.7.1-app...v0.7.2-app
[v0.7.1-app]: https://github.com/lvcabral/brs-desktop/compare/v0.7.0-app...v0.7.1-app
[v0.7.0-app]: https://github.com/lvcabral/brs-desktop/compare/v0.6.0-app...v0.7.0-app
[v0.6.0-app]: https://github.com/lvcabral/brs-desktop/compare/v0.5.2-app...v0.6.0-app
[v0.5.2-app]: https://github.com/lvcabral/brs-desktop/compare/v0.5.1-app...v0.5.2-app
[v0.5.1-app]: https://github.com/lvcabral/brs-desktop/compare/v0.5.0-app...v0.5.1-app
[v0.5.0-app]: https://github.com/lvcabral/brs-desktop/tree/v0.5.0-app

<!-- Generated by https://github.com/rhysd/changelog-from-release v3.7.1 -->
