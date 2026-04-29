const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const replaceCargoPackageVersion = (cargoToml, newVersion) => {
  const packageVersionPattern = /^(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m;

  if (!packageVersionPattern.test(cargoToml)) {
    throw new Error('Could not find [package] version in src-tauri/Cargo.toml');
  }

  return cargoToml.replace(packageVersionPattern, `$1${newVersion}$3`);
};

try {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = readJson(pkgPath);
  const newVersion = pkg.version;

  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (!fs.existsSync(tauriConfPath)) {
    console.error('src-tauri/tauri.conf.json not found.');
    process.exit(1);
  }

  const tauriConf = readJson(tauriConfPath);
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) {
    console.error('src-tauri/Cargo.toml not found.');
    process.exit(1);
  }

  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  fs.writeFileSync(cargoTomlPath, replaceCargoPackageVersion(cargoToml, newVersion));

  console.log(`Release versions synced to ${newVersion}`);
} catch (error) {
  console.error('Version sync failed:', error);
  process.exit(1);
}
