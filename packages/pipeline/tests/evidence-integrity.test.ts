// 证据完整性校验核心（票 04）的单元测试。
//
// ⚠️ 所有 fixture 都在 `mkdtemp` 里合成，绝不改冻结交付；负向用例只动副本。
// ⚠️ `asset-pack` 的 `verifyPack` 需要一份合法包；这里复用仓库最小的 `fixtures/packs/last-train/v2`（152K），
//   整套测试不需要生成的资源、不需要浏览器、不花钱。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDeliveryReport, PlaytestReportSchema, QA_JUDGEMENTS, QAReportSchema,
  playtestSummaryOf,
} from "@game-maker/contracts";
import { renderVerificationMarkdown, verifyDeliveryEvidence } from "../src/evidence-integrity.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PACK_FIXTURE = path.join(REPO, "fixtures/packs/last-train/v2");
const SHA = (p: string) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const SHA_TEXT = (s: string) => "sha256:" + crypto.createHash("sha256").update(s).digest("hex");
const write = (p: string, content: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
const writeJson = (p: string, value: unknown) => write(p, JSON.stringify(value, null, 2) + "\n");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

const PACK_ID = "last-train";
const PACK_VERSION = 2;
const SITE_VERSION = 1;

type Fixture = {
  dir: string;
  manifestPath: string;
  roots: Record<string, string>;
  subject: { packId: string; packVersion: number; siteVersion: number; shellVersion: string; manifestChecksum: string; configChecksum: string };
  qaPath: string;
  reviewPath: string;
  evidencePath: string;
  siteIndexPath: string;
};

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function walk(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(root, d.name);
    if (d.isDirectory()) return walk(p);
    if (d.isFile()) return [p];
    throw new Error(`unsupported entry: ${p}`);
  });
}

function makePlaytest(identity: Record<string, unknown>, suffix: string): unknown {
  return {
    reportVersion: "playtest-report/v1",
    identity,
    command: "fixture",
    exitCode: 0,
    startedAt: "2026-10-29T00:00:00.000Z",
    finishedAt: "2026-10-29T00:00:01.000Z",
    execution: "executed",
    scenarios: [{
      scenarioId: "fixture-win",
      scenarioVersion: 1,
      required: true,
      harnessCondition: "none",
      expectedOutcome: "SUCCESS",
      baselineEligible: true,
      execution: "executed",
      terminationReached: true,
      assertions: [{
        id: "won", kind: "state", requires: [],
        expect: { kind: "state", path: "won", op: "eq", value: true },
        result: "pass", evidence: ["playtest-scenario"],
      }],
      assertionAggregate: "pass",
      endState: { collected: 1, won: true, hits: 0, chestsOpened: 0, activePickups: 0, playerX: 1 },
      initialState: { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 1, playerX: 1 },
      actions: [],
      outcome: "SUCCESS",
      comparableEvents: ["win"],
      eventCounts: { win: 1, reset: 0, "danger-hit": 0, "runtime-error": 0 },
      evidence: ["playtest-scenario"],
      steps: 10,
      durationMs: 1000,
    }],
    aggregate: "SUCCESS",
    runtime: {
      pollIntervalMs: 10, stepDelayMs: 10, scenarioTimeoutMs: 1000,
      viewport: { w: 480, h: 270 }, deviceScaleFactor: 1, chromeFlags: [],
    },
    evidence: ["playtest-result", "playtest-scenario"],
  };
}

