const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const getCargoPackageVersion = (cargoToml) => {
  const packageBlock = cargoToml.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
  return packageBlock.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
};

const getExpectedTagName = (version) => `v${version}`;

const getRequestedTagName = () => {
  const tagArgIndex = process.argv.indexOf("--tag");
  if (tagArgIndex >= 0) {
    return process.argv[tagArgIndex + 1] ?? "";
  }

  if (process.env.GITHUB_REF_TYPE === "tag") {
    return process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF?.replace(/^refs\/tags\//, "") ?? "";
  }

  return "";
};

const failures = [];
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const cargoVersion = getCargoPackageVersion(readText("src-tauri/Cargo.toml"));
const version = packageJson.version;

const expectEqual = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, found ${actual ?? "missing"}`);
  }
};

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  failures.push(`package.json version is not valid semver: ${version}`);
}

expectEqual("package-lock.json version", packageLock.version, version);
expectEqual("package-lock root package version", packageLock.packages?.[""]?.version, version);
expectEqual("src-tauri/tauri.conf.json version", tauriConfig.version, version);
expectEqual("src-tauri/Cargo.toml package version", cargoVersion, version);

const requestedTagName = getRequestedTagName();
if (requestedTagName) {
  expectEqual("release tag", requestedTagName, getExpectedTagName(version));
}

if (failures.length > 0) {
  console.error("Release version verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release version verification passed for ${version}`);
