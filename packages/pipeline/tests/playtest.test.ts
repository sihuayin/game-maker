import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLAYTEST_HARNESS_VERSION, PLAYTEST_REPORT_VERSION, PLAYTEST_RULES_VERSION, PLAYTEST_SCENARIO_VERSION,
  QAReportSchema, QA_JUDGEMENTS, aggregateAssertions, buildDeliveryReport,
  type DeliveryEvidence, type PlaytestReport, type PlaytestScenarioReport,
} from "@game-maker/contracts";
import { writePlaytestToReport, writePlaytestWritebackError } from "../src/playtest.js";
import { invalidatePlayableSmoke } from "../src/playtest-invalidation.js";

const tmpDirs: string[] = [];
afterEach(() => { for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const sha = (p: string) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "playtest-writeback-"));
  tmpDirs.push(root);
  const outRoot = path.join(root, "out");
  const runDir = path.join(outRoot, "g/run/v1");
  fs.mkdirSync(runDir, { recursive: true });
  const configPath = path.join(runDir, "game-config.json");
  fs.writeFileSync(configPath, JSON.stringify({ format: "game-config/v1" }) + "\n");
  const packDir = path.join(outRoot, "g", "pack", "v1");
  fs.mkdirSync(packDir, { recursive: true });
  const manifestPath = path.join(packDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ id: "g", version: 1, assets: [], files: [] }) + "\n");
  const delivery = buildDeliveryReport({
    runId: "g/run/v1",
    pack: { packId: "g", packVersion: 1 },
    config: { file: "g/run/v1/game-config.json" },
    site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "incomplete" }, { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass" },
  });
  const qa = QAReportSchema.parse({
    format: "qa-report/v1",
    subject: { packId: "g", packVersion: 1 },
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "测试不调用视觉上游" },
    ],
    delivery,
  });
  fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qa, null, 2) + "\n");
  fs.mkdirSync(path.join(runDir, "playtest/v1/success-basic"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "playtest/v1/result.json"), "{}\n");
  fs.writeFileSync(path.join(runDir, "playtest/v1/success-basic/events.jsonl"), "\n");
  return { outRoot, runDir, configPath, configChecksum: sha(configPath), packChecksum: sha(manifestPath) };
}

function scenario(over: Partial<PlaytestScenarioReport> = {}): PlaytestScenarioReport {
  const assertions = over.assertions ?? [{ id: "won", kind: "state" as const, requires: ["won"], result: "pass" as const, observed: true, expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, evidence: [] }];
  return {
    scenarioId: "success-basic", scenarioVersion: 1, required: true, harnessCondition: "none",
    expectedOutcome: "SUCCESS", baselineEligible: true, execution: "executed", terminationReached: true,
    assertions, assertionAggregate: aggregateAssertions(assertions),
    endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 },
    initialState: { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 4, playerX: 40 },
    actions: [], comparableEvents: [], eventCounts: { pickup: 6, win: 1 }, evidence: ["playtest-events"],
    ...over,
  };
}

function report(over: Partial<PlaytestReport> = {}, configChecksum: string, packChecksum: string): PlaytestReport {
  return {
    reportVersion: PLAYTEST_REPORT_VERSION,
    identity: {
      scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION, siteVersion: 1, packId: "g", packVersion: 1,
      packChecksum, configChecksum, shellVersion: "2", harnessVersion: PLAYTEST_HARNESS_VERSION, rulesVersion: PLAYTEST_RULES_VERSION,
    },
    command: "node playtest.mjs", exitCode: 0,
    startedAt: "2026-10-27T00:00:00.000Z", finishedAt: "2026-10-27T00:00:05.000Z",
    execution: "executed", scenarios: [scenario({ outcome: "SUCCESS" })], aggregate: "SUCCESS",
    runtime: { pollIntervalMs: 50, stepDelayMs: 35, scenarioTimeoutMs: 45000, viewport: { w: 1000, h: 600 }, deviceScaleFactor: 1, chromeFlags: [] },
    evidence: ["playtest-events"],
    ...over,
  };
}

