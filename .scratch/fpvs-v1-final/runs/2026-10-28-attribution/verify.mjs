#!/usr/bin/env node
// FA-03 归因复核（只读）—— 独立重算 FA-02 的通关证据链，并用**真实归因器** `attribute()` 复核 outcome。
//
// ⚠️ 只读：不跑浏览器、不写 work/artifacts、不调用付费上游。唯一写入是本目录的 attribution.json。
// ⚠️ 不是第二套判定：五态结论由 `packages/contracts` 的 `attribute()` 给出；本脚本只负责
//   「从持久化证据重建归因输入」并逐项核对 result.json 的声明。归因输入的构造逐字镜像
//   `packages/cli/src/playtest.ts` 的 `attributionEvidence()`（该函数不导出，故此处重写并标注）。
// 用法：node .scratch/fpvs-v1-final/runs/2026-10-28-attribution/verify.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const EFFORT = path.join(ROOT, ".scratch/fpvs-v1-final");
const WORK = path.join(EFFORT, "work/wasteland-scavenger-recipe");
const RUN = path.join(WORK, "run/v1");
const ATTEMPT = path.join(RUN, "playtest/v2");
const SCEN_DIR = path.join(ATTEMPT, "acceptance-win-wasteland-v1");
const ART = path.join(EFFORT, "artifacts");
const SNAPSHOT = path.join(ART, "wasteland-scavenger-recipe");

const { attribute, mapPlaytest } = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const readJsonl = (p) => fs.readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const exists = (p) => fs.existsSync(p);

