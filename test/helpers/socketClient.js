/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import net from "node:net";

/**
 * A promise-friendly TCP client for the telnet and debug server suites.
 *
 * Both servers are line- and byte-oriented, so tests need to await specific output and to
 * inspect raw bytes (the telnet IAC negotiation is asserted as hex).
 */
export class SocketClient {
    socket = null;
    chunks = [];
    closed = false;

    /**
     * Open the connection and resolve once it is established
     * @param {number} port - The port to connect to
     * @param {string} [host] - The host to connect to
     * @returns {Promise<SocketClient>} - This client
     */
    connect(port, host = "127.0.0.1") {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection({ port, host }, () => resolve(this));
            this.socket.on("data", (chunk) => this.chunks.push(chunk));
            this.socket.on("close", () => {
                this.closed = true;
            });
            this.socket.once("error", reject);
        });
    }

    /**
     * Everything received so far, as text
     * @returns {string} - The accumulated output
     */
    text() {
        return Buffer.concat(this.chunks).toString("utf8");
    }

    /**
     * Everything received so far, as a hex string
     * @returns {string} - The accumulated output in hex
     */
    hex() {
        return Buffer.concat(this.chunks).toString("hex");
    }

    /**
     * Discard everything received so far
     */
    clear() {
        this.chunks = [];
    }

    /**
     * Write raw data to the server
     * @param {string|Buffer} data - The data to send
     */
    write(data) {
        this.socket.write(data);
    }

    /**
     * Wait until the accumulated output satisfies a predicate
     * @param {Function} predicate - Called with the accumulated text
     * @param {number} [timeout] - How long to wait, in milliseconds
     * @returns {Promise<string>} - The accumulated output
     */
    waitFor(predicate, timeout = 3000) {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeout;
            const poll = () => {
                if (predicate(this.text(), this.hex())) {
                    resolve(this.text());
                } else if (Date.now() > deadline) {
                    reject(new Error(`Timed out waiting for output; saw: ${JSON.stringify(this.text())}`));
                } else {
                    setTimeout(poll, 10);
                }
            };
            poll();
        });
    }

    /**
     * Wait until the accumulated output contains a substring
     * @param {string} needle - The text to wait for
     * @param {number} [timeout] - How long to wait, in milliseconds
     * @returns {Promise<string>} - The accumulated output
     */
    waitForText(needle, timeout = 3000) {
        return this.waitFor((text) => text.includes(needle), timeout);
    }

    /**
     * Wait until the connection is closed by the server
     * @param {number} [timeout] - How long to wait, in milliseconds
     * @returns {Promise<void>} - Resolves once closed
     */
    waitForClose(timeout = 3000) {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeout;
            const poll = () => {
                if (this.closed) {
                    resolve();
                } else if (Date.now() > deadline) {
                    reject(new Error("Timed out waiting for the socket to close"));
                } else {
                    setTimeout(poll, 10);
                }
            };
            poll();
        });
    }

    /**
     * Close the connection
     */
    end() {
        this.socket?.destroy();
    }
}

/**
 * Open a connection to a server on localhost
 * @param {number} port - The port to connect to
 * @returns {Promise<SocketClient>} - The connected client
 */
export function connectSocket(port) {
    return new SocketClient().connect(port);
}
