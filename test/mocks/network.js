/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for the `network` package used by `src/helpers/util.js`.
 *
 * The real package inspects the host's routing table, which makes `getGateway()`
 * results machine-dependent and unassertable.
 */
import { vi } from "vitest";

const defaultInterface = {
    name: "en0",
    ip_address: "192.168.1.50",
    mac_address: "aa:bb:cc:dd:ee:ff",
    type: "Wired",
    netmask: "255.255.255.0",
    gateway_ip: "192.168.1.1",
};

let activeInterface = { ...defaultInterface };
let activeError = null;

export const get_active_interface = vi.fn((callback) =>
    activeError ? callback(activeError) : callback(null, activeInterface)
);

export const get_interfaces_list = vi.fn((callback) =>
    activeError ? callback(activeError) : callback(null, [activeInterface])
);

/**
 * Override what the active interface lookup reports
 * @param {object} iface - Partial interface fields to merge over the default
 */
export function __setActiveInterface(iface) {
    activeInterface = { ...defaultInterface, ...iface };
    activeError = null;
}

/**
 * Make the interface lookup fail, to exercise the error path
 * @param {Error} err - The error to hand the callback
 */
export function __setError(err) {
    activeError = err;
}

/**
 * Restore the default wired interface and clear any error
 */
export function __resetNetworkMock() {
    activeInterface = { ...defaultInterface };
    activeError = null;
}

export default { get_active_interface, get_interfaces_list };