const checks = [];
function check(id, fn) {
  try {
    const value = fn();
    checks.push({ id, pass: value?.pass !== false, ...(value ?? {}) });
  } catch (e) {
    checks.push({ id, pass: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// ── 输入 ────────────────────────────────────────────────────────────────────
const result = readJson(path.join(ATTEMPT, "result.json"));
const report = readJson(path.join(RUN, "qa-report.json"));
const identity = readJson(path.join(ART, "identity.json"));
const hashes = readJson(path.join(ART, "hashes.json"));
const scenarioFile = readJson(path.join(EFFORT, "scenarios/acceptance/acceptance-win-wasteland-v1.json"));
const scenario = result.scenarios[0];
const events = readJsonl(path.join(SCEN_DIR, "events.jsonl"));
const input = readJsonl(path.join(SCEN_DIR, "input.jsonl"));
const trace = readJsonl(path.join(SCEN_DIR, "trace.jsonl"));
const siteIntegrity = readJson(path.join(ATTEMPT, "site-integrity.json"));
const setup = readJson(path.join(SCEN_DIR, "setup.json"));
const consoleLog = readJson(path.join(SCEN_DIR, "console.json"));
const exceptions = readJson(path.join(SCEN_DIR, "exceptions.json"));
const manifest = readJson(path.join(WORK, "pack/v1/manifest.json"));

const counts = {};
for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
const first = trace[0];
const last = trace.at(-1);

// 几何来自**包自己的 manifest**（anchor 0.5/1 = 脚底锚点），不写死关卡坐标。
const assetOf = (id) => manifest.assets.find((a) => a.id === id);
const playerSize = assetOf("scavenger-hero").size;
const hazardSize = assetOf("wasteland-patroller").size;
const boxOf = (x, y, size) => ({ left: x - size.w / 2, right: x + size.w / 2, top: y - size.h, bottom: y });

// ── 1. 身份 ─────────────────────────────────────────────────────────────────
check("identity.three-way", () => {
  const id = result.identity;
  const want = identity.identity;
  const same =
    id.packId === want.packId && id.packVersion === want.packVersion &&
    id.siteVersion === want.siteVersion && id.shellVersion === want.shellVersion &&
    id.packChecksum === want.manifestChecksumFromReport && id.configChecksum === want.runConfigSha256;
  return { pass: same, observed: { siteVersion: id.siteVersion, packId: id.packId, packVersion: id.packVersion, shellVersion: id.shellVersion, packChecksum: id.packChecksum, configChecksum: id.configChecksum } };
});

// ── 2. 字节稳定性 ────────────────────────────────────────────────────────────
check("bytes.snapshot-untouched", () => {
  const snapshot = hashes.entries.filter((e) => e.role === "snapshot");
  const diffs = snapshot.filter((e) => sha(path.join(EFFORT, e.path)) !== e.sha256).map((e) => e.relativePath);
  const reference = hashes.entries.filter((e) => e.role === "reference");
  const refDiffs = reference.filter((e) => sha(path.join(EFFORT, e.path)) !== e.sha256).map((e) => e.relativePath);
  return { pass: diffs.length === 0 && refDiffs.length === 0, snapshotFiles: snapshot.length, referenceFiles: reference.length, diffs, refDiffs };
});

check("bytes.work-vs-snapshot", () => {
  const snapshot = hashes.entries.filter((e) => e.role === "snapshot");
  const diffs = snapshot
    .filter((e) => sha(path.join(WORK, e.relativePath)) !== e.sha256)
    .map((e) => e.relativePath);
  // 预期只有本轮写回的 qa-report.json；site/pack/config 字节必须一致。
  return { pass: diffs.length === 1 && diffs[0] === "run/v1/qa-report.json", diffs };
});

check("bytes.site-integrity", () => {
  const now = Object.fromEntries(["index.html", "shell.js", "site.json", "game-config.json"]
    .map((f) => [f, sha(path.join(WORK, "site/v1", f))]));
  const same = siteIntegrity.unchanged === true &&
    Object.entries(siteIntegrity.after).every(([f, h]) => now[f] === h);
  return { pass: same, unchanged: siteIntegrity.unchanged, now };
});

check("run.setup-none", () => ({ pass: setup.kind === "none" && setup.applied === true, setup }));

// ── 3. 运行与断言 ────────────────────────────────────────────────────────────
check("run.executed", () => ({
  pass: result.execution === "executed" && result.exitCode === 0 && scenario.execution === "executed" &&
    scenario.terminationReached === true && scenario.assertionAggregate === "pass",
  execution: result.execution, exitCode: result.exitCode, terminationReached: scenario.terminationReached, assertionAggregate: scenario.assertionAggregate,
}));

check("events.recount", () => {
  const zero = ["reset", "danger-hit", "danger-erupt", "runtime-error"];
  const mismatched = Object.entries(scenario.eventCounts)
    .filter(([t, n]) => (counts[t] ?? 0) !== n)
    .map(([t, n]) => ({ type: t, declared: n, recounted: counts[t] ?? 0 }));
  const zeroNotZero = zero.filter((t) => (counts[t] ?? 0) !== 0);
  return { pass: mismatched.length === 0 && zeroNotZero.length === 0, recounted: counts, mismatched, zeroNotZero };
});

check("assertions.recompute", () => {
  const values = {
    initialActivePickups: first.pickups.filter((p) => p.active).length,
    activePickups: last.pickups.filter((p) => p.active).length,
    collected: Math.max(...trace.map((r) => r.collected)),
    won: trace.some((r) => r.won),
    chestsOpened: last.chests.filter((c) => c.opened).length,
  };
  const recomputed = scenario.assertions.map((a) => {
    const observed = a.expect.kind === "event" ? (counts[a.expect.type] ?? 0) : values[a.expect.path];
    const pass = a.expect.op === "eq" ? observed === a.expect.value
      : a.expect.op === "gte" ? observed >= a.expect.value
        : a.expect.op === "lte" ? observed <= a.expect.value
          : false;
    return { id: a.id, declared: a.observed, recomputed: observed, declaredPass: a.result, recomputedPass: pass };
  });
  const bad = recomputed.filter((r) => r.declared !== r.recomputed || !r.recomputedPass || r.declaredPass !== "pass");
  return { pass: recomputed.length === 8 && bad.length === 0, assertions: recomputed, bad };
});

check("startup", () => {
  const errors = consoleLog.filter((l) => l.type === "error");
  return {
    pass: counts["scene-ready"] === 1 && counts.spawn === 1 && errors.length === 0 && exceptions.length === 0,
    sceneReady: counts["scene-ready"], spawn: counts.spawn, consoleErrors: errors, exceptions: exceptions.length,
  };
});

check("movement", () => ({
  pass: first.x === scenario.initialState.playerX && last.x === scenario.endState.playerX && last.x - first.x > 1000,
  firstX: first.x, lastX: last.x, samples: trace.length, gaps: trace.filter((r) => r.gap === true).length,
}));

check("jump-land", () => {
  const space = input.filter((i) => i.type === "keyDown" && i.code === "Space").length;
  return { pass: space === 9 && counts.jump === 9 && counts.land === 9, spaceDowns: space, jump: counts.jump, land: counts.land };
});

check("pickups", () => ({
  pass: counts.pickup === 4 && first.pickups.filter((p) => p.active).length === 4 && last.pickups.filter((p) => p.active).length === 0,
  pickupEvents: counts.pickup, initialActive: first.pickups.filter((p) => p.active).length, finalActive: last.pickups.filter((p) => p.active).length,
}));

check("chests", () => ({
  pass: counts["chest-open"] === 2 && last.chests.filter((c) => c.opened).length === 2,
  chestOpenEvents: counts["chest-open"], openedInTrace: last.chests.filter((c) => c.opened).length,
}));

const winEvent = events.find((e) => e.type === "win");
const lastPickup = events.filter((e) => e.type === "pickup").at(-1);
const reachGoalDown = input.find((i) => i.source === "reach_goal" && i.type === "keyDown");

check("gate.win", () => {
  const gateReached = last.gate && last.right >= last.gate.x && last.bottom >= last.gate.y;
  return {
    pass: last.won === true && counts.win === 1 && gateReached === true && lastPickup.params.collected === 6 &&
      winEvent.t > lastPickup.t,
    won: last.won, winEventT: winEvent.t, lastPickupT: lastPickup.t, playerRight: last.right, gateX: last.gate.x, playerBottom: last.bottom, gateY: last.gate.y,
  };
});

check("collected-guard-order", () => {
  const collectStep = scenarioFile.actions.findIndex((a) => a.kind === "wait_until" && a.condition.kind === "collected");
  const goalStep = scenarioFile.actions.findIndex((a) => a.kind === "reach_goal");
  // FA-01A 的误归因风险（到 gate 但漏捡 → GAMEPLAY_FAILURE）靠这一步"集齐守卫"挡住。
  return {
    pass: collectStep >= 0 && goalStep >= 0 && collectStep < goalStep && lastPickup.t <= reachGoalDown.t,
    collectStep, goalStep, lastPickupT: lastPickup.t, reachGoalStartsAt: reachGoalDown.t,
  };
});

// ── 4. 危险物：接触只能间接判定 ──────────────────────────────────────────────
check("hazard.indirect", () => {
  let overlaps = 0;
  let minGapCenter14 = Infinity;
  let minGapBoxOverlap = Infinity;
  let minGapAt = null;
  for (const r of trace) {
    const player = boxOf(r.x, r.bottom, playerSize);
    for (const h of r.hazards) {
      const hazard = boxOf(h.x, h.y, hazardSize);
      const xOverlap = player.left < hazard.right && player.right > hazard.left;
      const yOverlap = player.top < hazard.bottom && player.bottom > hazard.top;
      if (xOverlap && yOverlap) overlaps++;
      const gap = hazard.top - player.bottom;
      if (Math.abs(r.x - h.x) <= 14 && gap < minGapCenter14) {
        minGapCenter14 = gap;
        minGapAt = { t: r.t, x: r.x, bottom: r.bottom, hazardX: +h.x.toFixed(2) };
      }
      if (xOverlap && gap < minGapBoxOverlap) minGapBoxOverlap = gap;
    }
  }
  return {
    pass: overlaps === 0 && (counts.reset ?? 0) === 0 && (counts["danger-hit"] ?? 0) === 0 && (counts["runtime-error"] ?? 0) === 0,
    reset: counts.reset ?? 0,
    dangerHit: counts["danger-hit"] ?? 0,
    samplingOverlaps: overlaps,
    playerSize, hazardSize,
    minVerticalClearance_centerWithin14: minGapCenter14,
    minVerticalClearance_boxOverlap: minGapBoxOverlap,
    minGapAt,
    caveat: "采样级重建（trace 约 38ms 一行）；接触的权威判据是游戏自己的 physics overlap → reset，本轮 reset=0。",
  };
});

// ── 5. 五态归因（真实归因器）───────────────────────────────────────────────
/** 逐字镜像 `packages/cli/src/playtest.ts` 的 `attributionEvidence()`。 */
function attributionEvidenceFor(dir, sc) {
  const evs = readJsonl(path.join(dir, "events.jsonl"));
  const tr = readJsonl(path.join(dir, "trace.jsonl"));
  const runtimeErrors = evs.filter((e) => e.type === "runtime-error").map((e) => {
    const params = e.params ?? {};
    return { kind: params.kind === "exception" ? "exception" : "console", text: String(params.text ?? ""), origin: "unknown" };
  });
  const pollGaps = tr.filter((x) => x.gap === true).length;
  const sceneReady = evs.some((e) => e.type === "scene-ready");
  const notExecuted = sc.execution !== "executed";
  const reason = typeof sc.execution === "string" ? "" : sc.execution.reason;
  const stage = notExecuted ? (/boot|scene|ready|启动|没有拿到/i.test(reason) ? "boot" : "prepare") : "execute";
  const envErrors = runtimeErrors.filter((e) => e.origin === "environment");
  const envFailures = [...(notExecuted ? [reason] : []), ...envErrors.map((e) => e.text)].filter((s) => s.length > 0);
  const actions = sc.actions;
  const attempted = actions.length;
  const completed = actions.filter((a) => a.outcome === "completed").length;
  const timedOut = actions.filter((a) => a.outcome === "timeout").length;
  const progressPx = (sc.endState.playerX ?? 0) - (sc.initialState.playerX ?? 0);
  return {
    scenario: sc,
    stage,
    environment: { healthy: !notExecuted && sceneReady && pollGaps === 0 && envErrors.length === 0, chromeAvailable: true, sceneReadyObserved: sceneReady, pollGaps, failures: envFailures },
    runtimeErrors,
    action: {
      attempted, completed, timedOut,
      explorationExhausted: attempted > 0 && actions.every((a) => a.outcome === "completed" || a.outcome === "timeout"),
      stuck: ((sc.steps ?? 0) >= 200 && progressPx <= 10) || (sc.eventCounts.reset ?? 0) >= 3,
      progressPx,
    },
    deadlineHit: timedOut > 0,
    structuralUndecidable: pollGaps > 0 || sc.assertions.some((a) => a.insufficientEvidence?.ruleId === "poll-gap" || a.insufficientEvidence?.ruleId === "event-unjudgeable"),
    evidence: ["playtest-events", "playtest-trace"],
  };
}

check("attribution.success", () => {
  const ev = attributionEvidenceFor(SCEN_DIR, scenario);
  const r = attribute(ev);
  return {
    pass: r.execution === "executed" && r.outcome === "SUCCESS" && r.stage === "evaluate" && scenario.outcome === "SUCCESS",
    attributed: r, declaredOutcome: scenario.outcome,
    env: ev.environment, action: ev.action,
  };
});

const FAILED = path.join(EFFORT, "runs/2026-10-28-acceptance/harness-1/attempt-v1");
check("attribution.failed-iteration", () => {
  const failedResult = readJson(path.join(FAILED, "result.json"));
  const failedScenario = failedResult.scenarios[0];
  const ev = attributionEvidenceFor(path.join(FAILED, "acceptance-win-wasteland-v1"), failedScenario);
  const r = attribute(ev);
  const wonAssertion = failedScenario.assertions.find((a) => a.id === "won");
  return {
    pass: r.execution === "executed" && r.outcome === "AGENT_LIMITATION" && wonAssertion.result === "unknown" && failedScenario.assertionAggregate === "fail",
    attributed: r,
    resets: failedScenario.eventCounts.reset,
    steps: failedScenario.steps,
    progressPx: ev.action.progressPx,
    wonAssertionResult: wonAssertion.result,
    note: "断言聚合 fail 的不是 GAMEPLAY_FAILURE：won/collected/pickup 在未到 gate 时是 unknown，正面的能力边界证据（19 reset、3138 步、无终止）把它们归为 AGENT_LIMITATION。",
  };
});

check("misattribution.gate-without-collected", () => {
  // 规则 ④ 的已知边界：gateReached + won=false ⇒ fail ⇒ GAMEPLAY_FAILURE；若漏捡是代理限制，则是误归因。
  const atGateNotWon = trace.filter((r) => r.gate && r.right >= r.gate.x && r.bottom >= r.gate.y && !r.won).length;
  const collectStep = scenarioFile.actions.findIndex((a) => a.kind === "wait_until" && a.condition.kind === "collected");
  const goalStep = scenarioFile.actions.findIndex((a) => a.kind === "reach_goal");
  return {
    pass: atGateNotWon === 0 && collectStep < goalStep,
    affected: atGateNotWon > 0,
    atGateNotWonSamples: atGateNotWon,
    guardOrdered: collectStep < goalStep,
    rule: "observe.mjs judgeableNegative('won') = gateReached；attribution rule ④ 把 failed won 判 GAMEPLAY_FAILURE",
    status: "known-limitation（只在未集齐就到达 gate 时触发；本验收场景的 collected 守卫使其不发生；改规则需审批）",
  };
});

// ── 6. 交付链与历史 ──────────────────────────────────────────────────────────
check("delivery.consistency", () => {
  const d = report.delivery;
  const smoke = d.checks.find((c) => c.key === "playable-smoke");
  const visual = d.checks.find((c) => c.key === "visual-review");
  const mapped = mapPlaytest(d.playtest);
  const refs = d.evidence.filter((e) => e.ref.startsWith("playtest-"));
  const missing = refs.filter((e) => !exists(path.join(WORK, "..", e.path)) && !exists(path.join(EFFORT, e.path)));
  const scenariosMatch = d.playtest.scenarios.length === 1 &&
    d.playtest.scenarios[0].scenarioId === scenario.scenarioId &&
    d.playtest.scenarios[0].outcome === scenario.outcome;
  return {
    pass: smoke.status === "pass" && smoke.detail === "SUCCESS" && visual.status === "incomplete" &&
      d.visualReview.status === "pending" && d.verdict === "incomplete" &&
      mapped.status === "pass" && mapped.detail === "SUCCESS" && scenariosMatch && missing.length === 0,
    playableSmoke: smoke, visualReview: visual, visualReviewObject: d.visualReview, verdict: d.verdict,
    mapped, scenariosMatch, missingEvidence: missing,
    reportPath: d.playtest.report,
  };
});

check("history.not-upgraded", () => {
  const refResult = readJson(path.join(ART, "reference/playtest-v1/attempt-v1/result.json"));
  const stageC = readJson(path.join(ART, "reference/prior-delivery-stage-c/qa-report.json"));
  return {
    pass: refResult.aggregate === "AGENT_LIMITATION" && refResult.scenarios[0].outcome === "AGENT_LIMITATION" &&
      stageC.delivery.verdict === "incomplete" &&
      stageC.delivery.visualReview.status === "pass" &&
      report.delivery.visualReview.status === "pending",
    historicalOutcome: refResult.aggregate,
    historicalCollected: refResult.scenarios[0].endState.collected,
    historicalVerdict: stageC.delivery.verdict,
    historicalVisual: stageC.delivery.visualReview.status,
    currentVisual: report.delivery.visualReview.status,
    note: "历史 stage-c 的 visual PASS 只作参考；本轮信封由 FA-01D 重新初始化（visual=pending），不继承。",
  };
});

// ── 汇总 ────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => c.pass === false);
const out = {
  format: "fpvs-fa03-attribution-verification/v1",
  generatedAt: new Date().toISOString(),
  subject: {
    run: "wasteland-scavenger-recipe/run/v1",
    attempt: "playtest/v2",
    scenario: scenario.scenarioId,
    snapshot: "artifacts/wasteland-scavenger-recipe (66 files, read-only)",
    report: "run/v1/playtest/v2/result.json",
  },
  verdict: failed.length === 0 ? "pass" : "fail",
  checksFailed: failed.length,
  checks: checks.map((c) => ({ id: c.id, pass: c.pass, ...Object.fromEntries(Object.entries(c).filter(([k]) => !["id", "pass"].includes(k))) })),
};
fs.writeFileSync(path.join(HERE, "attribution.json"), JSON.stringify(out, null, 2) + "\n");

for (const c of checks) {
  console.log(`${c.pass ? "✅" : "❌"} ${c.id}${c.pass ? "" : "  ← " + JSON.stringify(c.error ?? c)}`);
}
console.log(`\n${out.verdict.toUpperCase()} · ${checks.length - failed.length}/${checks.length} checks · → ${path.relative(ROOT, path.join(HERE, "attribution.json"))}`);
process.exit(failed.length === 0 ? 0 : 1);
