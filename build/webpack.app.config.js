const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const packageInfo = require("../package.json");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
  let libraryName = "brs";
  let fileApi = libraryName + ".api.js";
  let fileWrk = libraryName + ".worker.js";
  return merge(base(env), {
    entry: {
      main: "./src/main.js",
      app: "./src/app/app.js"
    },
    plugins: [
      new HtmlWebpackPlugin({
        chunks: ['app'],
        templateParameters: {
          appName: packageInfo.productName,
          brsApi: fileApi
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { context: "src/app/", from: "preload.js", to: "../app" },
          { context: "src/app/", from: "fonts/**", to: "../app" },
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
  });
};
