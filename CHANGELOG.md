# Changelog

<a name="v2.0.0"></a>

## [v2.0.0 - SceneGraph Support](https://github.com/lvcabral/brs-desktop/releases/tag/v2.0.0) - 17 Oct 2025

This version of the BrightScript Simulator can execute code compatible with language specifications up to Roku OS 15. It also includes experimental **SceneGraph** support which is currently in **alpha stage**.

**Please be aware of the following:**

* SceneGraph components may not render correctly
* Some SceneGraph features are not yet implemented
* Apps may crash or behave unexpectedly
* Check all [current limitations](https://github.com/lvcabral/brs-engine/blob/scenegraph/docs/limitations.md) for more details

## Release Changes

* Bump to v2.0.0 and upgraded Electron to v2.9 [@lvcabral](https://github.com/lvcabral) in [#190](https://github.com/lvcabral/brs-desktop/pull/190)
* Added a message dialog to warn users that SceneGraph is in alpha stage by [@lvcabral](https://github.com/lvcabral) in [#191](https://github.com/lvcabral/brs-desktop/pull/191)
* Add closed caption style settings and startup SceneGraph warning dialog by [@lvcabral](https://github.com/lvcabral) in [#194](https://github.com/lvcabral/brs-desktop/pull/194)
* Return new ECP device info fields introduced in Roku OS 15 by [@lvcabral](https://github.com/lvcabral) in [#193](https://github.com/lvcabral/brs-desktop/pull/193)
* Added BRS bouncing splash video by [@lvcabral](https://github.com/lvcabral) in [#186](https://github.com/lvcabral/brs-desktop/pull/186)
* Moved `keepDisplayOnExit` and `perfStats` options from `simulator` to `display` tab on Settings screen by [@lvcabral](https://github.com/lvcabral)
* Bump `brs-engine` to v2.0.0-alpha.16 [@lvcabral](https://github.com/lvcabral) - main changes since last release:
  * v1.8.6 - Changed the internal device assets (fonts, sounds, images and libraries) to be stored in the `common.zip` file that holds the `common:/` volume in the file system, and mainly this release brings a fix for the `m` context when using indexed get to retrieve functions. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.6))
  * v1.8.7 - Brings the undocumented signature for `InStr()` function with only 2 parameters, the  `roTimespan.totalMicroseconds()` method and the `Type()` function returning "legacy" types (unless you pass version 3 parameter). Other important fixes to highlight are the support for boxed values as array indexes and having `roBoolean` to be properly comparable. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.7))
  * v1.8.8 - Added the support for the `flags` parameter on the `ParseJSON()` to make the AA returned to be case insensitive, and `FormatJSON` flag now allows you to disable the escape of non-ASCII characters. There are also, fixes for `Left()` and `Mid()` that were not handling negative values properly and `Substitute()` that now supports the `^0` notation. The `chr()` and `asc()` functions were also updated to support extended Unicode. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.8))
  * v1.8.9 - Introduces a few missing methods in `roDeviceInfo` and a new method to `ifStringOps`, also several enhancements on Video and Audio handling. The default font was replaced by `DejaVuSansCondensed` that is used in Roku devices for `Draw2D` text rendering. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.9))
  * v1.9.1 - Reorganized the repository as a monorepo splitting the released artifacts into two separate NPM packages: `brs-engine` (for Web applications) and `brs-node` (for Node.js and CLI). Also, with this release, the BrightScript language and components are now synchronized with Roku OS 15.0. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.1))
  * v1.9.2 - Implemented new method `createPayloadFromFileMap` in `brs-node` library and updated documentation. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.2))
  * v1.9.3 - Fixed issues related to `roNDK.start()` allowing URL as `ChannelId` on `SDKLaunch` and `RokuBrowser.brs` library now parses arrays in options object. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.3))
  * v1.9.4 - Remapping of the game pad buttons to the Roku remote control, allowing for a better experience using the game pad with Roku apps. It also documents the custom `manifest` option `multi_key_events` that allows apps to receive multiple key events at the same time. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.4))
  * v1.9.5 - Added new methods in the engine API, improvements to `roAppManager`, and the `manifest` parsing now matches the behavior of Roku devices. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.5))
  * v1.9.6 - This release brings a couple of fixes for the CORS proxy usage and the `NDKStart` handling of `SDKLauncher`. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.6))
  * v1.9.7 - This release fixes issues on the API methods `enableStats` and improves the handling of the `dev` app. (see [full changelog](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.7))
  * v2.0.0-alpha.16 - Contains the current state for the experimental SceneGraph framework support, for more details about what is implemented and what is still missing check the [current limitations document](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/limitations.md)
