# Integrate the BrightScript Simulator with VS Code

The **BrightScript VS Code Extension** can deploy apps directly to the **BrightScript Simulator** and attach the debugger for a fast authoring loop. This guide shows how to connect the tools and prepare a reusable debug configuration.

## Prerequisites

- **BrightScript Simulator** installed and running; it can be on another machine reachable over the network.
- [BrightScript VS Code Extension](https://marketplace.visualstudio.com/items?itemName=rokucommunity.brightscript) installed in VS Code.
- A Roku/BrightScript project opened in VS Code with a `manifest` file at its root.

## Prepare the Simulator

1. Launch the **BrightScript Simulator** desktop application.
2. Open the [Settings Screen](docs/how-to-use.md#settings-screen).
3. In the **Services** section, confirm the services are enabled (all checkboxes marked) for App Installer (Web), ECP, and Remote Console (Telnet).
4. If you change the **Application Installer** port or the password, make sure you restart the service (unmark and remark the checkbox) and take note the new values—you will use them in the `launch.json` configuration (section below).
5. Keep the simulator running; the VS Code debugger connects to it over the configured ports.

> [!IMPORTANT]
>
> On Linux systems, due to OS restrictions, the Installer service can not be started on port 80, so the service is disabled by default.
> To enable it, you must specify a different port.


## Create the VS Code Debug Configuration

1. In VS Code, open the **Run and Debug** view and choose **create a launch.json file**.
2. Pick **BrightScript** as the environment. VS Code creates (or updates) `.vscode/launch.json` in your workspace.
3. Replace the generated configuration (or add a new entry) with the example below, adjusting folders or ports to match your project. The highlighted settings are required for the simulator integration.

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "BrightScript Debug: Launch",
            "type": "brightscript",
            "request": "launch",
            "host": "${promptForHost}",
            "packagePort": 80,
            "password": "${promptForPassword}",
            "rootDir": "${workspaceFolder}",
            "files": [
                "manifest",
                "source/**/*.*",
                "components/**/*.*",
                "images/**/*.*"
            ],
            "enableDebugProtocol": false,
            "rendezvousTracking": false
        }
    ]
}
```

- `host` should point to the simulator's IP address; use `localhost` when the simulator runs on the same machine.
- `packagePort` optional, must match the Application Installer service port configured in the simulator (default `80`).
- `password` should match the developer password set in the simulator (default `rokudev`).
- `rootDir` should point to your project's root folder containing the `manifest` file.
- `files` should include all source files and assets needed for your app.
- `enableDebugProtocol` and `rendezvousTracking` must be set to `false` for compatibility with the simulator.

## Run and Debug

1. Build and package your project using VSCode BrightScript Extension by pressing `F5` or the play button on the **Run and Debug** view.
2. VSCode installs the latest build to the simulator, launches the channel, and attaches the debugger. Set breakpoints and inspect variables as usual.

## Troubleshooting

- **Connection refused**: Verify the simulator is running and that the installer port in `launch.json` match the simulator settings.
- **Upload failures**: Confirm the **Application Installer** service is enabled and the password matches the simulator configuration (default `rokudev`).
- **Debugger stops immediately**: Ensure you disabled `enableDebugProtocol` and `rendezvousTracking`; the simulator does not support those options being `true`.
