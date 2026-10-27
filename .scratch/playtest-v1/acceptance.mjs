// 阶段C 真实产物验收（Playtest V1 · 票 09）—— 零付费、历史产物只读。
//
// 三块：① 真实产物链路（本地 Chrome、正式 attempt、写回沙箱 qa-report）；
// ② 归因/交付一致性（check / delivery.playtest / verdict / 证据 / 身份）；
// ③ 离线五态 + 准备拒绝测试 + 旧报告兼容 + 基线观察。
//
// 运行：node .scratch/playtest-v1/acceptance.mjs（前置 pnpm build）
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const {
  QAReportSchema, PlaytestReportSchema, PlaytestBaselineCoverageSchema,
  mapPlaytest, playtestSummaryOf, comparePlaytestToBaseline, deliveryVerdictOf, qaVerdict,
} = await import(path.join(ROOT, "packages/contracts/dist/index.js"));
const { promotePlaytestBaseline } = await import(path.join(ROOT, "packages/pipeline/dist/index.js"));
const { findChrome } = await import(path.join(ROOT, "packages/demo/probe/probe-harness.mjs"));

const DATE = "2026-10-27";
const OUT = path.join(ROOT, `.scratch/playtest-v1/runs/${DATE}-acceptance`);
const SANDBOX = path.join(OUT, "artifacts", "wasteland-scavenger-recipe");
const HIST = path.join(ROOT, ".scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe");
const HIST_SITE = path.join(HIST, "site/v1");
const HIST_PACK = path.join(HIST, "pack/v1");
const LEGACY = path.join(ROOT, ".scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json");
const CLI = path.join(ROOT, "packages/cli/dist/cli.mjs");
const EVIDENCE_V2 = path.join(ROOT, ".scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v2/result.json");
const EVIDENCE_V3 = path.join(ROOT, ".scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v3/result.json");

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const sha = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const exists = (p) => fs.existsSync(p);

function run(name, cmd, args, logFile, env = {}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(logFile, `${cmd} ${args.join(" ")}\n\n${r.stdout ?? ""}\n${r.stderr ?? ""}\n`);
  return { name, command: `${cmd} ${args.join(" ")}`, exitCode: r.status ?? 1, durationMs: Date.now() - t0, stdout: r.stdout ?? "", stderr: r.stderr ?? "", log: rel(logFile) };
}

function setupSandbox() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const runDir = path.join(SANDBOX, "run/v1");
  fs.mkdirSync(runDir, { recursive: true });
  // 真实交付态的 qa-report（有 delivery、无 delivery.playtest）+ 历史 run config
  fs.copyFileSync(LEGACY, path.join(runDir, "qa-report.json"));
  fs.copyFileSync(path.join(HIST, "run/v1/game-config.json"), path.join(runDir, "game-config.json"));
  for (const kind of ["pack", "site"]) {
    const parent = path.join(SANDBOX, kind);
    fs.mkdirSync(parent, { recursive: true });
    const target = path.relative(parent, path.join(HIST, kind, "v1"));
    fs.symlinkSync(target, path.join(parent, "v1"));
  }
  return { runDir, outRoot: path.join(OUT, "artifacts") };
}

function historicalHashes() {
  const files = [LEGACY, path.join(HIST_SITE, "index.html"), path.join(HIST_SITE, "shell.js"), path.join(HIST_SITE, "site.json"), path.join(HIST_PACK, "manifest.json")];
  return Object.fromEntries(files.map((p) => [rel(p), sha(p)]));
}

