import { describe, expect, it } from "vitest";
import defaultCapability from "../../src-tauri/capabilities/default.json";

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
});