* Bump `brs-engine` to v1.8.9 and upgraded other dependencies by [@lvcabral](https://github.com/lvcabral) in [#187](https://github.com/lvcabral/brs-desktop/pull/187)
* Bump electron from 25.9.8 to 28.3.2 [@dependabot[bot]](https://github.com/dependabot[bot]) in [#185](https://github.com/lvcabral/brs-desktop/pull/185)
* Bump pbkdf2 from 3.1.2 to 3.1.3 [@dependabot[bot]](https://github.com/dependabot[bot]) in [#184](https://github.com/lvcabral/brs-desktop/pull/184)
* Bump @babel/runtime-corejs2 from 7.26.0 to 7.26.10 [@dependabot[bot]](https://github.com/dependabot[bot]) in [#183](https://github.com/lvcabral/brs-desktop/pull/183)
* Bump tmp from 0.2.3 to 0.2.4 [@dependabot[bot]](https://github.com/dependabot[bot]) in [#188](https://github.com/lvcabral/brs-desktop/pull/188)

[Full Changelog][v2.0.0]

<a name="v1.4.0"></a>

## [v1.4.0 - Editor Improvements](https://github.com/lvcabral/brs-desktop/releases/tag/v1.4.0) - 03 Feb 2025

### Release Changes

* Replaced the Delete button by new code snippet tools button by [@lvcabral](https://github.com/lvcabral) in [#167](https://github.com/lvcabral/brs-desktop/pull/167)
* Added support for ECP `launch`, `input` and `exit-app` endpoints by [@lvcabral](https://github.com/lvcabral) in [#170](https://github.com/lvcabral/brs-desktop/pull/170)
* Added Peer Roku device menu options by [@lvcabral](https://github.com/lvcabral) in [#172](https://github.com/lvcabral/brs-desktop/pull/172)
* Remove locales not supported on Roku by [@lvcabral](https://github.com/lvcabral) in [#173](https://github.com/lvcabral/brs-desktop/pull/173)
* Editor: Save single snippet and alert to changes by [@lvcabral](https://github.com/lvcabral) in [#174](https://github.com/lvcabral/brs-desktop/pull/174)
* Added editor context menu and improved change control by [@lvcabral](https://github.com/lvcabral) in [#176](https://github.com/lvcabral/brs-desktop/pull/176)
* Removed ECP service circular dependencies by [@lvcabral](https://github.com/lvcabral) in [#177](https://github.com/lvcabral/brs-desktop/pull/177)
* Removed Installer service circular dependencies by [@lvcabral](https://github.com/lvcabral) in [#178](https://github.com/lvcabral/brs-desktop/pull/178)
* Removed Telnet service circular dependencies by [@lvcabral](https://github.com/lvcabral) in [#179](https://github.com/lvcabral/brs-desktop/pull/179)
* Close app on peer Roku device when closed on simulator by [@lvcabral](https://github.com/lvcabral) in [#180](https://github.com/lvcabral/brs-desktop/pull/180)
* Improved `roDeviceInfo.getConnectionInfo()` by getting actual network information by [@lvcabral](https://github.com/lvcabral) in [#181](https://github.com/lvcabral/brs-desktop/pull/181)
* Upgraded `brs-engine` to [v1.8.5](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.5) - main changes since last release:
  * Implemented BrightScript features up to Roku OS 14.0 by [@lvcabral](https://github.com/lvcabral) in [#420](https://github.com/lvcabral/brs-engine/pull/420)
  * Several Registry improvements by [@lvcabral](https://github.com/lvcabral) in [#407](https://github.com/lvcabral/brs-engine/pull/407)
  * Several App handling/management improvements by [@lvcabral](https://github.com/lvcabral) in [#413](https://github.com/lvcabral/brs-engine/pull/413)
  * Added `Platform` info to the result of `roDeviceInfo.getModelDetails()` by [@lvcabral](https://github.com/lvcabral) in [#414](https://github.com/lvcabral/brs-engine/pull/414)
  * Allowed `m` object to be re-assigned in Function scope by [@lvcabral](https://github.com/lvcabral) in [#417](https://github.com/lvcabral/brs-engine/pull/417)
  * Implemented `global` static object by [@lvcabral](https://github.com/lvcabral) in [#418](https://github.com/lvcabral/brs-engine/pull/418)
  * Add new supported control buttons and ECP command by [@lvcabral](https://github.com/lvcabral) in [#421](https://github.com/lvcabral/brs-engine/pull/421)
  * Fixed `CreateObject` behavior to match Roku by [@lvcabral](https://github.com/lvcabral) in [#423](https://github.com/lvcabral/brs-engine/pull/423)
  * Implemented `roSystemLog` and refactored `roMessagePort` by [@lvcabral](https://github.com/lvcabral) in [#426](https://github.com/lvcabral/brs-engine/pull/426)
  * Implemented `roDeviceInfoEvent` by [@lvcabral](https://github.com/lvcabral) in [#429](https://github.com/lvcabral/brs-engine/pull/429)
  * Implement `roCECStatus` component by [@lvcabral](https://github.com/lvcabral) in [#430](https://github.com/lvcabral/brs-engine/pull/430)
  * Add fake server support to `roChannelStore` by [@lvcabral](https://github.com/lvcabral) in [#431](https://github.com/lvcabral/brs-engine/pull/431)
  * Fixed `Int32` constructor handling of overflow to match Roku by [@lvcabral](https://github.com/lvcabral) in [#435](https://github.com/lvcabral/brs-engine/pull/435)
  * Added new `roDateTime` methods: `asSecondsLong` and `fromSecondsLong` by [@lvcabral](https://github.com/lvcabral) in [#437](https://github.com/lvcabral/brs-engine/pull/437)
  * Fixed `Int32` and `Int64` hex parsing and formatting by [@lvcabral](https://github.com/lvcabral) in [#438](https://github.com/lvcabral/brs-engine/pull/438)
  * Improved `sprintf` formatting by [@lvcabral](https://github.com/lvcabral) in [#443](https://github.com/lvcabral/brs-engine/pull/443)
  * Improved `IfToStr` type checking by [@lvcabral](https://github.com/lvcabral) in [#449](https://github.com/lvcabral/brs-engine/pull/449)
  * Fixed `roVideoPlayer` method `getAudioTracks` by [@lvcabral](https://github.com/lvcabral) in [#457](https://github.com/lvcabral/brs-engine/pull/457)
  * Added `serialNumber` to device info object and to response of `GetModelDetails()`
  * Fixed behavior of `End` statement to terminate the app
  * Improved and documented MicroDebugger functions
  * Improvements on WAV handling
  * Improved component `roURLTransfer` by [@lvcabral](https://github.com/lvcabral) in [#461](https://github.com/lvcabral/brs-engine/pull/461)
  * Implemented `roHdmiStatus` and `roHdmiStatusEvent` components by [@lvcabral](https://github.com/lvcabral) in [#463](https://github.com/lvcabral/brs-engine/pull/463)
  * Implemented `roTextureRequest` and `roTextureManager` by [@lvcabral](https://github.com/lvcabral) in [#465](https://github.com/lvcabral/brs-engine/pull/465)
  * Implemented `roSocketAddress` by [@lvcabral](https://github.com/lvcabral) in [#460](https://github.com/lvcabral/brs-engine/pull/460)
  * Implemented **mocked** `roStreamSocket` component by [@lvcabral](https://github.com/lvcabral) in [#462](https://github.com/lvcabral/brs-engine/pull/462)
  * Implemented **mocked** `roDataGramSocket` and extracted common interfaces into `ifSocket` by [@lvcabral](https://github.com/lvcabral) in [#466](https://github.com/lvcabral/brs-engine/pull/466)
* Fixed: Some menu options were disabled when Settings is opened with app running by [@lvcabral](https://github.com/lvcabral) in [#171](https://github.com/lvcabral/brs-desktop/pull/171)
* Bump nanoid from 3.3.7 to 5.0.9 by **@dependabot** in [#]175](https://github.com/lvcabral/brs-desktop/pull/175)

[Full Changelog][v1.4.0]

<a name="v1.3.2"></a>

## [v1.3.2 - Checkbox to enable/disable Peer Roku](https://github.com/lvcabral/brs-desktop/releases/tag/v1.3.2) - 12 Nov 2024

### Release Changes

* Added checkbox to enable/disable peer Roku device by [@lvcabral](https://github.com/lvcabral) in [#164](https://github.com/lvcabral/brs-desktop/pull/164)
* Bump elliptic from 6.5.7 to 6.6.0 by @dependabot in [#165](https://github.com/lvcabral/brs-desktop/pull/165)
* Fixed build on MacOS by [@lvcabral](https://github.com/lvcabral) in [#166](https://github.com/lvcabral/brs-desktop/pull/166)
* Changed build to generate MacOS Universal installer (for both Intel and Arm machines)

[Full Changelog][v1.3.2]

<a name="v1.3.0"></a>

## [v1.3.0 - Run App from URL](https://github.com/lvcabral/brs-desktop/releases/tag/v1.3.0) - 13 Oct 2024

### Release Changes

* Implemented option to Open from URL by [@lvcabral](https://github.com/lvcabral) in [#163](https://github.com/lvcabral/brs-desktop/pull/163)
  * New option in File menu that allows to download and run any app package (zip/bpk) or code file (brs)
  * The downloaded file is also executed on the peer Roku device (if configured in the settings screen)
  * Updated documentation with the new recent features
* Upgraded `brs-engine` to [v1.7.0](https://github.com/lvcabral/brs-engine/releases) - main changes since last release:
  * Added a way to add custom features to be checked by `roDeviceInfo.hasFeatures()`
  * Created new document [docs/customization.md](https://github.com/lvcabral/brs-engine/blob/master/docs/customization.md)
  * Implemented `try...catch` and `throw` by [@lvcabral](https://github.com/lvcabral) in [#318](https://github.com/lvcabral/brs-engine/pull/318)
  * Implemented `goto` statement by [@lvcabral](https://github.com/lvcabral) in [#367](https://github.com/lvcabral/brs-engine/pull/367)
  * Implemented `Continue For` and `Continue While` statements by [@lvcabral](https://github.com/lvcabral) in [#332](https://github.com/lvcabral/brs-engine/pull/332)
  * Added: `roEVPDigest` component by [@lvcabral](https://github.com/lvcabral) in [#301](https://github.com/lvcabral/brs-engine/pull/301)
  * Added: `roEVPCipher` component by [@lvcabral](https://github.com/lvcabral) in [#303](https://github.com/lvcabral/brs-engine/pull/303)
  * Added: `roHMAC` component by [@lvcabral](https://github.com/lvcabral) in [#305](https://github.com/lvcabral/brs-engine/pull/305)
  * Added: `roDeviceCrypto` component by [@lvcabral](https://github.com/lvcabral) in [#309](https://github.com/lvcabral/brs-engine/pull/309)
  * Added: `roFunction` component and `Box()` runtime function by [@lvcabral](https://github.com/lvcabral) in [#310](https://github.com/lvcabral/brs-engine/pull/310)
  * Implemented `pos()` and `tab()` for `print` statement by [@lvcabral](https://github.com/lvcabral) in [#339](https://github.com/lvcabral/brs-engine/pull/339)
  * Implemented `slice()` method in `roArray` under `ifArraySlice`
  * Implemented `ifArraySizeInfo` in `roArray` by [@lvcabral](https://github.com/lvcabral) in [#316](https://github.com/lvcabral/brs-engine/pull/316)
  * Implemented `roImageMetadata` component by [@lvcabral](https://github.com/lvcabral) in [#325](https://github.com/lvcabral/brs-engine/pull/325)
  * Implemented `roAudioMetadata` component by [@lvcabral](https://github.com/lvcabral) in [#326](https://github.com/lvcabral/brs-engine/pull/326)
  * Implemented support for multi-dimensional indexes of `roArray` and `roList` by [@lvcabral](https://github.com/lvcabral) in [#331](https://github.com/lvcabral/brs-engine/pull/331)
  * Implemented `ObjFun()` global function and support for `variadic` arguments on `Callable` by [@lvcabral](https://github.com/lvcabral) in [#375](https://github.com/lvcabral/brs-engine/pull/375)
  * Added support for `formatJson()` undocumented flags 256 and 512 by [@lvcabral](https://github.com/lvcabral) in [#377](https://github.com/lvcabral/brs-engine/pull/377)
  * Implemented Micro Debugger commands:  `classes`,  `bscs` and `stats` by [@lvcabral](https://github.com/lvcabral) in [#385](https://github.com/lvcabral/brs-engine/pull/385)
  * Improvements to `roPath` by [@lvcabral](https://github.com/lvcabral) in [#296](https://github.com/lvcabral/brs-engine/pull/296)
  * Changed `roUrlEvent` and `roUniversalControlEvent` to be comparable by [@lvcabral](https://github.com/lvcabral) in [#299](https://github.com/lvcabral/brs-engine/pull/299)
  * Updated Firmware Version to 11.5 as `continue for/while` is now supported by [@lvcabral](https://github.com/lvcabral) in [#357](https://github.com/lvcabral/brs-engine/pull/357)
  * Fixed: `ifString.tokenize()` behavior to match Roku by [@lvcabral](https://github.com/lvcabral) in [#295](https://github.com/lvcabral/brs-engine/pull/295)
  * Fixed: `String` comparison and concatenation by [@lvcabral](https://github.com/lvcabral) in [#298](https://github.com/lvcabral/brs-engine/pull/298)
  * Allow to use AND/OR between Boolean and Numbers by [@lvcabral](https://github.com/lvcabral) in [#307](https://github.com/lvcabral/brs-engine/pull/307)
  * Fixed Boxing on Numbers and Booleans by [@lvcabral](https://github.com/lvcabral) in [#313](https://github.com/lvcabral/brs-engine/pull/313)
  * Fixed Boxing for Callable parameters and implemented Coercion properly by [@lvcabral](https://github.com/lvcabral) in [#327](https://github.com/lvcabral/brs-engine/pull/327)
  * Fixed Callable signature check by [@lvcabral](https://github.com/lvcabral) in [#340](https://github.com/lvcabral/brs-engine/pull/340)
  * Fixed conversion functions to Integer: `Int()`, `CInt()` and `Fix()` by [@lvcabral](https://github.com/lvcabral) in [#342](https://github.com/lvcabral/brs-engine/pull/342)
  * Fixed Video seek causing a stack overflow crash by [@lvcabral](https://github.com/lvcabral) in [#349](https://github.com/lvcabral/brs-engine/pull/349)

[Full Changelog][v1.3.0]

<a name="v1.2.0"></a>

## [v1.2.0 - Editor and Console Window](https://github.com/lvcabral/brs-desktop/releases/tag/v1.2.0) - 02 Mar 2024

### Release Changes

* Implemented Code Editor and Console window by [@lvcabral](https://github.com/lvcabral) in [#154](https://github.com/lvcabral/brs-desktop/pull/154)
  * Added editor and console code based on [brs-fiddle](https://github.com/lvcabral/brs-fiddle)
  * Removed app folder from git (all files are generated from `src` now)
  * Linked code editor to main simulator display
  * Removed display and hooked to the app.js
  * Added Theme Support, Startup Setting and Command Line switch
  * Clear Console also reset Status counters
  * Editor improvements and fixes
  * Change buttons to be displayed depending on the context
  * Fixed Telnet behavior to handle IOC commands
  * Added Telnet support for char by char when the client can't switch to line mode
  * Several SonarCloud static analysis issues fixed
* Upgraded `brs-engine` to [v1.3.1](https://github.com/lvcabral/brs-engine/releases/tag/v1.3.1) - some changes were:
  * Added support to `volumemute` key
  * Implemented support for `PowerOff` ECP key press
  * Added `ifDraw2d` method `drawTransformedObject()` 
  * Added to the MicroDebugger support for `Function`, `If`,  `For` and `While`
  * Added `quit` command to the MicroDebugger
  * Fixed MicroDebugger truncate String variable to max 94 characters
  * Fixed MicroDebugger not exiting properly with `exit` command
  * Fixed MicroDebugger formatting issues and the handling of linefeed

[Full Changelog][v1.2.0]

<a name="v1.1.0"></a>

## [v1.1.0 - Peer Roku Device](https://github.com/lvcabral/brs-desktop/releases/tag/v1.1.0) - 14 Feb 2024

### Release Changes

* Added feature to allow parallel deployment of apps on a peer Roku device by [@lvcabral](https://github.com/lvcabral) in [#151](https://github.com/lvcabral/brs-desktop/pull/151)
* Upgraded `brs-engine` to [v1.2.11](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.11)
  * Added detection of Video Codecs
  * Added support to HLS streams with multiple audio tracks
  * Added support to video inside the app package (.zip/.bpk)
  * Added new API event `control` to return key strokes pressed on the simulator
  * Changed the priority of the app entry point to `runUserInterface()` over `main()`
  * Fixed low resolution on Screen Resize
  * Fixed Video not always pausing on `break` or `pause` commands
  * Fixed several issues related to remote control simulation
  * Fixed several issues related to ifDraw2D rendering
* Fixed #148 - Get correct window reference when opening About Box by [@lvcabral](https://github.com/lvcabral) in [#149](https://github.com/lvcabral/brs-desktop/pull/149)
* Fixed #146 - Force focus on simulator window when `app` is deployed via ECP by [@lvcabral](https://github.com/lvcabral) in [#150](https://github.com/lvcabral/brs-desktop/pull/150)
* Fixed #147 - In SD Display mode, when goes to full screen, the area behind the display is not black
* Fixed #145 -  Full screen mode on startup is showing the menu in Windows and Linux by [@lvcabral](https://github.com/lvcabral) in [#152](https://github.com/lvcabral/brs-desktop/pull/152)

[Full Changelog][v1.1.0]

<a name="v1.0.0"></a>

## [v1.0.0 - BrightScript Simulator](https://github.com/lvcabral/brs-desktop/releases/tag/v1.0.0) - 20 Jan 2024

After 4 years of Alpha and Beta stages, the project is stable and performant enough to finally be released as version 1.0 and with that, we decided to give it a new name:

### BrightScript Simulator

The term _simulator_ was chosen instead of the former _emulator_ to better represent the nature and purpose of the project, as there is no intention to fully emulate a Roku device (OS and Hardware), but rather simulate the behavior, as a development tool that allow us to run BrightScript apps in different platforms.

### Release Changes

* Renamed to "BrightScript Simulator" and updated the icon
* Upgraded `brs-engine` to [v1.2.3](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.3)
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

## [v0.10.31 - Fixed Menu and Theme issues](https://github.com/lvcabral/brs-desktop/releases/tag/v0.10.31) - 22 Aug 2023

### Release Changes

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

## [v0.10.30 - Better Performance, Debugger and Settings screen](https://github.com/lvcabral/brs-desktop/releases/tag/v0.10.30) - 29 May 2023

### Release Changes

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

## [v0.9.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.9.0-app) - 28 Jun 2021

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.9.0-app]

<a name="v0.8.1-app"></a>

## [v0.8.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.8.1-app) - 07 Jun 2021

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.8.1-app]

<a name="v0.8.0-app"></a>

## [v0.8.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.8.0-app) - 11 Mar 2020

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.8.0-app]

<a name="v0.7.2-app"></a>

## [v0.7.2-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.2-app) - 02 Dec 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.2-app]

<a name="v0.7.1-app"></a>

## [v0.7.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.1-app) - 21 Nov 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.1-app]

<a name="v0.7.0-app"></a>

## [v0.7.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.7.0-app) - 17 Nov 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.7.0-app]

<a name="v0.6.0-app"></a>

## [v0.6.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.6.0-app) - 24 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.6.0-app]

<a name="v0.5.2-app"></a>

## [v0.5.2-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.2-app) - 09 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.2-app]

<a name="v0.5.1-app"></a>

## [v0.5.1-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.1-app) - 07 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.1-app]

<a name="v0.5.0-app"></a>

## [v0.5.0-app](https://github.com/lvcabral/brs-desktop/releases/tag/v0.5.0-app) - 07 Oct 2019

Binaries are published at the engine library repository: <https://github.com/lvcabral/brs-engine/releases>

[Changes][v0.5.0-app]

[v2.0.0]: https://github.com/lvcabral/brs-desktop/compare/v1.4.0...v2.0.0
[v1.4.0]: https://github.com/lvcabral/brs-desktop/compare/v1.3.2...v1.4.0
[v1.3.2]: https://github.com/lvcabral/brs-desktop/compare/v1.3.0...v1.3.2
[v1.3.0]: https://github.com/lvcabral/brs-desktop/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/lvcabral/brs-desktop/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/lvcabral/brs-desktop/compare/v1.0.0...v1.1.0
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
