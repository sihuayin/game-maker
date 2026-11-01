import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { loadRegistry } from "../lib/baseline-registry.mjs";
import { parseStrictUpdateLog } from "../lib/update-log.mjs";
import { makeFixture, writeText, expectCode } from "./helpers.mjs";

function bEntry(f) {
  return loadRegistry({ registryPath: f.registryPath, repoRoot: f.root }).byId.get("p0-02-second-demo-v2");
}

describe("strict B update log", () => {
  it("accepts the current B log shape", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    expect(() => parseStrictUpdateLog(fsText(f.bLogPath), entry)).not.toThrow();
  });

  it("rejects a missing required field", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    const text = fsText(f.bLogPath).replace(/^- evidence:.*\n/m, "");
    expectCode(() => parseStrictUpdateLog(text, entry), "log.missing-field");
  });

  it("rejects duplicate fields", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    const text = fsText(f.bLogPath) + "- reason: again\n";
    expectCode(() => parseStrictUpdateLog(text, entry), "log.duplicate-field");
  });

  it("rejects an invalid digest", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    const text = fsText(f.bLogPath).replace(/- newSha256:.*/, "- newSha256: sha256:xyz");
    expectCode(() => parseStrictUpdateLog(text, entry), "log.invalid-digest");
  });

  it("rejects a baselineId mismatch", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    const text = fsText(f.bLogPath).replace("- baselineId: p0-02-second-demo-v2", "- baselineId: wrong");
    expectCode(() => parseStrictUpdateLog(text, entry), "log.baseline-id");
  });

  it("rejects a final digest mismatch", () => {
    const f = makeFixture();
    const entry = bEntry(f);
    const text = fsText(f.bLogPath).replace(/- newSha256:.*/, "- newSha256: sha256:" + "0".repeat(64));
    expectCode(() => parseStrictUpdateLog(text, entry), "log.final-digest");
  });
});

function fsText(p) {
  return fs.readFileSync(p, "utf8");
}
