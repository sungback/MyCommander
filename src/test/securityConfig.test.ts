import { describe, expect, it } from "vitest";
import tauriConfig from "../../src-tauri/tauri.conf.json";
import defaultCapability from "../../src-tauri/capabilities/default.json";
import packageJson from "../../package.json";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import libSource from "../../src-tauri/src/lib.rs?raw";

interface TauriWindowConfig {
  devtools?: boolean;
}

type CspConfig = string | Record<string, string | string[]> | null | undefined;
type AssetProtocolScope =
  | string[]
  | {
      allow?: string[];
      deny?: string[];
    };

const getTauriCargoFeatures = () => {
  const dependency = cargoToml.match(/tauri\s*=\s*\{[^}]*features\s*=\s*\[([^\]]*)\]/);
  if (!dependency) {
    return [];
  }

  return Array.from(dependency[1].matchAll(/"([^"]+)"/g)).map((match) => match[1]);
};

const serializeCsp = (csp: CspConfig) => {
  if (!csp) {
    return "";
  }

  if (typeof csp === "string") {
    return csp;
  }

  return Object.entries(csp)
    .map(([directive, sources]) => {
      const sourceText = Array.isArray(sources) ? sources.join(" ") : sources;
      return `${directive} ${sourceText}`;
    })
    .join("; ");
};

const getAssetScopeLists = (scope: AssetProtocolScope | undefined) => {
  if (!scope) {
    return { allow: [], deny: [] };
  }

  if (Array.isArray(scope)) {
    return { allow: scope, deny: [] };
  }

  return { allow: scope.allow ?? [], deny: scope.deny ?? [] };
};

describe("Tauri security config", () => {
  it("does not enable DevTools in release-capable config", () => {
    const windows = (tauriConfig.app.windows ?? []) as TauriWindowConfig[];

    expect(windows.map((window) => window.devtools)).not.toContain(true);
    expect(getTauriCargoFeatures()).not.toContain("devtools");
  });

  it("uses an explicit CSP that still permits required Tauri channels", () => {
    const csp = serializeCsp(tauriConfig.app.security?.csp as CspConfig);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("ipc:");
    expect(csp).toContain("http://ipc.localhost");
    expect(csp).toContain("img-src");
    expect(csp).toContain("asset:");
    expect(csp).toContain("http://asset.localhost");
    expect(csp).toContain("media-src");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("bounds the asset protocol instead of allowing every path", () => {
    const scope = getAssetScopeLists(
      tauriConfig.app.security?.assetProtocol?.scope as AssetProtocolScope | undefined
    );

    expect(scope.allow).toEqual(expect.arrayContaining(["$HOME/**"]));
    expect(scope.allow).not.toEqual(expect.arrayContaining(["**", "*"]));
    expect(scope.deny).toEqual(
      expect.arrayContaining(["$HOME/.ssh/**", "$HOME/.gnupg/**", "$HOME/.aws/**"])
    );
  });

  it("does not expose the unused Tauri shell plugin", () => {
    expect(defaultCapability.permissions).not.toContain("shell:default");
    expect(packageJson.dependencies).not.toHaveProperty("@tauri-apps/plugin-shell");
    expect(cargoToml).not.toContain("tauri-plugin-shell");
    expect(libSource).not.toContain("tauri_plugin_shell::init()");
  });
});
