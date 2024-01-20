# Building from Source
The BrightScript Simulator Desktop App project is being developed using the [Electron framework](https://electronjs.org/), and it also uses `yarn` for dependency management.

## Prerequisites
To build the project you will need `NodeJS`, so you'll need to [install that first](https://nodejs.org).

Once that's ready, install [yarn](https://yarnpkg.com).  Installing it with `npm` is probably the simplest:

```shell
$ npm install -g yarn
```
## Setup
1. Clone this repo:
   ```
   $ git clone https://github.com/lvcabral/brs-desktop.git
   ```

2. Install dependencies:
    ```shell
    $ yarn install     # or just `yarn`
    ```

## Debugging and Building for Release
### Running in Developer Mode

If you want to run the application without packaging it, for debugging, just execute:

```shell
$ yarn start
```

### Packaging for Release

This project uses [Webpack](https://webpack.js.org/) to build the source code into packages for release, and uses [Electron Builder](https://www.electron.build/) to generate the redistributable installers for each platform. The ideal way to generate the installers is to run it on each native OS. The files are generated at the `dist` folder under the repository root.

Below the list of available build commands for each platform:

#### macOS 64 bits (.dmg)

Run from macOS `terminal`:
```shell
$ yarn dist
```
#### Windows 32 & 64 bits (single installer)

Run from Windows `command` or `PowerShell` prompt:
```shell
C:\git\brs-desktop> yarn dist-win
```
#### Linux 32 bits (AppImage)

Run from Linux `terminal`:
```shell
$ yarn dist-linux32
```
#### Linux 64 bits (AppImage)

Run from Linux `terminal`:
```shell
$ yarn dist-linux64
```
#### Linux 64 bits (Debian)

Run from Linux `terminal`:
```shell
$ yarn dist-deb64
```
