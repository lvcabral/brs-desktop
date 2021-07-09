import { app, nativeTheme } from "electron";
import path from "path";
import os from "os";
import ElectronPreferences from "electron-preferences";

let settings;

export function getSettings(window) {
    if (settings === undefined) {
        settings = new ElectronPreferences({
            'dataStore': path.resolve(app.getPath('userData'), 'brs-settings.json'),
            'defaults': {
                'notes': {
                    'folder': path.resolve(os.homedir(), 'Notes')
                },
                'markdown': {
                    'auto_format_links': true,
                    'show_gutter': false
                },
                'preview': {
                    'show': true
                },
                'drawer': {
                    'show': true
                },
                'theme': {
                    'theme': 'purple'
                }
            },
            'webPreferences': {
                'devTools': true
            },
            'browserWindowOverrides': {
                'title': 'Emulator Settings',
                'parent': window,
                'modal': true,
                'icon': __dirname + "/images/icon48x48.ico",
                'minimizable': false,
                'maximizable': false,
            },
            'sections': [
                {
                    'id': 'about',
                    'label': 'About You',
                    'icon': 'single-01',
                    'form': {
                        'groups': [
                            {
                                'label': 'About You',
                                'fields': [
                                    {
                                        'label': 'First Name',
                                        'key': 'first_name',
                                        'type': 'text',
                                        'help': 'What is your first name?'
                                    },
                                    {
                                        'label': 'Last Name',
                                        'key': 'last_name',
                                        'type': 'text',
                                        'help': 'What is your last name?'
                                    },
                                    {
                                        'label': 'Gender',
                                        'key': 'gender',
                                        'type': 'dropdown',
                                        'options': [
                                            { 'label': 'Male', 'value': 'male' },
                                            { 'label': 'Female', 'value': 'female' },
                                            { 'label': 'Unspecified', 'value': 'unspecified' },
                                        ],
                                        'help': 'What is your gender?'
                                    },
                                    {
                                        'label': 'Age',
                                        'key': 'age',
                                        'type': 'text',
                                        'inputType': 'number'
                                    },
                                    {
                                        'label': 'Which of the following foods do you like?',
                                        'key': 'foods',
                                        'type': 'checkbox',
                                        'options': [
                                            { 'label': 'Ice Cream', 'value': 'ice_cream' },
                                            { 'label': 'Carrots', 'value': 'carrots' },
                                            { 'label': 'Cake', 'value': 'cake' },
                                            { 'label': 'Spinach', 'value': 'spinach' }
                                        ],
                                        'help': 'Select one or more foods that you like.'
                                    },
                                    {
                                        'label': 'Coolness',
                                        'key': 'coolness',
                                        'type': 'slider',
                                        'min': 0,
                                        'max': 9001
                                    },
                                    {
                                        'label': 'Eye Color',
                                        'key': 'eye_color',
                                        'type': 'color',
                                        'format': 'hex',
                                        'help': 'Your eye color'
                                    },
                                    {
                                        'label': 'Hair Color',
                                        'key': 'hair_color',
                                        'type': 'color',
                                        'format': 'rgb',
                                        'help': 'Your hair color'
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    'id': 'notes',
                    'label': 'Notes',
                    'icon': 'folder-15',
                    'form': {
                        'groups': [
                            {
                                'label': 'Stuff',
                                'fields': [
                                    {
                                        'label': 'Read notes from folder',
                                        'key': 'folder',
                                        'type': 'directory',
                                        'help': 'The location where your notes will be stored.'
                                    },
                                    {
                                        'heading': 'Important Message',
                                        'content': '<p>The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence.</p>',
                                        'type': 'message',
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    'id': 'space',
                    'label': 'Other Settings',
                    'icon': 'spaceship',
                    'form': {
                        'groups': [
                            {
                                'fields': [
                                    {
                                        'label': 'Phone Number',
                                        'key': 'phone_number',
                                        'type': 'text',
                                        'help': 'What is your phone number?'
                                    },
                                    {
                                        'label': "Foo or Bar?",
                                        'key': 'foobar',
                                        'type': 'radio',
                                        'options': [
                                            { 'label': 'Foo', 'value': 'foo' },
                                            { 'label': 'Bar', 'value': 'bar' },
                                            { 'label': 'FooBar', 'value': 'foobar' },
                                        ],
                                        'help': 'Foo? Bar?'
                                    },
                                    {
                                        'label': "Bar or Foo?",
                                        'key': 'barfoo',
                                        'type': 'radio',
                                        'options': [
                                            { 'label': 'Bar', 'value': 'bar' },
                                            { 'label': 'Foo', 'value': 'foo' },
                                            { 'label': 'BarFoo', 'value': 'barfoo' },
                                        ],
                                        'help': 'Bar? Foo?'
                                    },
                                    {
                                        'label': 'Shortcut',
                                        'key': 'shortcut',
                                        'type': 'accelerator',
                                        'help': 'A keyboard shortcut'
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    'id': 'lists',
                    'label': 'Lists',
                    'icon': 'notes',
                    'form': {
                        'groups': [
                            {
                                'label': 'Lists',
                                'fields': [
                                    {
                                        'label': 'Favorite foods',
                                        'key': 'foods',
                                        'type': 'list',
                                        'size': 15,
                                        'help': 'A list of your favorite foods',
                                        'addItemValidator': /^[A-Za-z ]+$/.toString(),
                                        'addItemLabel': 'Add favorite food'
                                    },
                                    {
                                        'label': 'Best places to visit',
                                        'key': 'places',
                                        'type': 'list',
                                        'size': 10,
                                        'style': {
                                            'width': '75%'
                                        },
                                        'help': 'An ordered list of nice places to visit',
                                        'orderable': true
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    'id': 'theme',
                    'label': 'Theme',
                    'icon': 'brightness-6',
                    'form': {
                        'groups': [
                            {
                                'fields': [
                                    {
                                        'label': "Theme",
                                        'key': 'theme',
                                        'type': 'radio',
                                        'options': [
                                            { 'label': 'Purple (default)', 'value': 'purple' },
                                            { 'label': 'Light', 'value': 'light' },
                                            { 'label': 'Dark', 'value': 'dark' },
                                            { 'label': 'System', 'value': 'system' },
                                        ],
                                        'help': 'Light or dark theme?'
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        });
        setThemeSource(settings.preferences);
        settings.on('save', (preferences) => {
            window.webContents.send("setTheme", setThemeSource(preferences));
        });
    }
    return settings;
}

export function setThemeSource(preferences) {
    let userTheme = "purple";
    let systemTheme = "system";
    if (preferences.theme) {
        userTheme = preferences.theme.theme;
        app.applicationMenu.getMenuItemById(`theme-${userTheme}`).checked = true;
        if (userTheme === "purple") {
            systemTheme = "system";
        } else {
            systemTheme = userTheme;
        }
    }
    nativeTheme.themeSource = systemTheme;
    if (userTheme === "system") {
        userTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    return userTheme;
}