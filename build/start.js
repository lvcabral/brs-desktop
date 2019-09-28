const childProcess = require("child_process");
const electron = require("electron");
const webpack = require("webpack");
const config = require("./webpack.app.config");

const env = "development";
const compiler = webpack(config(env));
let electronStarted = false;
let param = "";
const watching = compiler.watch({}, (err, stats) => {
  if (!err && !stats.hasErrors() && !electronStarted) {
    electronStarted = true;
    if (process.argv.length > 2) {
      param = process.argv[2];
    }
    childProcess
      .spawn(electron, [".", param], { stdio: "inherit" })
      .on("close", () => {
        watching.close();
      });
  }
});