function buildFixture(): Fixture {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-integrity-"));
  dirs.push(dir);
  const roots = {
    out: path.join(dir, "out"),
    fa04: path.join(dir, "fa04"),
    fa05: path.join(dir, "fa05"),
    fa06: path.join(dir, "fa06"),
    gp: path.join(dir, "gp"),
    artifacts: path.join(dir, "artifacts"),
  };
  const packDir = path.join(roots.out, PACK_ID, "pack", `v${PACK_VERSION}`);
  fs.cpSync(PACK_FIXTURE, packDir, { recursive: true });
  const manifestChecksum = SHA(path.join(packDir, "manifest.json"));
  const runDir = path.join(roots.out, PACK_ID, "run", "v1");
  const configText = JSON.stringify({ format: "fixture-config", level: { id: "x" } }, null, 2) + "\n";
  write(path.join(runDir, "game-config.json"), configText);
  const configChecksum = SHA(path.join(runDir, "game-config.json"));
  const siteDir = path.join(roots.out, PACK_ID, "site", `v${SITE_VERSION}`);
  write(path.join(siteDir, "index.html"), "<html>fixture</html>");
  write(path.join(siteDir, "shell.js"), "// fixture shell\n");
  writeJson(path.join(siteDir, "site.json"), { shell: "2", pack: `v${PACK_VERSION}`, config: "game-config.json" });
  write(path.join(siteDir, "game-config.json"), configText);
  const siteHashes = Object.fromEntries(["index.html", "shell.js", "site.json", "game-config.json"]
    .map((n) => [n, SHA(path.join(siteDir, n))]));

  const subject = {
    packId: PACK_ID, packVersion: PACK_VERSION, siteVersion: SITE_VERSION, shellVersion: "2",
    manifestChecksum, configChecksum,
  };
  const identity = {
    scenarioFormatVersion: "playtest-scenario/v1", siteVersion: SITE_VERSION,
    packId: PACK_ID, packVersion: PACK_VERSION, packChecksum: manifestChecksum, configChecksum,
    shellVersion: "2", harnessVersion: "playtest-harness/v2", rulesVersion: "playtest-rules/v2",
  };
  const playtest = makePlaytest(identity, "delivery");
  PlaytestReportSchema.parse(playtest);
  writeJson(path.join(runDir, "playtest", "v2", "result.json"), playtest);
  writeJson(path.join(runDir, "playtest", "v2", "site-integrity.json"), { before: siteHashes, after: siteHashes, unchanged: true });
  write(path.join(runDir, "playtest", "v2", "acceptance-win", "events.jsonl"), '{"type":"win"}\n');
  const summary = playtestSummaryOf(
    PlaytestReportSchema.parse(playtest),
    `${PACK_ID}/run/v1/playtest/v2/result.json`,
  );
  const delivery = buildDeliveryReport({
    runId: `${PACK_ID}/run/v1`,
    pack: { packId: PACK_ID, packVersion: PACK_VERSION, manifestChecksum },
    config: { file: `${PACK_ID}/run/v1/game-config.json` },
    site: { version: SITE_VERSION, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass", detail: "SUCCESS" },
      { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass" },
    playtest: summary,
    evidence: [
      { ref: "playtest-result", path: `${PACK_ID}/run/v1/playtest/v2/result.json` },
      { ref: "playtest-scenario", path: `${PACK_ID}/run/v1/playtest/v2/acceptance-win/events.jsonl` },
    ],
  });
  const qa = QAReportSchema.parse({
    format: "qa-report/v1",
    subject: { packId: PACK_ID, packVersion: PACK_VERSION, manifestChecksum },
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "fixture" },
    ],
    delivery,
  });
  const qaPath = path.join(runDir, "qa-report.json");
  writeJson(qaPath, qa);

  // 机制覆盖报告 v2（P0-02 v2 票 08）：默认全绿；负向用例再逐项破坏。
  const coveragePath = path.join(runDir, "mechanic-coverage.json");
  const coverage = {
    format: "mechanic-coverage/v2",
    subject,
    mechanics: [],
    probe: { executed: true, ranAt: "2026-10-29T00:00:00.000Z", summaryPath: "mechanic-probe/summary.json", results: [] },
    verdict: "satisfied",
  };
  writeJson(coveragePath, coverage);

  // FA-04 / FA-05 / FA-06 / 06 / 09 记录
  const reviewPath = path.join(roots.fa04, "review-record.json");
  writeJson(reviewPath, {
    format: "fixture", overall: "pass", items: [{ id: "overall", verdict: "pass" }],
    subject, materials: { reference: [], deliveredAssets: [], runningScreenshots: [] },
  });
  writeJson(path.join(roots.fa04, "capture.json"), { format: "fixture", subject, siteIntegrity: { before: siteHashes, after: siteHashes, unchanged: true }, shots: [] });
  writeJson(path.join(roots.fa04, "materials.json"), { format: "fixture", subject, materials: { reference: [], deliveredAssets: [], visualContext: [] }, generated: [] });

  const evidencePath = path.join(roots.fa05, "evidence.json");
  writeJson(evidencePath, {
    format: "fixture", subject,
    files: [{ path: qaPath, bytes: fs.statSync(qaPath).size, sha256: SHA(qaPath) }],
    checks: delivery.checks, verdict: "pass",
  });
  writeJson(path.join(roots.fa05, "consistency.json"), { format: "fixture", subject: { reportSha256: SHA(qaPath) }, checks: [] });
  writeJson(path.join(roots.fa06, "regression.json"), { format: "fixture", commands: [] });

  for (const n of [1, 2]) {
    const base = path.join(roots.gp, `06-attempt-${n}`, "attempt-v1");
    writeJson(path.join(base, "result.json"), makePlaytest(identity, `attempt-${n}`));
    writeJson(path.join(base, "site-integrity.json"), { before: siteHashes, after: siteHashes, unchanged: true });
  }
  writeJson(path.join(roots.gp, "09-review-record.supplement.json"), {
    format: "fixture", overall: "pass", items: [{ id: "a", verdict: "pass" }], problems: [],
    subject, constraints: { historicalRecordHashes: { "review-record.json": SHA(reviewPath) } },
  });
  writeJson(path.join(roots.gp, "09-review-materials.json"), {
    format: "fixture", subject: {
      ...subject,
      siteHashes: { manifest: manifestChecksum, config: configChecksum, index: siteHashes["index.html"], shell: siteHashes["shell.js"], siteJson: siteHashes["site.json"] },
    },
  });

  writeJson(path.join(roots.artifacts, "identity.json"), {
    format: "fixture",
    identity: {
      packId: PACK_ID, packVersion: PACK_VERSION, siteVersion: SITE_VERSION, shellVersion: "2",
      manifestFileSha256: manifestChecksum, siteConfigSha256: configChecksum, runConfigSha256: configChecksum,
    },
  });

  // 清单：把所有文件登记为 required（负向测试再逐项破坏）
  const files = Object.entries(roots).flatMap(([root, abs]) =>
    walk(abs).map((p) => ({
      root, path: path.relative(abs, p).split(path.sep).join("/"), role: "fixture", required: true,
      bytes: fs.statSync(p).size, sha256: SHA(p),
    })),
  ).sort((a, b) => (a.root === b.root ? a.path.localeCompare(b.path) : a.root.localeCompare(b.root)));

  const records = [
    { root: "out", path: `${PACK_ID}/run/v1/qa-report.json`, role: "qa-report", required: true, identity: true },
    { root: "out", path: `${PACK_ID}/run/v1/playtest/v2/result.json`, role: "playtest-result", required: true, identity: true },
    { root: "gp", path: "06-attempt-1/attempt-v1/result.json", role: "playtest-attempt", required: true, identity: true },
    { root: "gp", path: "06-attempt-2/attempt-v1/result.json", role: "playtest-attempt", required: true, identity: true },
    { root: "fa04", path: "review-record.json", role: "visual-review", required: true, identity: true },
    { root: "fa04", path: "capture.json", role: "visual-capture", required: true, identity: true },
    { root: "fa04", path: "materials.json", role: "visual-materials", required: true, identity: true },
    { root: "fa05", path: "evidence.json", role: "acceptance-evidence", required: true, identity: true },
    { root: "fa05", path: "consistency.json", role: "acceptance-consistency", required: true, identity: false },
    { root: "fa06", path: "regression.json", role: "regression", required: true, identity: false },
    { root: "gp", path: "09-review-record.supplement.json", role: "visual-supplement", required: true, identity: true },
    { root: "gp", path: "09-review-materials.json", role: "visual-supplement-materials", required: true, identity: true },
    { root: "artifacts", path: "identity.json", role: "identity", required: true, identity: true },
    { root: "out", path: `${PACK_ID}/run/v1/mechanic-coverage.json`, role: "mechanic-coverage", required: true, identity: true },
  ];

  const manifestPath = path.join(dir, "manifest", "expected-hashes.json");
  writeJson(manifestPath, {
    format: "delivery-evidence-manifest/v1",
    generatedAt: "2026-10-29T00:00:00.000Z",
    subject,
    roots: Object.fromEntries(Object.entries(roots).map(([k, abs]) => [k, path.relative(path.dirname(manifestPath), abs).split(path.sep).join("/")])),
    files,
    records,
  });

  return { dir, manifestPath, roots, subject, qaPath, reviewPath, evidencePath, siteIndexPath: path.join(siteDir, "index.html") };
}

