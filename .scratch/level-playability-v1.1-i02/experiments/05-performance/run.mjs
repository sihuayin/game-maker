/**
 * I02-05 · 性能与预算基线运行器。
 * 读取 inputs/cases.json，跑 P0 代理、写 outputs/run.json；失败退出码 1。
 * 复现：node build-inputs.mjs && node --expose-gc run.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODEL_REL, INVENTORY_REL,
  scanCorpus, corpusConfig, exhaustionCase, runCase, dist, round, environment, sha256File, graphCapacity,
} from "./core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const inputsBytes = readFileSync(join(here, "inputs", "cases.json"));
const cases = JSON.parse(inputsBytes.toString("utf8"));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function main() {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: !!ok, ...(detail === undefined ? {} : { detail }) });

  /* 1. 语料 ------------------------------------------------------- */
  const corpus = scanCorpus();
  check("corpus:uniqueConfigs", corpus.counts.uniqueConfigs === 21, corpus.counts);
  check("corpus:movingHazards", corpus.counts.movingHazards === 19, corpus.counts);
  check("corpus:nonXAxis", corpus.counts.nonXAxisMoving === 0, corpus.counts);

  const capacity = corpus.rows.map((r) => r.canonical?.stateCapacity).filter(Number.isFinite);
  const capacityDist = dist(capacity);

  /* 2. 语料运行（P0 代理） ---------------------------------------- */
  const rows = [];
  const skipped = [];
  for (const r of corpus.rows) {
    if (r.axis !== "x") continue;
    if (!r.canonical || r.goalX == null || r.goalX <= r.startX || r.hazardAtX == null) {
      skipped.push({ config: r.config, hazardId: r.hazardId, reason: "no-goal-or-goal-not-ahead" });
      continue;
    }
    const speeds = [...new Set(cases.corpus.speedBands.map((band) => (band === "config" ? r.playerConfigSpeedPxPerMs : band))
      .filter((x) => Number.isFinite(x) && x > 0))];
    for (const speed of speeds) {
      const cfg = corpusConfig(r, speed, cases.corpus.limits);
      rows.push(runCase(`corpus/${r.config}#${r.hazardId}/speed=${speed}`, cfg, {
        kind: "corpus", config: r.config, contentHash: r.contentHash, configSha256: r.configSha256,
        hazardId: r.hazardId, speed, canonicalCapacity: r.canonical.stateCapacity,
      }));
    }
  }
  const valid = rows.filter((r) => r.stats.dtMs > 0 && r.stats.maxStepPx >= 2 - 1e-9);
  const degenerate = rows.filter((r) => !valid.includes(r));
  const runDist = (key) => dist(valid.map((r) => r[key]).filter(Number.isFinite));
  const distributions = {
    wallMs: runDist("wallMs"),
    statesVisited: runDist("stats.statesVisited"),
    edgesChecked: runDist("stats.edgesChecked"),
    stateCapacity: runDist("stateCapacity"),
  };
  // P0 stats 里 visited/edges 在 stats 对象内，单独展开。
  distributions.statesVisited = dist(valid.map((r) => r.stats.statesVisited).filter(Number.isFinite));
  distributions.edgesChecked = dist(valid.map((r) => r.stats.edgesChecked).filter(Number.isFinite));

  /* 3. 合成最坏用例 ----------------------------------------------- */
  const synthetic = cases.synthetic.map((s) => runCase(`synthetic/${s.id}`, exhaustionCase(s), {
    kind: "synthetic", id: s.id, visualWidth: s.visualWidth,
  }));
  for (const s of synthetic) {
    check(`synthetic:${s.id}:verdict`, s.verdict === "INSUFFICIENT_EVIDENCE" && s.reason === "no-witness-found", { verdict: s.verdict, reason: s.reason });
  }
  const synthById = Object.fromEntries(synthetic.map((s) => [s.id, s]));
  check("synthetic:E5760:explosion", synthById.E5760?.stats.statesVisited > 500_000, { visited: synthById.E5760?.stats.statesVisited });

  /* 4. 预算边界：状态预算 vs 墙钟 -------------------------------- */
  const boundary = cases.boundary.map((b) => runCase(`boundary/${b.id}`, exhaustionCase({
    ...cases.synthetic[1], maxStates: b.limits.maxStates, timeBudgetMs: b.limits.timeBudgetMs,
  }), { kind: "boundary", id: b.id, limits: b.limits }));
  const boundaryById = Object.fromEntries(boundary.map((b) => [b.id, b]));
  check("boundary:state500k:stopped", boundaryById.state500k?.stats.budgetExceeded === true, { visited: boundaryById.state500k?.stats.statesVisited });
  check("boundary:state500k:at-budget", boundaryById.state500k?.stats.statesVisited <= 500_000, { visited: boundaryById.state500k?.stats.statesVisited });
  check("boundary:wall5ms:stopped", boundaryById.wall5ms?.stats.budgetExceeded === true, { visited: boundaryById.wall5ms?.stats.statesVisited });
  check("boundary:wall5ms:before-state", (boundaryById.wall5ms?.stats.statesVisited ?? Infinity) < 500_000, {
    visited: boundaryById.wall5ms?.stats.statesVisited,
  });

  /* 5. 重复运行 --------------------------------------------------- */
  const repeats = [];
  for (const target of cases.repeats.targets) {
    const s = cases.synthetic.find((x) => x.id === target);
    const runs = [];
    for (let i = 0; i < cases.repeats.count; i += 1) runs.push(runCase(`repeat/${target}#${i + 1}`, exhaustionCase(s), { kind: "repeat", target }));
    const visited = [...new Set(runs.map((r) => r.stats.statesVisited))];
    const edges = [...new Set(runs.map((r) => r.stats.edgesChecked))];
    const verdicts = [...new Set(runs.map((r) => `${r.verdict}/${r.reason}`))];
    repeats.push({
      target,
      count: runs.length,
      wallMs: runs.map((r) => r.wallMs),
      wallDist: dist(runs.map((r) => r.wallMs)),
      elapsedMs: runs.map((r) => r.stats.elapsedMs),
      visitedUnique: visited,
      edgesUnique: edges,
      verdicts,
      stateCountsStable: visited.length === 1 && edges.length === 1 && verdicts.length === 1,
    });
  }
  check("repeat:state-counts-stable", repeats.every((r) => r.stateCountsStable), repeats.map((r) => r.target));

  /* 6. 二级代理：移动图脚点 × 相位（D3 未定，仅注记） ------------- */
  const graphRows = await graphCapacity(corpus.rows.filter((r) => r.axis === "x"));
  const graphOk = graphRows.filter((r) => Number.isFinite(r.stateCapacity200));
  const graphFailures = graphRows.filter((r) => !Number.isFinite(r.stateCapacity200));
  const graphCapDist = dist(graphOk.map((r) => r.stateCapacity200));
  check("graphCapacity:some-built", graphOk.length > 0, { built: graphOk.length, failed: graphFailures.length });

  /* 7. 与预算比较 ------------------------------------------------- */
  const rec = cases.budgets.recommended;
  const hard = cases.budgets.hard;
  const elapsedMax = Math.max(...valid.map((r) => r.wallMs), ...synthetic.map((r) => r.wallMs));
  const comparison = {
    recommended: rec,
    hard,
    corpusCapacity: { p50: capacityDist.p50, max: capacityDist.max, headroomVsRecommended: round(rec.maxStates / capacityDist.max, 2) },
    syntheticCapacity: Object.fromEntries(synthetic.map((s) => [s.id, {
      capacity: s.stateCapacity,
      fitsRecommended: s.stateCapacity <= rec.maxStates,
      fitsHard: s.stateCapacity <= hard.maxStates,
      ratioVsRecommended: round(s.stateCapacity / rec.maxStates, 2),
    }])),
    elapsed: {
      corpusAndSyntheticMaxMs: round(elapsedMax, 3),
      fitsRecommended: elapsedMax <= rec.timeBudgetMs,
      fitsHard: elapsedMax <= hard.timeBudgetMs,
      headroomVsRecommended: round(rec.timeBudgetMs / elapsedMax, 2),
    },
    graphCapacity200: {
      p50: graphCapDist.p50,
      max: graphCapDist.max,
      fitsRecommended: graphCapDist.max <= rec.maxStates,
      fitsHard: graphCapDist.max <= hard.maxStates,
      ratioVsRecommended: graphCapDist.max ? round(graphCapDist.max / rec.maxStates, 2) : null,
    },
    findings: {
      corpusFitsRecommendedStates: capacityDist.max <= rec.maxStates,
      corpusFitsHardStates: capacityDist.max <= hard.maxStates,
      synthetic5760ExceedsRecommendedStates: (synthById.E5760?.stateCapacity ?? 0) > rec.maxStates,
      synthetic5760FitsHardStates: (synthById.E5760?.stateCapacity ?? Infinity) <= hard.maxStates,
      graphProxyMaxExceedsRecommendedStates: graphCapDist.max > rec.maxStates,
      elapsedFitsRecommended: elapsedMax <= rec.timeBudgetMs,
    },
  };

  /* 8. 墙钟超时的方差（与状态预算区分） --------------------------- */
  const wallClockRepeats = [];
  for (let i = 0; i < 5; i += 1) {
    const b = cases.boundary.find((x) => x.id === "wall5ms");
    wallClockRepeats.push(runCase(`wallClockRepeat#${i + 1}`, exhaustionCase({
      ...cases.synthetic[1], maxStates: b.limits.maxStates, timeBudgetMs: b.limits.timeBudgetMs,
    }), { kind: "wallClockRepeat" }));
  }
  const wallClockVisited = wallClockRepeats.map((r) => r.stats.statesVisited);
  const wallClock = {
    runs: wallClockRepeats.map((r) => ({ visited: r.stats.statesVisited, wallMs: r.wallMs, budgetExceeded: r.stats.budgetExceeded })),
    visitedDist: dist(wallClockVisited),
    visitedUnique: [...new Set(wallClockVisited)].length,
    note: "墙钟超时的 visited 随机器/负载变化；状态预算超时的 visited 稳定。",
  };

  /* 9. 确定性签名（只含状态预算驱动的运行；墙钟驱动的不进签名） ----- */
  const stateDrivenBoundary = boundary.filter((b) => b.id !== "wall5ms");
  const signature = JSON.stringify({
    corpus: rows.map((r) => [r.label, r.verdict, r.reason, r.stats.statesVisited, r.stats.edgesChecked]),
    synthetic: synthetic.map((r) => [r.label, r.verdict, r.reason, r.stats.statesVisited, r.stats.edgesChecked]),
    boundary: stateDrivenBoundary.map((r) => [r.label, r.verdict, r.reason, r.stats.statesVisited, r.stats.edgesChecked]),
  });
  const signatureSha256 = sha256(signature);

  const failed = checks.filter((x) => !x.ok);
  const payload = {
    meta: {
      ticket: "I02-05",
      effort: "level-playability-v1.1-i02",
      note: "P0 proxy, not the I-02 implementation; scratch-only, not production acceptance",
      node: process.version,
      model: { path: MODEL_REL, sha256: sha256File(join(process.cwd(), "../../../..", MODEL_REL)) },
      inventory: { path: INVENTORY_REL, sha256: sha256File(join(process.cwd(), "../../../..", INVENTORY_REL)) },
      inputsSha256: sha256(inputsBytes),
      readOnly: true,
    },
    environment: environment(),
    summary: { checks: checks.length, passed: checks.length - failed.length, failed: failed.length },
    failures: failed,
    corpus: { scope: corpus.scope, counts: corpus.counts, capacityDist, skipped, runs: rows.length, valid: valid.length, degenerate: degenerate.length, rows },
    distributions,
    synthetic,
    boundary,
    repeats,
    graphCapacity: { built: graphOk.length, failed: graphFailures.length, dist: graphCapDist, rows: graphRows },
    comparison,
    wallClock,
    determinism: { stateSignatureSha256: signatureSha256, excluded: "wall5ms (wall-clock driven)" },
  };

  writeFileSync(join(here, "outputs", "run.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log(JSON.stringify(payload.summary));
  console.log("stateSignatureSha256 =", signatureSha256);
  if (failed.length) {
    console.log("FAILURES:");
    for (const f of failed) console.log(" -", f.id, JSON.stringify(f.detail ?? {}));
    process.exit(1);
  }
}

await main();