function main() {
  const startedAt = new Date().toISOString();
  if (!exists(CLI)) {
    console.error(`❌ 找不到 ${rel(CLI)} —— 先 pnpm build`);
    process.exit(4);
  }
  fs.mkdirSync(OUT, { recursive: true });
  let chrome = "missing"; let chromePath;
  try { chromePath = findChrome(); chrome = "found"; } catch { /* 真实执行未验收 */ }

  const before = historicalHashes();
  const { runDir, outRoot } = setupSandbox();

  // 基线观察：从已归档的两次干净运行晋升到**临时**目录（不写 fixtures/）
  const baselineDir = path.join(OUT, "baselines");
  let baselinePromoted = false; let baselineReason;
  try {
    const coverage = PlaytestBaselineCoverageSchema.parse({ assertions: ["initial-pickups"], endState: ["collected"], events: ["pickup"] });
    writeJson(path.join(OUT, "coverage.json"), coverage);
    if (!exists(EVIDENCE_V2) || !exists(EVIDENCE_V3)) throw new Error("缺少两次干净运行的归档证据（ticket-08 e2e-evidence v2/v3）");
    promotePlaytestBaseline({
      baselineDir, baselineId: "success-basic", scenarioId: "success-basic",
      reportPaths: [EVIDENCE_V2, EVIDENCE_V3], coverage, reason: "acceptance：观察基线比较，不改交付状态",
      promotedBy: "acceptance", replace: true,
    });
    baselinePromoted = true;
  } catch (e) { baselineReason = e instanceof Error ? e.message : String(e); }

  const offline = run("offline-five-states", "pnpm", [
    "exec", "vitest", "run",
    "packages/contracts/tests/playtest-attribution.test.ts",
    "packages/contracts/tests/playtest-baseline.test.ts",
    "packages/contracts/tests/playtest.test.ts",
    "packages/pipeline/tests/playtest.test.ts",
    "packages/pipeline/tests/playtest-baseline.test.ts",
    "packages/demo/probe/playtest/tests",
  ], path.join(OUT, "offline.log"));

  const real = run("real-playtest", process.execPath, [
    CLI, "playtest", runDir, "--out", outRoot, "--json",
  ], path.join(OUT, "real-playtest.log"), baselinePromoted ? { PLAYTEST_BASELINE_DIR: baselineDir } : {});

  const qaPath = path.join(runDir, "qa-report.json");
  const qa = QAReportSchema.parse(readJson(qaPath));
  const delivery = qa.delivery;
  const playtestRoot = path.join(runDir, "playtest");
  const attempts = exists(playtestRoot) ? fs.readdirSync(playtestRoot).filter((n) => /^v\d+$/.test(n)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))) : [];
  const attempt = attempts.at(-1);
  const attemptDir = attempt === undefined ? undefined : path.join(playtestRoot, attempt);
  const resultPath = attemptDir === undefined ? undefined : path.join(attemptDir, "result.json");
  const report = resultPath !== undefined && exists(resultPath) ? PlaytestReportSchema.parse(readJson(resultPath)) : undefined;
  const scenario = report?.scenarios[0];
  const scenarioDir = attemptDir !== undefined && scenario !== undefined ? path.join(attemptDir, scenario.scenarioId) : undefined;
  const events = scenarioDir !== undefined && exists(path.join(scenarioDir, "events.jsonl"))
    ? fs.readFileSync(path.join(scenarioDir, "events.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const sceneReadyObserved = events.some((e) => e.type === "scene-ready");
  const gameExecutionReached = sceneReadyObserved && events.some((e) => e.type === "spawn") && (scenario?.steps ?? 0) > 0;
  const executionEvidence = scenarioDir === undefined ? [] : ["events.jsonl", "trace.jsonl"].map((f) => rel(path.join(scenarioDir, f))).filter(exists);

  const check = delivery?.checks.find((c) => c.key === "playable-smoke");
  const mapped = delivery?.playtest === undefined ? undefined : mapPlaytest(delivery.playtest);
  const evidenceRefsResolve = delivery?.playtest === undefined ? false : (() => {
    const refs = new Set(delivery.evidence.map((e) => e.ref));
    const used = [...delivery.playtest.evidence, ...delivery.playtest.scenarios.flatMap((s) => s.evidence)];
    return used.every((r) => refs.has(r)) && delivery.evidence.filter((e) => e.ref.startsWith("playtest-")).every((e) => exists(path.join(outRoot, e.path)));
  })();
  const requiredScenariosComplete = delivery?.playtest === undefined ? false :
    delivery.playtest.scenarios.filter((s) => s.required).every((s) => s.execution === "executed");

  // 旧报告兼容：有 delivery、无 delivery.playtest；只读解析，不升级
  let legacy = { path: rel(LEGACY), parsed: false, hasPlaytestSummary: false, upgradedToNewEvidence: false };
  try {
    const old = QAReportSchema.parse(readJson(LEGACY));
    legacy.parsed = true;
    legacy.hasPlaytestSummary = old.delivery?.playtest !== undefined;
    legacy.oldPlayableSmoke = old.delivery?.checks.find((c) => c.key === "playable-smoke")?.status ?? null;
    legacy.qaVerdict = qaVerdict(old);
  } catch { /* parsed false */ }

  const after = historicalHashes();
  const historicalMutated = JSON.stringify(before) !== JSON.stringify(after);

  const baselineObservational = (() => {
    const b = delivery?.playtest?.baseline;
    if (!baselinePromoted) return { promoted: false, reason: baselineReason ?? "未晋升", statusUnchanged: null, verdictUnchanged: null };
    return {
      promoted: true,
      result: b?.result ?? "absent",
      statusUnchanged: mapped !== undefined && check?.status === mapped.status,
      verdictUnchanged: delivery !== undefined && deliveryVerdictOf(delivery.checks) === delivery.verdict,
    };
  })();

  const attributionDelivery = {
    checkStatusMatches: mapped !== undefined && check?.status === mapped.status && check?.detail === mapped.detail,
    summaryConsistent: report !== undefined && delivery?.playtest !== undefined && resultPath !== undefined
      ? isDeepStrictEqual(playtestSummaryOf(report, path.relative(outRoot, resultPath).split(path.sep).join("/")), delivery.playtest)
      : false,
    verdictMatches: delivery !== undefined && deliveryVerdictOf(delivery.checks) === delivery.verdict,
    identityMatches: report !== undefined && delivery !== undefined && delivery.site !== undefined &&
      report.identity.packId === delivery.pack.packId && report.identity.packVersion === delivery.pack.packVersion &&
      report.identity.siteVersion === delivery.site.version && report.identity.shellVersion === delivery.site.shell,
  };

  const checks = {
    realPlaytest: {
      command: real.command, exitCode: real.exitCode, attempt: attempt === undefined ? null : rel(attemptDir),
      reportVersion: report?.reportVersion ?? null, execution: report?.execution ?? null, aggregate: report?.aggregate ?? null,
      checkStatus: check?.status ?? null, detail: check?.detail ?? null,
      requiredScenariosComplete, evidenceRefsResolve, deliveryVerdict: delivery?.verdict ?? null,
      gameExecutionReached, sceneReadyObserved, executionEvidence,
    },
    attributionDelivery,
    offlineFiveStates: { command: offline.command, exitCode: offline.exitCode, covered: ["SUCCESS", "GAMEPLAY_FAILURE", "ENVIRONMENT_FAILURE", "AGENT_LIMITATION", "TIMEOUT", "UNKNOWN", "not-executed"], passed: offline.exitCode === 0 },
    legacyReport: legacy,
    baselineObservational,
  };

  const incompleteReasons = [];
  if (chrome === "missing") incompleteReasons.push("Chrome 缺失：真实游戏执行未验收");
  else if (!gameExecutionReached) incompleteReasons.push("未能证明真实游戏执行（scene-ready/spawn/steps 证据不足）");

  let verdict;
  const chainDefect = !attributionDelivery.checkStatusMatches || !attributionDelivery.summaryConsistent ||
    !attributionDelivery.verdictMatches || !attributionDelivery.identityMatches ||
    !checks.realPlaytest.evidenceRefsResolve || !legacy.parsed || legacy.hasPlaytestSummary ||
    historicalMutated || offline.exitCode !== 0;
  if (chainDefect) verdict = "fail";
  else if (chrome === "missing" || !gameExecutionReached) verdict = "incomplete";
  else verdict = "pass";

  const acceptance = {
    acceptanceVersion: "playtest-acceptance/v1",
    verdict,
    startedAt, finishedAt: new Date().toISOString(),
    source: {
      historicalRun: rel(HIST), sandbox: rel(SANDBOX), historicalMutated,
      legacyReport: rel(LEGACY),
    },
    environment: { chrome, ...(chromePath === undefined ? {} : { chromePath }), node: process.version, platform: process.platform },
    checks,
    incompleteReasons,
    artifacts: [
      { ref: "acceptance", path: rel(path.join(OUT, "acceptance.json")) },
      ...(resultPath === undefined ? [] : [{ ref: "playtest-result", path: rel(resultPath) }]),
      ...(scenarioDir === undefined ? [] : executionEvidence.map((p) => ({ ref: "execution-evidence", path: p }))),
      { ref: "qa-report", path: rel(qaPath) },
    ],
  };
  writeJson(path.join(OUT, "acceptance.json"), acceptance);

  console.log(`\nPlaytest V1 acceptance · ${verdict}`);
  console.log(`  Chrome: ${chrome} · 真实执行: ${gameExecutionReached ? "已证实" : "未证实"}`);
  console.log(`  真实试玩: exit=${real.exitCode} · outcome=${acceptance.checks.realPlaytest.aggregate} · check=${acceptance.checks.realPlaytest.checkStatus} · verdict=${acceptance.checks.realPlaytest.deliveryVerdict}`);
  console.log(`  归因/交付一致性: ${JSON.stringify(attributionDelivery)}`);
  console.log(`  离线五态: exit=${offline.exitCode} · 旧报告: parsed=${legacy.parsed} hasPlaytest=${legacy.hasPlaytestSummary}`);
  console.log(`  基线观察: ${JSON.stringify(baselineObservational)}`);
  if (incompleteReasons.length) console.log(`  未完成原因: ${incompleteReasons.join("；")}`);
  console.log(`  证据: ${rel(path.join(OUT, "acceptance.json"))}`);
  process.exitCode = verdict === "pass" ? 0 : 1;
}

try { main(); }
catch (e) {
  console.error(`❌ acceptance 失败：${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exitCode = 4;
}
