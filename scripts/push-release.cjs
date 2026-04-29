const { execFileSync } = require("child_process");
const path = require("path");

const packageJson = require("../package.json");
const releaseTag = `v${packageJson.version}`;
const verifyScript = path.join(__dirname, "verify-release-version.cjs");

const run = (command, args) => {
  execFileSync(command, args, { stdio: "inherit" });
};

run(process.execPath, [verifyScript, "--tag", releaseTag]);
run("git", ["push", "origin", "main"]);
run("git", ["push", "origin", releaseTag]);