/** 改了记录但希望文件哈希仍通过时，同步清单里该文件的期望值。 */
function rehash(fx: Fixture, absPath: string): void {
  const m = readJson(fx.manifestPath);
  for (const [root, abs] of Object.entries(fx.roots)) {
    const rel = path.relative(abs, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    const entry = m.files.find((f: { root: string; path: string }) => f.root === root && f.path === rel.split(path.sep).join("/"));
    if (entry !== undefined) {
      entry.sha256 = SHA(absPath);
      entry.bytes = fs.statSync(absPath).size;
    }
  }
  writeJson(fx.manifestPath, m);
}

function addManifestEntry(fx: Fixture, entry: { root: string; path: string; required?: boolean; sha256?: string; bytes?: number; role?: string }): void {
  const m = readJson(fx.manifestPath);
  m.files.push({
    root: entry.root, path: entry.path, role: entry.role ?? "fixture",
    required: entry.required ?? true, bytes: entry.bytes ?? 0,
    sha256: entry.sha256 ?? "sha256:" + "0".repeat(64),
  });
  writeJson(fx.manifestPath, m);
}

function treeHashes(root: string): Record<string, string> {
  return Object.fromEntries(walk(root).map((p) => [path.relative(root, p).split(path.sep).join("/"), SHA(p)]).sort());
}

describe("verifyDeliveryEvidence", () => {
  it("完整未变化的证据 → pass，六项声明与重算一致", () => {
    const fx = buildFixture();
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("pass");
    expect(report.exitCode).toBe(0);
    expect(report.declared.verdict).toBe("pass");
    expect(report.recomputed.verdict).toBe("pass");
    expect(report.comparison.checks.every((c) => c.match)).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.results.identities.every((i) => i.status === "verified")).toBe(true);
    expect(renderVerificationMarkdown(report)).toContain("结论：**pass**");
  });

  it("失败重跑撤销后：playable-smoke 声明 blocked 与重算一致", () => {
    const fx = buildFixture();
    const qaPath = fx.qaPath;
    const qa = readJson(qaPath);
    delete qa.delivery.playtest;
    qa.delivery.checks = qa.delivery.checks.map((c: { key: string; status: string; detail?: string }) =>
      c.key === "playable-smoke" ? { key: c.key, status: "blocked", detail: "attempt 进行中" } : c);
    qa.delivery.verdict = "blocked";
    writeJson(qaPath, qa);
    rehash(fx, qaPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    const smoke = report.comparison.checks.find((c) => c.key === "playable-smoke")!;
    expect(smoke.declared).toBe("blocked");
    expect(smoke.recomputed).toBe("blocked");
    expect(smoke.match).toBe(true);
    expect(report.recomputed.verdict).toBe("blocked");
  });

  it("机制覆盖报告 probe.executed=false → fail（即使哈希已同步）", () => {
    const fx = buildFixture();
    const p = path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "mechanic-coverage.json");
    const c = readJson(p);
    c.probe.executed = false;
    writeJson(p, c);
    rehash(fx, p);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.consistency.some((x) => x.id === "mechanic-coverage" && x.status === "fail")).toBe(true);
  });

  it("机制覆盖报告 verdict=failed → fail", () => {
    const fx = buildFixture();
    const p = path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "mechanic-coverage.json");
    const c = readJson(p);
    c.verdict = "failed";
    writeJson(p, c);
    rehash(fx, p);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.rule === "mechanic-coverage.fail")).toBe(true);
  });

  it("机制覆盖报告 subject 与清单不符 → fail", () => {
    const fx = buildFixture();
    const p = path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "mechanic-coverage.json");
    const c = readJson(p);
    c.subject.configChecksum = "sha256:" + "f".repeat(64);
    writeJson(p, c);
    rehash(fx, p);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.rule === "mechanic-coverage.fail")).toBe(true);
  });

  it("内容篡改 → hash-mismatch / fail", () => {
    const fx = buildFixture();
    write(fx.siteIndexPath, "<html>tampered</html>");
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    const hit = report.results.files.find((f) => f.path.endsWith("index.html"));
    expect(hit?.status).toBe("hash-mismatch");
  });

  it("必需文件缺失 → missing / blocked", () => {
    const fx = buildFixture();
    fs.rmSync(path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "game-config.json"));
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("blocked");
    const hit = report.results.files.find((f) => f.path.endsWith("run/v1/game-config.json"));
    expect(hit?.status).toBe("missing");
  });

  it("身份不符 → mismatch / fail", () => {
    const fx = buildFixture();
    const record = readJson(fx.reviewPath);
    record.subject.packVersion = 99;
    writeJson(fx.reviewPath, record);
    rehash(fx, fx.reviewPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    const hit = report.results.identities.find((i) => i.record === "fa04:review-record.json");
    expect(hit?.status).toBe("mismatch");
  });

  it("身份字段缺失 → missing / blocked（不静默跳过）", () => {
    const fx = buildFixture();
    const record = readJson(fx.reviewPath);
    delete record.subject;
    writeJson(fx.reviewPath, record);
    rehash(fx, fx.reviewPath);
    // 补审记录里的历史哈希也跟着更新，避免把「身份缺失」与「三方矛盾」混在同一个用例里。
    const supPath = path.join(fx.roots["gp"]!, "09-review-record.supplement.json");
    const sup = readJson(supPath);
    sup.constraints.historicalRecordHashes["review-record.json"] = SHA(fx.reviewPath);
    writeJson(supPath, sup);
    rehash(fx, supPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("blocked");
    const hit = report.results.identities.find((i) => i.record === "fa04:review-record.json");
    expect(hit?.status).toBe("missing");
  });

  it("三方哈希矛盾 → consistency fail / 最终 fail", () => {
    const fx = buildFixture();
    const ev = readJson(fx.evidencePath);
    ev.files[0].sha256 = "sha256:" + "0".repeat(64);
    writeJson(fx.evidencePath, ev);
    rehash(fx, fx.evidencePath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.consistency.some((c) => c.id === "evidence.self-hash" && c.status === "fail")).toBe(true);
  });

  it("声明与重算 verdict 不一致 → fail", () => {
    const fx = buildFixture();
    const qa = readJson(fx.qaPath);
    qa.delivery.checks.find((c: { key: string }) => c.key === "qa").status = "incomplete";
    qa.delivery.verdict = "incomplete";
    writeJson(fx.qaPath, qa);
    rehash(fx, fx.qaPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.comparison.checks.find((c) => c.key === "qa")?.match).toBe(false);
  });

  it("路径逃逸 → path-invalid / fail", () => {
    const fx = buildFixture();
    const m = readJson(fx.manifestPath);
    m.files.push({ root: "out", path: "../escape.txt", role: "fixture", required: true, sha256: "sha256:" + "0".repeat(64) });
    writeJson(fx.manifestPath, m);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.files.find((f) => f.path === "../escape.txt")?.status).toBe("path-invalid");
  });

  it("不可读（目录冒充文件）→ unreadable / blocked", () => {
    const fx = buildFixture();
    fs.rmSync(fx.siteIndexPath);
    fs.mkdirSync(fx.siteIndexPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("blocked");
    expect(report.results.files.find((f) => f.path.endsWith("/site/v1/index.html"))?.status).toBe("unreadable");
  });

  it("指向 root 外的符号链接 → path-invalid / fail", () => {
    const fx = buildFixture();
    const outside = path.join(fx.dir, "outside.json");
    write(outside, "{}\n");
    const link = path.join(fx.roots["out"]!, "escape.json");
    fs.symlinkSync(outside, link);
    addManifestEntry(fx, { root: "out", path: "escape.json" });
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.files.find((f) => f.path === "escape.json")?.status).toBe("path-invalid");
  });

  it("悬空符号链接 → path-invalid / fail", () => {
    const fx = buildFixture();
    const link = path.join(fx.roots["out"]!, "dangling.json");
    fs.symlinkSync(path.join(fx.roots["out"]!, "nope.json"), link);
    addManifestEntry(fx, { root: "out", path: "dangling.json" });
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.files.find((f) => f.path === "dangling.json")?.status).toBe("path-invalid");
  });

  it("root 内合法符号链接 → verified（不误伤）", () => {
    const fx = buildFixture();
    const target = path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "game-config.json");
    const link = path.join(fx.roots["out"]!, "inside-link.json");
    fs.symlinkSync(target, link);
    addManifestEntry(fx, { root: "out", path: "inside-link.json", sha256: SHA(target), bytes: fs.statSync(target).size });
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.results.files.find((f) => f.path === "inside-link.json")?.status).toBe("verified");
  });

  it("绝对路径引用 → path-invalid / fail", () => {
    const fx = buildFixture();
    const abs = path.join(fx.roots["out"]!, PACK_ID, "run", "v1", "game-config.json");
    addManifestEntry(fx, { root: "out", path: abs, sha256: SHA(abs), bytes: fs.statSync(abs).size });
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.files.find((f) => f.path === abs)?.status).toBe("path-invalid");
  });

  it("报告引用错 attempt → reference-invalid / fail", () => {
    const fx = buildFixture();
    const qa = readJson(fx.qaPath);
    qa.delivery.playtest.report = `${PACK_ID}/run/v1/playtest/v1/result.json`;
    qa.delivery.evidence.find((e: { ref: string }) => e.ref === "playtest-result").path = qa.delivery.playtest.report;
    writeJson(fx.qaPath, qa);
    rehash(fx, fx.qaPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.consistency.some((c) => c.id === "references.report" && c.status === "fail")).toBe(true);
  });

  it("审核材料集合不一致 → fail", () => {
    const fx = buildFixture();
    const record = readJson(fx.reviewPath);
    record.materials.runningScreenshots = ["shots/missing.png"];
    writeJson(fx.reviewPath, record);
    rehash(fx, fx.reviewPath);
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.status).toBe("fail");
    expect(report.results.consistency.some((c) => c.id === "visual.materials.collection" && c.status === "fail")).toBe(true);
  });

  it("结论过期：声明 pass，当前必需证据失效 → 不再 pass", () => {
    const fx = buildFixture();
    fs.rmSync(path.join(fx.roots["out"]!, PACK_ID, "site", `v${SITE_VERSION}`, "index.html"));
    const report = verifyDeliveryEvidence(fx.manifestPath);
    expect(report.declared.verdict).toBe("pass");
    expect(report.status).not.toBe("pass");
    expect(report.recomputed.verdict).not.toBe("pass");
  });

  it("只读性：校验前后 fixture 全量哈希不变", () => {
    const fx = buildFixture();
    const before = treeHashes(fx.dir);
    verifyDeliveryEvidence(fx.manifestPath);
    expect(treeHashes(fx.dir)).toEqual(before);
  });

  it("重复执行结果一致（除 generatedAt）", () => {
    const fx = buildFixture();
    const a = verifyDeliveryEvidence(fx.manifestPath);
    const b = verifyDeliveryEvidence(fx.manifestPath);
    const strip = (r: { generatedAt?: string }) => { const x = { ...r }; delete x.generatedAt; return x; };
    expect(strip(a)).toEqual(strip(b));
  });
});
