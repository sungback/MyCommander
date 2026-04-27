import { describe, expect, it } from "vitest";
import defaultCapability from "../../src-tauri/capabilities/default.json";
import buildScriptSource from "../../src-tauri/build.rs?raw";
import libSource from "../../src-tauri/src/lib.rs?raw";

const permissionSources = import.meta.glob("../../src-tauri/permissions/**/*.toml", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const getRegisteredCommands = () => {
  const handlerBlock = libSource.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? "";

  return handlerBlock
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("commands::"))
    .map((line) => {
      const parts = line.split("::");
      return parts[parts.length - 1];
    })
    .filter((command): command is string => Boolean(command))
    .sort();
};

const getBuildManifestCommands = () => {
  const commandsBlock = buildScriptSource.match(/\.commands\(&\[([\s\S]*?)\]\)/)?.[1] ?? "";

  return Array.from(commandsBlock.matchAll(/"([^"]+)"/g))
    .map((match) => match[1])
    .sort();
};

const getPermissionIdentifiersByCommand = () => {
  const identifiersByCommand = new Map<string, string>();

  for (const source of Object.values(permissionSources)) {
    for (const block of source.split("[[permission]]").slice(1)) {
      const identifier = block.match(/identifier\s*=\s*"([^"]+)"/)?.[1];
      const command = block.match(/commands\.allow\s*=\s*\["([^"]+)"\]/)?.[1];

      if (identifier && command) {
        identifiersByCommand.set(command, identifier);
      }
    }
  }

  return identifiersByCommand;
};

describe("default capability", () => {
  it("allows the unified job engine commands used by zip actions", () => {
    expect(defaultCapability.permissions).toEqual(
      expect.arrayContaining([
        "allow-submit-job",
        "allow-list-jobs",
        "allow-cancel-job",
        "allow-retry-job",
        "allow-clear-finished-jobs",
      ])
    );
  });

  it("keeps the Tauri build manifest aligned with registered commands", () => {
    expect(getBuildManifestCommands()).toEqual(getRegisteredCommands());
  });

  it("allows every registered Tauri command in the default capability", () => {
    const registeredCommands = getRegisteredCommands();
    const permissionIdentifiersByCommand = getPermissionIdentifiersByCommand();
    const allowedPermissions = new Set(defaultCapability.permissions);

    const commandsWithoutPermission = registeredCommands.filter(
      (command) => !permissionIdentifiersByCommand.has(command)
    );
    const commandsWithoutDefaultCapability = registeredCommands.filter((command) => {
      const identifier = permissionIdentifiersByCommand.get(command);
      return identifier !== undefined && !allowedPermissions.has(identifier);
    });

    expect(commandsWithoutPermission).toEqual([]);
    expect(commandsWithoutDefaultCapability).toEqual([]);
  });
});
