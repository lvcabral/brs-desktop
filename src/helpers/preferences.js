const electron = require('electron');
const { BrowserWindow, ipcMain, webContents, dialog } = electron;
const path = require('path');
const url = require('url');
const fs = require('fs');
const _ = require('lodash');
const { EventEmitter2 } = require('eventemitter2');
const loadJsonFile = require('load-json-file');
const writeJsonFile = require('write-json-file');

class ElectronPreferences extends EventEmitter2 {

    constructor(options = {}) {

        super();

        _.defaultsDeep(options, {
            'sections': [],
            'webPreferences': {
                'devTools': false
            }
        });

        options.sections.forEach((section, sectionIdx) => {
            _.defaultsDeep(section, {
                'form': {
                    'groups': []
                }
            });
            section.form.groups = section.form.groups.map((group, groupIdx) => {
                group.id = 'group' + sectionIdx + groupIdx;
                return group;
            });
        });

        this.options = options;

        if (!this.dataStore) {
            throw new Error(`The 'dataStore' option is required.`);
        }

        // Load preferences file if exists
        try {
			if (fs.existsSync(this.dataStore)) {
				this.preferences = loadJsonFile.sync(this.dataStore)
			}
        } catch(err) {
			console.error(err)
			this.preferences = null
        }

        if (!this.preferences) {
            this.preferences = this.defaults;
        } else {
        	// Set default preference values
            _.keys(this.defaults).forEach(prefDefault => {
                if (!(prefDefault in this.preferences)) {
                    this.preferences[prefDefault] = this.defaults[prefDefault]
                }
            })
        }

        if (_.isFunction(options.onLoad)) {
            this.preferences = options.onLoad(this.preferences);
        }

        this.save();

        ipcMain.on('showPreferences', (event) => {
            this.show();
        });

        ipcMain.on('getSections', (event) => {
            event.returnValue = this.options.sections;
        });

        ipcMain.on('restoreDefaults', (event) => {
            this.preferences = this.defaults;
            this.save();
            this.broadcast();
        });

        ipcMain.on('getDefaults', (event) => {
            event.returnValue = this.defaults;
        });

        ipcMain.on('getPreferences', (event) => {
            event.returnValue = this.preferences;
        });

        ipcMain.on('setPreferences', (event, value) => {
            this.preferences = value;
            this.save();
            this.broadcast();
            this.emit('save', Object.freeze(_.cloneDeep(this.preferences)));
            event.returnValue = null;
        });

        ipcMain.on('showOpenDialog', (event, dialogOptions) => {
            event.returnValue = dialog.showOpenDialogSync(dialogOptions);
        });

        if (_.isFunction(options.afterLoad)) {
            options.afterLoad(this);
        }

    }

    get dataStore() {

        return this.options.dataStore;

    }

    get defaults() {

        return this.options.defaults || {};

    }

    get preferences() {

        return this._preferences;

    }

    set preferences(value) {

        this._preferences = value;

    }

    save() {

        writeJsonFile(this.dataStore, this.preferences, {
            indent: 4
        });

    }

    value(key, value) {

        if (_.isArray(key)) {
            key.forEach(({ key, value }) => {
                _.set(this.preferences, key, value);
            });
            this.save();
            this.broadcast();
        } else if (!_.isUndefined(key) && !_.isUndefined(value)) {
            _.set(this.preferences, key, value);
            this.save();
            this.broadcast();
        } else if (!_.isUndefined(key)) {
            return _.cloneDeep(_.get(this.preferences, key));
        } else {
            return _.cloneDeep(this.preferences);
        }

    }

    broadcast() {

        webContents.getAllWebContents()
            .forEach((wc) => {
                wc.send('preferencesUpdated', this.preferences);
            });

    }

    show() {
        console.log("show was called!");

        if (this.prefsWindow) {
            console.log("prefsWindow already exists!");
            this.prefsWindow.focus();
            return;
        }

        let browserWindowOpts = {
            title: 'Preferences',
            width: 800,
            maxWidth: 800,
            height: 600,
            maxHeight: 600,
            resizable: false,
            acceptFirstMouse: true,
            maximizable: false,
            backgroundColor: '#E7E7E7',
            show: true,
            webPreferences: this.options.webPreferences
        };

        const defaultWebPreferences = {
            nodeIntegration: false,
            enableRemoteModule: false,
            contextIsolation: true,
            preload: path.join(__dirname, './preload.js')
        }

        if (this.options.browserWindowOverrides) {
            browserWindowOpts = Object.assign(browserWindowOpts, this.options.browserWindowOverrides);
        }

        if (browserWindowOpts.webPreferences) {
            browserWindowOpts.webPreferences = Object.assign(defaultWebPreferences, browserWindowOpts.webPreferences)
        } else {
            browserWindowOpts.webPreferences = defaultWebPreferences;
        }

        this.prefsWindow = new BrowserWindow(browserWindowOpts);

        if (this.options.menuBar) {
            this.prefsWindow.setMenu(this.options.menuBar);
        } else {
            this.prefsWindow.removeMenu();
        }
        const html = path.join(__dirname, 'prefs/index.html');
        console.log(html);
        this.prefsWindow.loadURL(url.format({
            'pathname': html,
            'protocol': 'file:',
            'slashes': true
        })).then(function () {
            console.log("on fullfiled");
        }, function() {
            console.log("on reject");
        });

        this.prefsWindow.on('closed', () => {
            this.prefsWindow = null;
        });


    }

}
module.exports = ElectronPreferences;
