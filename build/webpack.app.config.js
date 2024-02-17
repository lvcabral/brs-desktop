const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const packageInfo = require("../package.json");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const translateEnvToMode = (env) => {
  if (env.production) {
    return "production";
  }
  return "development";
};

module.exports = env => {
  let libraryName = "brs";
  let fileApi = libraryName + ".api.js";
  let fileWrk = libraryName + ".worker.js";
  return [merge(base(env), {
    entry: {
      main: "./src/main.js",
      app: "./src/app/app.js",
    },
    mode: translateEnvToMode(env),
    plugins: [
      new HtmlWebpackPlugin({
        chunks: ['app'],
        template: "src/app/index.ejs",
        templateParameters: {
          appName: packageInfo.productName,
          brsApi: fileApi
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { context: "src/app/", from: "preload.js", to: "../app" },
          { context: "src/app/", from: "images/**", to: "../app" },
          { context: "src/app/", from: "fonts/**", to: "../app" },
          { context: "src/app/", from: "css/**", to: "../app" },
          { context: "src/app/", from: "web/**", to: "../app" },
          { context: "node_modules/brs-engine/app/lib", from: fileApi, to: "lib" },
          { context: "node_modules/brs-engine/app/lib", from: fileWrk, to: "lib" },
          { context: "node_modules/brs-engine/app/", from: "audio/**", to: "../app" },
          { context: "node_modules/brs-engine/app/", from: "fonts/**", to: "../app" },
        ]
      })
    ],
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    }
  }),
  {
    entry: {
      editor: "./src/app/editor.js"
    },
    target: "web",
    mode: translateEnvToMode(env),
    plugins: [
      new HtmlWebpackPlugin({
        chunks: ['editor'],
        template: "src/app/editor.ejs",
        filename: "editor.html",
        templateParameters: {
          appName: packageInfo.productName,
          brsApi: fileApi
        }
      }),
    ],
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    }
  }];
};
