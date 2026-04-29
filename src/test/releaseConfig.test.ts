import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import packageLock from "../../package-lock.json";
import tauriConfig from "../../src-tauri/tauri.conf.json";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import versionSyncSource from "../../version-sync.cjs?raw";
import releaseWorkflowSource from "../../.github/workflows/release.yml?raw";

const getCargoPackageVersion = () => {
  const packageBlock = cargoToml.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
  return packageBlock.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
};

describe("release configuration", () => {
  it("keeps package, lockfile, Tauri, and Cargo versions aligned", () => {
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(getCargoPackageVersion()).toBe(packageJson.version);
  });

  it("wires release version verification into local and CI release gates", () => {
    expect(packageJson.scripts).toHaveProperty("verify:release-version");
    expect(packageJson.scripts["verify:release"]).toMatch(/^npm run verify:release-version &&/);
    expect(packageJson.scripts["verify:release"]).toContain("--bundles app");
    expect(releaseWorkflowSource).toContain("npm run verify:release-version");
  });

  it("pushes only the current release tag instead of every local tag", () => {
    expect(packageJson.scripts["release:push"]).toContain("scripts/push-release.cjs");
    expect(packageJson.scripts["release:push"]).not.toContain("--tags");
  });

  it("syncs Tauri and Cargo versions during npm version updates", () => {
    expect(versionSyncSource).toContain("src-tauri");
    expect(versionSyncSource).toContain("tauri.conf.json");
    expect(versionSyncSource).toContain("Cargo.toml");
    expect(packageJson.scripts.version).toContain("src-tauri/Cargo.toml");
  });
});
