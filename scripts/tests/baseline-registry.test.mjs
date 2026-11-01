import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { loadRegistry } from "../lib/baseline-registry.mjs";
import { makeFixture, writeJson, writeText, expectCode } from "./helpers.mjs";

function load(f, opts = {}) {
  return loadRegistry({ registryPath: f.registryPath, repoRoot: f.root, exactIds: true, ...opts });
}

function rewrite(f, registry) {
  writeJson(f.registryPath, registry);
}

describe("baseline registry", () => {
  it("accepts a valid A/B registry with exact ids", () => {
    const f = makeFixture();
    const { entries } = load(f);
    expect(entries.map((e) => e.id)).toEqual(["fpvs-v1", "p0-02-second-demo-v2"]);
    expect(entries[1].freezeEntries).toHaveLength(1);
  });

  it("rejects unknown fields", () => {
    const f = makeFixture();
    f.registry.baselines[0].sha256 = "sha256:" + "0".repeat(64);
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.unknown-field");
  });

  it("rejects duplicate baseline ids", () => {
    const f = makeFixture();
    f.registry.baselines[1].id = "fpvs-v1";
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.duplicate-id");
  });

  it("rejects a missing required baseline", () => {
    const f = makeFixture();
    f.registry.baselines.pop();
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.baseline-missing");
  });

  it("rejects an unexpected baseline when exact ids are required", () => {
    const f = makeFixture();
    expectCode(() => load(f, { requiredIds: ["fpvs-v1"] }), "registry.baseline-set");
  });

  it("rejects cross-baseline path binding", () => {
    const f = makeFixture();
    f.registry.baselines[0].anchor = f.registry.baselines[1].anchor;
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.path-binding");
  });

  it("rejects manifest/anchor/update-log in different directories", () => {
    const f = makeFixture();
    const other = path.join(f.root, ".scratch/a/other/expected-hashes.sha256");
    writeText(other, f.aManifestSha + "\n");
    f.registry.baselines[0].anchor = ".scratch/a/other/expected-hashes.sha256";
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.path-binding");
  });

  it("rejects a path traversal", () => {
    const f = makeFixture();
    f.registry.baselines[0].manifest = "../outside.json";
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.path-invalid");
  });

  it("rejects a non-POSIX path", () => {
    const f = makeFixture();
    f.registry.baselines[0].manifest = ".scratch\\a\\manifest\\expected-hashes.json";
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.path-invalid");
  });

  it("rejects a realpath outside the repo", () => {
    const f = makeFixture();
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-04-outside-"));
    const outside = path.join(outsideDir, "manifest.json");
    writeText(outside, f.aManifestText);
    const link = path.join(f.root, ".scratch/a/manifest/link.json");
    fs.symlinkSync(outside, link);
    f.registry.baselines[0].manifest = ".scratch/a/manifest/link.json";
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.path-invalid");
  });

  it("requires freezeHashes for non-legacy baselines and allows A to omit it", () => {
    const f = makeFixture();
    expect(load(f).entries[0].freezeHashesAbs).toBeUndefined();
    delete f.registry.baselines[1].freezeHashes;
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.freeze-missing");
  });

  it("rejects identity mismatch", () => {
    const f = makeFixture();
    f.registry.baselines[1].identity.packVersion = 2;
    rewrite(f, f.registry);
    expectCode(() => load(f), "registry.identity-mismatch");
  });

  it("rejects an anchor mismatch", () => {
    const f = makeFixture();
    writeText(f.aAnchorPath, "sha256:" + "0".repeat(64) + "\n");
    expectCode(() => load(f), "registry.anchor-mismatch");
  });

  it("rejects an update log mismatch", () => {
    const f = makeFixture();
    writeText(f.aLogPath, "# MANIFEST-UPDATES\n\n- newSha256: sha256:" + "0".repeat(64) + "\n");
    expectCode(() => load(f), "registry.update-log-mismatch");
  });

  it("rejects an invalid freeze hash list", () => {
    const f = makeFixture();
    writeText(f.freezeHashesPath, "not-a-hash  a.txt\n");
    expectCode(() => load(f), "freeze.format");
  });

  it("rejects duplicate freeze hash paths", () => {
    const f = makeFixture();
    const line = f.registry.baselines[1].freezeHashes;
    expect(line).toBe(".scratch/b/freeze-sha256.txt");
    fs.writeFileSync(f.freezeHashesPath, "a".repeat(64) + "  a.txt\n" + "b".repeat(64) + "  a.txt\n");
    expectCode(() => load(f), "freeze.duplicate");
  });

  it("rejects a missing freeze hash list", () => {
    const f = makeFixture();
    fs.rmSync(f.freezeHashesPath);
    expectCode(() => load(f), "registry.file-missing");
  });
});
