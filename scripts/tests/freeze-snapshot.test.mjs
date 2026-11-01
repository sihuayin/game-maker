import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { verifyFreezeSnapshot } from "../lib/freeze-snapshot.mjs";
import { makeFixture, writeText } from "./helpers.mjs";

function run(f, headRoot = f.root) {
  return verifyFreezeSnapshot({
    registryPath: f.registryPath,
    repoRoot: f.root,
    headRoot,
    baselineId: "p0-02-second-demo-v2",
  });
}

describe("freeze snapshot verification", () => {
  it("passes for the exact 1-file fixture", () => {
    const f = makeFixture();
    const result = run(f);
    expect(result.pass).toBe(true);
    expect(result.count).toBe(1);
    expect(result.verified).toBe(1);
    expect(result.missing).toEqual([]);
    expect(result.mismatched).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it("fails on a missing head file", () => {
    const f = makeFixture();
    fs.rmSync(path.join(f.root, ".scratch/b/freeze/pack/a.txt"));
    const result = run(f);
    expect(result.pass).toBe(false);
    expect(result.missing).toEqual(["a.txt"]);
  });

  it("fails on a hash mismatch", () => {
    const f = makeFixture();
    writeText(path.join(f.root, ".scratch/b/freeze/pack/a.txt"), "changed");
    const result = run(f);
    expect(result.pass).toBe(false);
    expect(result.mismatched).toHaveLength(1);
  });

  it("fails on an extra head file", () => {
    const f = makeFixture();
    writeText(path.join(f.root, ".scratch/b/freeze/pack/b.txt"), "extra");
    const result = run(f);
    expect(result.pass).toBe(false);
    expect(result.extra).toEqual(["b.txt"]);
  });
});
