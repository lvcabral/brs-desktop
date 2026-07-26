/*---------------------------------------------------------------------------------------------
 *  BrightScript Simulation Desktop Application (https://github.com/lvcabral/brs-desktop)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Generate short Hash
String.prototype.hashCode = function () {
    let hash = 0;
    // Falls through to the shared return below rather than yielding a number here: every
    // caller uses the result to build a filename, so the type has to be consistent.
    for (let i = 0; i < this.length; i++) {
        // This is Java's String.hashCode, which is defined over UTF-16 code units. codePointAt()
        // would return a different value for astral characters while the loop still advanced one
        // unit at a time, changing the hash of paths already in use as cache filenames.
        // eslint-disable-next-line unicorn/prefer-code-point
        const chr = this.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
};