const evidence: DeliveryEvidence[] = [
  { ref: "playtest-result", path: "g/run/v1/playtest/v1/result.json" },
  { ref: "playtest-events", path: "g/run/v1/playtest/v1/success-basic/events.jsonl" },
];

describe("writePlaytestToReport（票 08 写回）", () => {
  it("成功写回：只动 check/summary/verdict，QA 层原样保留", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const before = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8"));
    const next = writePlaytestToReport({ outRoot, runDir, report: report({}, configChecksum, packChecksum), evidence });
    expect(next.checks.find((c) => c.key === "playable-smoke")).toMatchObject({ status: "pass", detail: "SUCCESS" });
    expect(next.playtest?.aggregate).toBe("SUCCESS");
    expect(next.verdict).toBe("pass");
    const after = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8"));
    expect(after.checked).toEqual(before.checked);
    expect(after.failures).toEqual(before.failures);
    expect(after.observations).toEqual(before.observations);
    expect(after.delivery.playtest.aggregate).toBe("SUCCESS");
  });

  it("幂等：重复写回不重复堆证据", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const r = report({}, configChecksum, packChecksum);
    writePlaytestToReport({ outRoot, runDir, report: r, evidence });
    const second = writePlaytestToReport({ outRoot, runDir, report: r, evidence });
    expect(second.evidence.filter((e) => e.ref === "playtest-events")).toHaveLength(1);
    expect(second.evidence.filter((e) => e.ref === "playtest-result")).toHaveLength(1);
  });

  it("身份不匹配 ⇒ 拒写，qa-report 不变", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const qaPath = path.join(runDir, "qa-report.json");
    const before = fs.readFileSync(qaPath, "utf8");
    const bad = report({ identity: { ...report({}, configChecksum, packChecksum).identity, siteVersion: 2 } }, configChecksum, packChecksum);
    expect(() => writePlaytestToReport({ outRoot, runDir, report: bad, evidence })).toThrow(/site/);
    expect(fs.readFileSync(qaPath, "utf8")).toBe(before);
  });

  it("config checksum 不匹配 ⇒ 拒写", () => {
    const { outRoot, runDir, packChecksum } = setup();
    const bad = report({}, "sha256:" + "0".repeat(64), packChecksum);
    expect(() => writePlaytestToReport({ outRoot, runDir, report: bad, evidence })).toThrow(/config/);
  });

  it("写回失败留独立诊断记录，不改 result.json", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const missing = [{ ref: "playtest-result", path: "g/run/v1/playtest/missing/result.json" }];
    expect(() => writePlaytestToReport({ outRoot, runDir, report: report({}, configChecksum, packChecksum), evidence: missing })).toThrow(/不存在/);
    const attemptDir = path.join(runDir, "playtest/v1");
    fs.writeFileSync(path.join(attemptDir, "result.json"), "KEEP");
    expect(writePlaytestWritebackError(attemptDir, new Error("boom"), "qa-report.json")).toBe(true);
    expect(fs.readFileSync(path.join(attemptDir, "result.json"), "utf8")).toBe("KEEP");
    expect(JSON.parse(fs.readFileSync(path.join(attemptDir, "writeback-error.json"), "utf8")).message).toBe("boom");
  });

  it("撤销后无新结果 ⇒ blocked（旧 pass 不回来）", () => {
    const { runDir } = setup();
    const r = invalidatePlayableSmoke(runDir, "attempt 进行中");
    expect(r.ok).toBe(true);
    const qa = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8"));
    expect(qa.delivery.playtest).toBeUndefined();
    expect(qa.delivery.checks.find((c: { key: string }) => c.key === "playable-smoke").status).toBe("blocked");
    expect(qa.delivery.verdict).toBe("blocked");
  });

  it("撤销后成功写回恢复 pass", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    invalidatePlayableSmoke(runDir, "attempt 进行中");
    const next = writePlaytestToReport({ outRoot, runDir, report: report({}, configChecksum, packChecksum), evidence });
    expect(next.checks.find((c) => c.key === "playable-smoke")).toMatchObject({ status: "pass", detail: "SUCCESS" });
    expect(next.verdict).toBe("pass");
  });

  it.each([
    ["GAMEPLAY_FAILURE", "fail"],
    ["ENVIRONMENT_FAILURE", "blocked"],
    ["TIMEOUT", "incomplete"],
    ["UNKNOWN", "incomplete"],
  ] as const)("撤销后 %s → playable-smoke=%s", (outcome, expected) => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    invalidatePlayableSmoke(runDir, "attempt 进行中");
    const over = outcome === "UNKNOWN"
      ? { outcome, insufficientEvidence: { ruleId: "fixture", missingObservation: "fixture", affectedAssertionIds: [], explanation: "fixture" } }
      : { outcome };
    const r = report({ scenarios: [scenario(over)], aggregate: outcome }, configChecksum, packChecksum);
    const next = writePlaytestToReport({ outRoot, runDir, report: r, evidence });
    expect(next.checks.find((c) => c.key === "playable-smoke")?.status).toBe(expected);
    expect(next.verdict).toBe(expected === "fail" ? "fail" : expected === "blocked" ? "blocked" : "incomplete");
  });

  it("缺 configChecksum ⇒ 拒写（票 04：带才比不再成立）", () => {
    const { outRoot, runDir, packChecksum } = setup();
    const r = report({}, "sha256:" + "0".repeat(64), packChecksum);
    delete (r.identity as { configChecksum?: string }).configChecksum;
    expect(() => writePlaytestToReport({ outRoot, runDir, report: r, evidence })).toThrow(/configChecksum/);
  });

  it("缺 packChecksum ⇒ 拒写", () => {
    const { outRoot, runDir, configChecksum } = setup();
    const r = report({}, configChecksum, "sha256:" + "0".repeat(64));
    delete (r.identity as { packChecksum?: string }).packChecksum;
    expect(() => writePlaytestToReport({ outRoot, runDir, report: r, evidence })).toThrow(/packChecksum/);
  });

  it("pack checksum 与实际包不一致 ⇒ 拒写", () => {
    const { outRoot, runDir, configChecksum } = setup();
    const r = report({}, configChecksum, "sha256:" + "0".repeat(64));
    expect(() => writePlaytestToReport({ outRoot, runDir, report: r, evidence })).toThrow(/pack 身份/);
  });

  it("harness / rules 与当前常量不一致 ⇒ 拒写", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const oldHarness = report({ identity: { ...report({}, configChecksum, packChecksum).identity, harnessVersion: "playtest-harness/v1" } }, configChecksum, packChecksum);
    expect(() => writePlaytestToReport({ outRoot, runDir, report: oldHarness, evidence })).toThrow(/harnessVersion/);
    const oldRules = report({ identity: { ...report({}, configChecksum, packChecksum).identity, rulesVersion: "playtest-rules/v1" } }, configChecksum, packChecksum);
    expect(() => writePlaytestToReport({ outRoot, runDir, report: oldRules, evidence })).toThrow(/rulesVersion/);
  });

  it("没有 delivery ⇒ 拒写（不伪造）", () => {
    const { outRoot, runDir, configChecksum, packChecksum } = setup();
    const qaPath = path.join(runDir, "qa-report.json");
    const qa = JSON.parse(fs.readFileSync(qaPath, "utf8"));
    delete qa.delivery;
    fs.writeFileSync(qaPath, JSON.stringify(qa) + "\n");
    expect(() => writePlaytestToReport({ outRoot, runDir, report: report({}, configChecksum, packChecksum), evidence })).toThrow(/delivery/);
  });
});
