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
    childProcess
      .spawn(electron, ["."].concat(process.argv.slice(2), //`-w 8888`//'--mode=sd'//'--pwd=newpwd'//"--installer" //"-e"
                //  ["-o C:\\Projects\\Roku\\Lode-Runner-Roku\\out\\roku-deploy.zip", 
                //  "-d", "--fullscreen" ] 
                ),
       { stdio: "inherit" })
      .on("close", () => {
        watching.close();
      });
  }
});
