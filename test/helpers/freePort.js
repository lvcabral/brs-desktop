/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import net from "node:net";

/**
 * Ask the OS for an unused TCP port.
 *
 * Integration specs must never share a fixed port: the `forks` pool runs spec files
 * concurrently, and the service defaults in `src/constants.js` would collide.
 * @returns {Promise<number>} - A port that was free a moment ago
 */
export function getFreePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}
