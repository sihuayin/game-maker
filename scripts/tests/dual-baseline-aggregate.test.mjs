import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { aggregateDualBaseline } from "../lib/dual-baseline-aggregate.mjs";
import { makeFixture, writeJson } from "./helpers.mjs";

function setup() {
  const f = makeFixture();
  const aRel = ".scratch/a/manifest/expected-hashes.json";
  const bRel = ".scratch/b/manifest/final-manifest.json";
  const paths = {
    aSummary: path.join(f.root, "runs/a-summary.json"),
    bSummary: path.join(f.root, "runs/b-summary.json"),
    aReport: path.join(f.root, "runs/a-report.json"),
    bReport: path.join(f.root, "runs/b-report.json"),
    bFreeze: path.join(f.root, "runs/b-freeze.json"),
    aManifest: path.join(f.root, aRel),
    bManifest: path.join(f.root, bRel),
  };
  writeJson(paths.aSummary, { pass: true, status: "pass", exitCode: 0, manifestSha256: f.aManifestSha, expectedManifestSha256: f.aManifestSha, baselineId: "fpvs-v1" });
  writeJson(paths.bSummary, { pass: true, status: "pass", exitCode: 0, manifestSha256: f.bManifestSha, expectedManifestSha256: f.bManifestSha, baselineId: "p0-02-second-demo-v2" });
  writeJson(paths.aReport, { status: "pass", trust: { result: "matched", expectedSha256: f.aManifestSha, actualSha256: f.aManifestSha }, input: { manifest: { path: aRel, sha256: f.aManifestSha } }, comparison: { verdictMatch: true } });
  writeJson(paths.bReport, { status: "pass", trust: { result: "matched", expectedSha256: f.bManifestSha, actualSha256: f.bManifestSha }, input: { manifest: { path: bRel, sha256: f.bManifestSha } }, comparison: { verdictMatch: true } });
  writeJson(paths.bFreeze, { pass: true, count: 1, missing: [], mismatched: [], extra: [] });
  return { f, paths };
}

function run(f, paths, overrides = {}) {
  return aggregateDualBaseline({
    registryPath: f.registryPath,
    repoRoot: f.root,
    a: { outcome: "success", summaryPath: paths.aSummary, reportPath: paths.aReport, manifestPath: paths.aManifest, ...(overrides.a ?? {}) },
    b: { outcome: "success", freezeOutcome: "success", summaryPath: paths.bSummary, reportPath: paths.bReport, manifestPath: paths.bManifest, freezePath: paths.bFreeze, ...(overrides.b ?? {}) },
  });
}

describe("dual-baseline aggregate", () => {
  it("passes when all evidence is complete", () => {
    const { f, paths } = setup();
    const result = run(f, paths);
    expect(result.pass).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("fails when A step outcome is not success", () => {
    const { f, paths } = setup();
    const result = run(f, paths, { a: { outcome: "failure" } });
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/A outcome/);
  });

  it("fails when B step outcome is skipped", () => {
    const { f, paths } = setup();
    const result = run(f, paths, { b: { outcome: "skipped" } });
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/B outcome/);
  });

  it("fails when a summary is missing", () => {
    const { f, paths } = setup();
    const result = run(f, paths, { a: { summaryPath: path.join(f.root, "missing.json") } });
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/A summary 不存在/);
  });

  it("fails on status/anchor/path mismatch", () => {
    const { f, paths } = setup();
    writeJson(paths.bReport, { status: "pass", trust: { result: "mismatch", expectedSha256: f.bManifestSha, actualSha256: f.bManifestSha }, input: { manifest: { path: "wrong.json", sha256: f.bManifestSha } }, comparison: { verdictMatch: true } });
    const result = run(f, paths);
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/trust.result/);
    expect(result.problems.join("\n")).toMatch(/manifest.path/);
  });

  it("fails when the freeze verification is not pass", () => {
    const { f, paths } = setup();
    writeJson(paths.bFreeze, { pass: false, count: 1, missing: ["a.txt"], mismatched: [], extra: [] });
    const result = run(f, paths);
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/B-freeze pass/);
    expect(result.problems.join("\n")).toMatch(/missing 非空/);
  });

  it("fails when the freeze step outcome is missing", () => {
    const { f, paths } = setup();
    const result = run(f, paths, { b: { freezeOutcome: undefined } });
    expect(result.pass).toBe(false);
    expect(result.problems.join("\n")).toMatch(/B-freeze outcome/);
  });
});
