const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const package = require("../package.json");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
  let libraryName = "brs";
  let fileApi, fileWrk;
  if (env.production) {
    fileApi = libraryName + ".api.js";
    fileWrk = libraryName + ".worker.js";
  } else {
    fileApi = libraryName + ".api.js";
    fileWrk = libraryName + ".worker.js";
  }
  return merge(base(env), {
    entry: {
      main: "./src/main.js",
      app: "./src/app/app.js"
    },
    plugins: [
      new HtmlWebpackPlugin({
        chunks: ['app'],
        templateParameters: {
          appName: package.productName,
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
