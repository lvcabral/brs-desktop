/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Stand-in for `@lvcabral/node-ssdp`.
 *
 * This is what keeps UDP multicast (port 1900) out of the test run entirely — it is both
 * a permission hazard on CI runners and a source of flakiness, and mocking it means
 * `enableECP()` needs no "skip SSDP" flag of its own.
 */
import { EventEmitter } from "node:events";
import { vi } from "vitest";

export class Server extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this._usns = {};
        this.started = false;
        this.addUSN = vi.fn((usn) => {
            this._usns[usn] = usn;
        });
        this.start = vi.fn(() => {
            this.started = true;
            return Promise.resolve();
        });
        this.stop = vi.fn(() => {
            this.started = false;
        });
    }
}

export class Client extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.search = vi.fn();
        this.start = vi.fn(() => Promise.resolve());
        this.stop = vi.fn();
    }
}

export default { Server, Client };
