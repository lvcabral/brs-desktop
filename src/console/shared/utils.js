"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function toString(value) {
    return Object.prototype.toString.call(value);
}
var formatFuncMap = {
    '[object Undefined]': function () { return 'undefined'; },
    '[object Null]': function () { return 'null'; },
    '[object Number]': function (value) { return value.toString(); },
    '[object String]': function (value) { return value.toString(); },
    '[object Boolean]': function (value) { return value ? 'true' : 'false'; },
    '[object Symbol]': function (value) { return "Symbol(" + value.toString() + ")"; },
    '[object Function]': function (value) { return value.toString(); },
    '[object Array]': function (value) { return "[" + value.join(', ') + "]"; },
    '[object Object]': function (value) { return JSON.stringify(value); },
};
function format(value) {
    return formatFuncMap[toString(value)](value);
}
exports.format = format;
function getNode(id) {
    return document.querySelector("[onscreenconsole-id=\"" + id + "\"]");
}
exports.getNode = getNode;
//# sourceMappingURL=utils.js.map