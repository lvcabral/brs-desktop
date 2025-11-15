# Building from Source
The BrightScript Simulator Desktop App project is being developed using the [Electron framework](https://electronjs.org/), and it also uses `yarn` for dependency management.

## Prerequisites
To build the project you will need `NodeJS`, so you'll need to [install that first](https://nodejs.org).

## Setup
1. Clone this repo:
   ```console
   $ git clone https://github.com/lvcabral/brs-desktop.git
   ```

2. Install dependencies:
    ```console
    $ npm install     # or just `npm i`
    ```

## Debugging and Building for Release
### Running in Developer Mode

If you want to run the application without packaging it, for debugging, just execute:

```console
$ npm run start
```

### Packaging for Release

This project uses [Webpack](https://webpack.js.org/) to build the source code into packages for release, and uses [Electron Builder](https://www.electron.build/) to generate the redistributable installers for each platform. The ideal way to generate the installers is to run it on each native OS. The files are generated at the `dist` folder under the repository root.

Below the list of available build commands for each platform:

#### macOS 64 bits (.dmg)

Run from macOS `terminal`:
```console
$ npm run dist
```
#### Windows 32 & 64 bits (single installer)

Run from Windows `command` or `PowerShell` prompt:
```console
C:\git\brs-desktop> npm run dist-win
```
#### Linux 32 bits (AppImage)

Run from Linux `terminal`:
```console
$ npm run dist-linux32
```
#### Linux 64 bits (AppImage)

Run from Linux `terminal`:
```console
$ npm run dist-linux64
```
#### Linux 64 bits (Debian)

Run from Linux `terminal`:
```console
$ npm run dist-deb64
```
