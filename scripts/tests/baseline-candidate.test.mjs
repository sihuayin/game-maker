import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { validateBaselineCandidate } from "../lib/baseline-candidate.mjs";
import { makeFixture, writeJson, writeText, updateLog, sha256Text, expectCode } from "./helpers.mjs";

function cloneFixture(f) {
  const candidate = fs.mkdtempSync(path.join(os.tmpdir(), "p0-04-candidate-"));
  fs.cpSync(f.root, candidate, { recursive: true });
  return candidate;
}

function validate(f, candidate, baselineId = "p0-02-second-demo-v2", changedPaths = []) {
  return validateBaselineCandidate({ baseRoot: f.root, candidateRoot: candidate, baselineId, changedPaths });
}

function updateBManifest(f, candidate) {
  const doc = JSON.parse(fs.readFileSync(path.join(candidate, ".scratch/b/manifest/final-manifest.json"), "utf8"));
  doc.note = "candidate update";
  const text = JSON.stringify(doc, null, 2) + "\n";
  const sha = sha256Text(text);
  writeText(path.join(candidate, ".scratch/b/manifest/final-manifest.json"), text);
  writeText(path.join(candidate, ".scratch/b/manifest/expected-hashes.sha256"), sha + "\n");
  writeText(path.join(candidate, ".scratch/b/manifest/MANIFEST-UPDATES.md"), updateLog(sha, { baselineId: "p0-02-second-demo-v2" }));
  return { text, sha };
}

describe("baseline candidate validation", () => {
  it("accepts a no-op candidate for both baselines", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    expect(validate(f, candidate, "fpvs-v1").result).toBe("pass");
    expect(validate(f, candidate, "p0-02-second-demo-v2").result).toBe("pass");
  });

  it("accepts a valid B manifest/anchor/log update", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    const { sha } = updateBManifest(f, candidate);
    const result = validate(f, candidate, "p0-02-second-demo-v2", [
      ".scratch/b/manifest/final-manifest.json",
      ".scratch/b/manifest/expected-hashes.sha256",
      ".scratch/b/manifest/MANIFEST-UPDATES.md",
    ]);
    expect(result.result).toBe("pass");
    expect(result.newManifestSha256).toBe(sha);
  });

  it("rejects a changed non-target baseline file", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    const aManifest = path.join(candidate, ".scratch/a/manifest/expected-hashes.json");
    const doc = JSON.parse(fs.readFileSync(aManifest, "utf8"));
    doc.note = "changed";
    const text = JSON.stringify(doc, null, 2) + "\n";
    const sha = sha256Text(text);
    writeText(aManifest, text);
    writeText(path.join(candidate, ".scratch/a/manifest/expected-hashes.sha256"), sha + "\n");
    writeText(path.join(candidate, ".scratch/a/manifest/MANIFEST-UPDATES.md"), updateLog(sha));
    expectCode(() => validate(f, candidate), "candidate.non-target-changed");
  });

  it("rejects a changed freezeHashes file", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    const p = path.join(candidate, ".scratch/b/freeze-sha256.txt");
    const text = fs.readFileSync(p, "utf8");
    fs.writeFileSync(p, (text[0] === "a" ? "b" : "a") + text.slice(1));
    expectCode(() => validate(f, candidate, "p0-02-second-demo-v2", [".scratch/b/freeze-sha256.txt"]), "candidate.freezeHashes-changed");
  });

  it("rejects an anchor mismatch", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    writeText(path.join(candidate, ".scratch/b/manifest/expected-hashes.sha256"), "sha256:" + "0".repeat(64) + "\n");
    expectCode(() => validate(f, candidate), "registry.anchor-mismatch");
  });

  it("rejects a target identity mismatch", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    const registryPath = path.join(candidate, ".scratch/baselines/registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    registry.baselines[1].identity.packVersion = 2;
    writeJson(registryPath, registry);
    expectCode(() => validate(f, candidate), "registry.identity-mismatch");
  });

  it("rejects a target path change", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    fs.copyFileSync(path.join(candidate, ".scratch/b/manifest/final-manifest.json"), path.join(candidate, ".scratch/b/manifest/other.json"));
    const registryPath = path.join(candidate, ".scratch/baselines/registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    registry.baselines[1].manifest = ".scratch/b/manifest/other.json";
    writeJson(registryPath, registry);
    expectCode(() => validate(f, candidate), "candidate.path-changed");
  });

  it("rejects an unexpected diff path", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    writeText(path.join(candidate, "unexpected.txt"), "x");
    expectCode(() => validate(f, candidate, "p0-02-second-demo-v2", ["unexpected.txt"]), "candidate.unexpected-path");
  });

  it("rejects a non-target registry entry change", () => {
    const f = makeFixture();
    const candidate = cloneFixture(f);
    const registryPath = path.join(candidate, ".scratch/baselines/registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    registry.baselines[0].name = "renamed";
    writeJson(registryPath, registry);
    expectCode(() => validate(f, candidate), "candidate.non-target-registry");
  });
});
