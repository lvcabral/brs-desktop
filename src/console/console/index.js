"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../shared/constants");
var utils_1 = require("../shared/utils");
var OnScreenConsole = (function () {
    function OnScreenConsole() {
        this._isShown = false;
        this._createNodes();
        this._overwriteNativeMethods();
        this._setErrorListener();
    }
    OnScreenConsole.prototype._setErrorListener = function () {
        var prevOnerror = window.onerror;
        window.onerror = function (info, path, line, col, err) {
            if (prevOnerror) {
                prevOnerror(info, path, line, col, err);
            }
            var consoleNode = utils_1.getNode('panel');
            if (consoleNode) {
                if (err && err.stack && !~err.stack.indexOf('HTMLInputElement._inputNode.onkeydown')) {
                    console.error(err.stack);
                }
                else {
                    console.error(info);
                }
                return true;
            }
            else {
                return false;
            }
        };
    };
    OnScreenConsole.prototype._overwriteNativeMethods = function () {
        for (var _i = 0, SUPPORTED_METHODS_1 = constants_1.SUPPORTED_METHODS; _i < SUPPORTED_METHODS_1.length; _i++) {
            var method = SUPPORTED_METHODS_1[_i];
            ;
            this["_" + method] = console[method].bind(console);
            console[method] = this._print(method).bind(this);
        }
    };
    OnScreenConsole.prototype._createNodes = function () {
        var _this = this;
        this._consoleNode = document.createElement('div');
        this._consoleNode.className = "console-panel";
        this._consoleNode.setAttribute('onscreenconsole-id', 'panel');
        this._consoleNode.style.cssText = "\n\t\t\tcursor: default;\n\t\t\tposition: fixed;\n\t\t\tz-index: 995;\n\t\t\theight: 240px;\n\t\t\twidth: 100%;\n\t\t\tbottom: -250px;\n\t\t\tleft: 0;\n\t\t\toverflow-x: auto; \n\t\t\toverflow-y: auto;\n\t\t\tbackground-color: #fff;\n\t\t\t-webkit-box-shadow: 0 -5px 10px #00000033;\n\t\t\t\t\t\t\tbox-shadow: 0 -5px 10px #00000033;\n\t\t\t-webkit-box-sizing: border-box;\n\t\t\t\t\t\t\tbox-sizing: border-box;\n\t\t\ttransition: all .2s;\n\t\t";
        this._showBtn = document.createElement('button');
        this._showBtn.className = 'console-button';
        this._showBtn.setAttribute('onscreenconsole-id', 'show');
        this._showBtn.style.cssText = "\n\t\t\tposition: fixed;\n\t\t\tz-index: 990;\n\t\t\theight: 32px;\n\t\t\twidth: 48px;\n\t\t\tbottom: 6px;\n\t\t\tright: 6px;\n\t\t\tcolor: #0089A7;\n\t\t\tborder: 1px solid #0089A7;\n\t\t\tbackground-color: #fff;\n\t\t\tcursor: pointer;\n\t\t\t-webkit-box-shadow: 0 2px 5px #00000033;\n\t\t\t\t\t\t\tbox-shadow: 0 2px 5px #00000033;\n\t\t\ttransition: all .2s;\n\t\t";
        this._showBtn.innerHTML = 'Show';
        this._showBtn.onclick = this.show.bind(this);
        this._hideBtn = document.createElement('button');
        this._hideBtn.className = 'console-button';
        this._hideBtn.setAttribute('onscreenconsole-id', 'hide');
        this._hideBtn.style.cssText = "\n\t\t\tposition: fixed;\n\t\t\tz-index: 999;\n\t\t\theight: 32px;\n\t\t\twidth: 48px;\n\t\t\tbottom: 6px;\n\t\t\tright: 6px;\n\t\t\tcolor: #0089A7;\n\t\t\tborder: 1px solid #0089A7;\n\t\t\tbackground-color: #fff;\n\t\t\tcursor: pointer;\n\t\t\t-webkit-box-shadow: 0 2px 5px #00000033;\n\t\t\t\t\t\t\tbox-shadow: 0 2px 5px #00000033;\n\t\t\ttransition: all .2s;\n\t\t";
        this._hideBtn.innerHTML = 'Hide';
        this._hideBtn.onclick = this.hide.bind(this);
        this._inputNode = document.createElement('input');
        this._inputNode.className = 'console-input';
        this._inputNode.setAttribute('onscreenconsole-id', 'input');
        this._inputNode.placeholder = '>';
        this._inputNode.style.cssText = "\n\t\t\toverflow: scroll;\n\t\t\tpadding: 6px 12px;\n\t\t\tfont-size: 10px;\n\t\t\tborder: none;\n\t\t\toutline: none;\n\t\t\tresize: none;\n\t\t\tborder-top: 1px solid #00000033;\n\t\t\twidth: 100%;\n\t\t\t-webkit-box-sizing: border-box;\n\t\t\t\t\t\t\tbox-sizing: border-box;\n\t\t";
        this._consoleNode.onclick = this._inputNode.focus.bind(this._inputNode);
        var history = JSON.parse(localStorage.getItem('onscreen-console-history'));
        var hisIndex = -1;
        if (!Array.isArray(history)) {
            history = [];
        }
        else {
            hisIndex = history.length;
        }
        this._inputNode.onkeydown = function (e) {
            var value = e.target.value;
            if (e.keyCode === 13 && value !== '') {
                console.log("<span style=\"color: #00000055\">></span> " + value);
                var tmpScript = document.createElement('script');
                tmpScript.innerHTML = value;
                document.body.appendChild(tmpScript);
                tmpScript.remove();
                history.push(value);
                while (history.length > constants_1.MAX_HISTORY_LENGTH) {
                    history.shift();
                }
                localStorage.setItem('onscreen-console-history', JSON.stringify(history));
                _this._inputNode.value = '';
                hisIndex = history.length;
            }
            else if (e.keyCode === 38) {
                if (hisIndex > 0) {
                    hisIndex--;
                    _this._inputNode.value = history[hisIndex];
                }
                else if (hisIndex === 0) {
                    _this._inputNode.value = history[hisIndex];
                }
            }
            else if (e.keyCode === 40) {
                if (hisIndex < history.length - 1) {
                    hisIndex++;
                    _this._inputNode.value = history[hisIndex];
                }
                else if (hisIndex === history.length - 1) {
                    hisIndex++;
                    _this._inputNode.value = '';
                }
            }
        };
        this._consoleNode.appendChild(this._inputNode);
    };
    OnScreenConsole.prototype._print = function (method) {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var consoleNode = utils_1.getNode('panel');
            if (consoleNode) {
                var msgNode = document.createElement('div');
                msgNode.className = 'console-message';
                msgNode.style.cssText = "\n          min-height: 20px;\n          font-size: 14px;\n          color: " + constants_1.SUPPORTED_COLORS[method] + ";\n          background-color: " + constants_1.SUPPORTED_COLORS[method] + "11;\n          border-top: 1px solid " + constants_1.SUPPORTED_COLORS[method] + "33;\n          padding: 6px 12px;\n        ";
                var msg = [];
                for (var _a = 0, args_1 = args; _a < args_1.length; _a++) {
                    var arg = args_1[_a];
                    msg.push(utils_1.format(arg));
                }
                msgNode.innerHTML = msg.join(' ');
                this._consoleNode.insertBefore(msgNode, this._inputNode);
                this._consoleNode.scrollTop = consoleNode.scrollHeight;
            }
            else {
                this['_' + method].apply(this, args);
            }
        };
    };
    OnScreenConsole.prototype.enable = function (displayButton) {
        if (displayButton === void 0) { displayButton = true; }
        var consoleNode = utils_1.getNode('panel');
        if (!consoleNode) {
            document.body.appendChild(this._consoleNode);
        }
        var hideBtn = utils_1.getNode('hide');
        if (!hideBtn && displayButton) {
            this._consoleNode.appendChild(this._hideBtn);
        }
        var showBtn = utils_1.getNode('show');
        if (!showBtn && displayButton) {
            document.body.appendChild(this._showBtn);
        }
    };
    OnScreenConsole.prototype.disable = function () {
        var consoleNode = utils_1.getNode('panel');
        if (consoleNode) {
            consoleNode.remove();
        }
        var showBtn = utils_1.getNode('show');
        if (showBtn) {
            showBtn.remove();
        }
    };
    OnScreenConsole.prototype.show = function () {
        var consoleNode = utils_1.getNode('panel');
        if (consoleNode && this._consoleNode.style.bottom !== '0px') {
            this._consoleNode.style.bottom = '0px';
            this._hideBtn.style.bottom = '6px';
        }
        this._isShown = true;
    };
    OnScreenConsole.prototype.hide = function () {
        var consoleNode = utils_1.getNode('panel');
        if (consoleNode && this._consoleNode.style.bottom === '0px') {
            this._consoleNode.style.bottom = (-this._consoleNode.offsetHeight - 10) + 'px';
            this._hideBtn.style.bottom = (-this._consoleNode.offsetHeight - 4) + 'px';
        }
        this._isShown = false;
    };
    OnScreenConsole.prototype.isShown = function () {
        return this._isShown;
    };
    return OnScreenConsole;
}());
exports.default = new OnScreenConsole();
//# sourceMappingURL=index.js.map