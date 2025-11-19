const path = require("node:path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const packageInfo = require("../package.json");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const translateEnvToMode = (env) => {
  if (env.production) {
    return "production";
  }
  return "development";
};

module.exports = (env) => {
  let libraryName = "brs";
  let fileApi = libraryName + ".api.js";
  let fileWrk = libraryName + ".worker.js";
  return [
    merge(base(env), {
      entry: {
        main: "./src/main.js",
        app: "./src/app/app.js",
      },
      mode: translateEnvToMode(env),
      plugins: [
        new HtmlWebpackPlugin({
          chunks: ["app"],
          template: "src/app/index.ejs",
          templateParameters: {
            appName: packageInfo.productName,
            brsApi: fileApi,
          },
        }),
        new CopyWebpackPlugin({
          patterns: [
            { context: "src/app/", from: "preload.js", to: "../app" },
            { context: "src/app/", from: "images/**", to: "../app" },
            { context: "src/app/", from: "fonts/**", to: "../app" },
            { context: "src/app/", from: "css/**", to: "../app" },
            { context: "src/app/", from: "web/**", to: "../app" },
            { context: "src/app", from: "assets/**", to: "../app" },
            { context: "node_modules/brs-engine/lib", from: fileApi, to: "lib" },
            { context: "node_modules/brs-engine/lib", from: fileWrk, to: "lib" },
            { context: "node_modules/brs-engine/", from: "assets/**", to: "../app" },
          ],
        }),
      ],
      output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "../app"),
      },
    }),
    merge(base(env), {
      entry: {
        editor: "./src/app/editor.js",
      },
      target: "web",
      mode: translateEnvToMode(env),
      externals: {}, // Override base config externals - bundle all dependencies for web target
      plugins: [
        new MonacoWebpackPlugin({
          // Only include built-in languages - brightscript is registered manually
          languages: ["xml", "ini"],
          // Disable features we don't need to reduce bundle size
          features: [
            "!gotoSymbol",
            "!quickCommand",
            "!quickOutline",
            "!format",
            "!codeAction",
            "!suggest",
          ],
        }),
        new HtmlWebpackPlugin({
          chunks: ["editor"],
          template: "src/app/editor.ejs",
          filename: "editor.html",
          templateParameters: {
            appName: packageInfo.productName,
            brsApi: fileApi,
          },
        }),
        new CopyWebpackPlugin({
          patterns: [
            { context: "src/app/", from: "themes/**", to: "../app" },
            {
              context: "node_modules/@lvcabral/electron-preferences/build/",
              from: "icons/**",
              to: "../app",
            },
          ],
        }),
      ],
      output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "../app"),
      },
    }),
  ];
};
