const path = require("node:path");
const nodeExternals = require("webpack-node-externals");
const FriendlyErrorsWebpackPlugin = require("@soda/friendly-errors-webpack-plugin");

const translateEnvToMode = (env) => {
  if (env.production) {
    return "production";
  }
  return "development";
};

module.exports = (env) => {
  return {
    target: "electron-renderer",
    node: {
      __dirname: false,
      __filename: false,
    },
    externals: [nodeExternals()],
    resolve: {
      alias: {
        env: path.resolve(__dirname, `../config/env_${translateEnvToMode(env)}.json`),
      },
    },
    // Source maps only help while debugging; in production they would just ship ~40 MB of them in the asar.
    devtool: env.production ? false : "source-map",
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: ["babel-loader"],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [new FriendlyErrorsWebpackPlugin({ clearConsole: env.development })],
  };
};
