/**
 * I02-D5B · 累计 cut 预算基准运行器。
 * 复现：node build-inputs.mjs && node run.mjs
 * 产物：outputs/run.json、outputs/stdout.txt；任一断言失败退出码 1。
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanCorpus, environment, dist, round, sha256File, ROOT,
  corpusCase, syntheticCase, safeCase, runProxy, u9WaitCost, summarizeRun,
  WITNESS_TRANSITION_BYTES, WITNESS_COMPACT_BYTES,
} from "./core.mjs";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const casesBytes = readFileSync(join(here, "inputs", "cases.json"));
const cases = JSON.parse(casesBytes.toString("utf8"));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const checks = [];
const check = (id, ok, detail) => checks.push({ id, ok: !!ok, ...(detail === undefined ? {} : { detail }) });

const corpus = scanCorpus();
const rows = corpus.rows.filter((r) =>
  r.axis === "x" && r.visualWidth != null && r.goalX != null && r.goalX > r.startX && r.hazardAtX != null);

const runs = [];
const runOne = (label, c) => {
  const r = runProxy(c);
  const s = summarizeRun(r);
  runs.push({ ...s, label, input: { kind: c.kind, config: c.config, hazardId: c.hazardId, id: c.id, speed: c.speed, lagMs: c.lagMs, limits: c.limits } });
  return s;
};

/* 1. 语料：两档限值 × 两档 lag × 两档速度 */
for (const row of rows) {
  const speeds = [...new Set(cases.corpus.speedBands
    .map((b) => (b === "config" ? row.playerConfigSpeedPxPerMs : b))
    .filter((x) => Number.isFinite(x) && x > 0))];
  for (const speed of speeds) {
    for (const lagMs of cases.lagsMs) {
      for (const [limitName, limits] of Object.entries(cases.corpus.limits)) {
        runOne(`corpus/${limitName}`, corpusCase(row, speed, lagMs, limits));
      }
    }
  }
}

/* 2. 合成最坏用例 */
for (const s of cases.synthetic) {
  for (const lagMs of cases.lagsMs) {
    runOne(`synthetic/${s.id}`, syntheticCase(s, lagMs));
  }
}

const byKind = (kind) => runs.filter((r) => r.input.kind === kind);
const corpusRuns = byKind("corpus");
const syntheticRuns = byKind("synthetic");
const recommended = corpusRuns.filter((r) => r.input.limits.maxStates === cases.corpus.limits.recommended.maxStates);
const hard = corpusRuns.filter((r) => r.input.limits.maxStates === cases.corpus.limits.hard.maxStates);

const d = (rs, pick) => dist(rs.map(pick).filter(Number.isFinite));
const distributions = {
  edgesChecked: d(recommended, (r) => r.stats.edgesChecked),
  cutsTotal: d(recommended, (r) => r.stats.cutsTotal),
  segmentsTotal: d(recommended, (r) => r.stats.segmentsTotal),
  cutsTotalHard: d(hard, (r) => r.stats.cutsTotal),
  segmentsTotalHard: d(hard, (r) => r.stats.segmentsTotal),
  witnessTransitions: d(corpusRuns, (r) => r.stats.witnessTransitions),
};

const byLag = (lag) => corpusRuns.filter((r) => r.input.lagMs === lag);
const perLag = Object.fromEntries(cases.lagsMs.map((lag) => {
  const rs = byLag(lag);
  return [lag, {
    runs: rs.length,
    cutsTotal: d(rs, (r) => r.stats.cutsTotal),
    segmentsTotal: d(rs, (r) => r.stats.segmentsTotal),
    edgesChecked: d(rs, (r) => r.stats.edgesChecked),
  }];
}));
const perLagLimit = Object.fromEntries(Object.entries(cases.corpus.limits).map(([limitName, limits]) => {
  const rs = corpusRuns.filter((r) => r.input.limits.maxStates === limits.maxStates);
  return [limitName, Object.fromEntries(cases.lagsMs.map((lag) => {
    const lr = rs.filter((r) => r.input.lagMs === lag);
    const worstCuts = lr.reduce((a, r) => (r.stats.cutsTotal > a.stats.cutsTotal ? r : a), lr[0]);
    const worstSeg = lr.reduce((a, r) => (r.stats.segmentsTotal > a.stats.segmentsTotal ? r : a), lr[0]);
    return [lag, {
      runs: lr.length,
      cutsTotal: d(lr, (r) => r.stats.cutsTotal),
      segmentsTotal: d(lr, (r) => r.stats.segmentsTotal),
      maxCutsRun: worstCuts ? { label: worstCuts.input.config + "#" + worstCuts.input.hazardId, speed: worstCuts.input.speed, cuts: worstCuts.stats.cutsTotal } : null,
      maxSegmentsRun: worstSeg ? { label: worstSeg.input.config + "#" + worstSeg.input.hazardId, speed: worstSeg.input.speed, segments: worstSeg.stats.segmentsTotal, states: worstSeg.stats.statesVisited } : null,
    }];
  }))];
}));

const perEdge = corpusRuns.reduce((acc, r) => {
  for (const [v, n] of r.edgeCuts.values) acc.cuts.set(v, (acc.cuts.get(v) ?? 0) + n);
  for (const [v, n] of r.edgeSegments.values) acc.segments.set(v, (acc.segments.get(v) ?? 0) + n);
  return acc;
}, { cuts: new Map(), segments: new Map() });
const histSummary = (m) => {
  const entries = [...m.entries()].sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const q = (p) => { let acc = 0; for (const [v, n] of entries) { acc += n; if (acc >= p * total) return v; } return entries.at(-1)?.[0] ?? null; };
  return { total, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: entries.at(-1)?.[0] ?? null, values: entries };
};
const edgeDist = { cuts: histSummary(perEdge.cuts), segments: histSummary(perEdge.segments) };

/* 2b. 安全路径 witness（体积计量） */
const safeRuns = [];
for (const spec of [{ visualWidth: 1440, maxStates: 1_000_000 }]) {
  const c = safeCase(spec);
  const r = runProxy(c);
  const s = summarizeRun(r);
  safeRuns.push({ ...s, label: c.label });
  runs.push({ ...s, label: c.label, input: { kind: "witness" } });
}

/* 3. 候选 maxCutsPerBranch 覆盖 */
const maxSegRecommended = Math.max(0, ...recommended.map((r) => r.stats.segmentsTotal));
const maxCutsRecommended = Math.max(0, ...recommended.map((r) => r.stats.cutsTotal));
const maxSegHard = Math.max(0, ...hard.map((r) => r.stats.segmentsTotal));
const candidateCoverage = cases.candidateCuts.map((cap) => ({
  cap,
  coversRecommendedSegments: maxSegRecommended <= cap,
  coversHardSegments: maxSegHard <= cap,
  headroomVsRecommended: cap / Math.max(1, maxSegRecommended),
}));

/* 4. U9 等待成本（取语料最大 N） */
const u9 = rows.length ? (() => {
  let worst = null;
  for (const row of rows) {
    for (const speed of [...new Set([row.playerConfigSpeedPxPerMs, 0.16].filter((x) => Number.isFinite(x) && x > 0))]) {
      const c = corpusCase(row, speed, 16.67, cases.corpus.limits.recommended);
      const u = u9WaitCost(c);
      if (u && (!worst || u.segmentsAllPhases > worst.segmentsAllPhases)) worst = { ...u, config: row.config, hazardId: row.hazardId, speed };
    }
  }
  return worst;
})() : null;

/* 5. Witness 体积 */
const witnessMax = Math.max(0, ...runs.map((r) => r.stats.witnessTransitions ?? 0));
const witnessBytesMax = witnessMax * WITNESS_TRANSITION_BYTES;
const witnessCompactMax = witnessMax * WITNESS_COMPACT_BYTES;
const policyCapacityMax = Math.max(0, ...runs.map((r) => r.stats.stateCapacity ?? 0));
const policyBytesFull = policyCapacityMax * WITNESS_TRANSITION_BYTES;
const policyBytesCompact = policyCapacityMax * WITNESS_COMPACT_BYTES;
const policyAt = (cap) => ({ transitions: cap, bytesFull: cap * WITNESS_TRANSITION_BYTES, bytesCompact: cap * WITNESS_COMPACT_BYTES });
const capBytes = 64 * 1024 * 1024;
const maxTransitionsUnderByteCapFull = Math.floor(capBytes / WITNESS_TRANSITION_BYTES);
const maxTransitionsUnderByteCapCompact = Math.floor(capBytes / WITNESS_COMPACT_BYTES);

/* 6. 确定性：E1440 重复两次 */
const e1440 = cases.synthetic.find((s) => s.id === "E1440");
const repeatA = runProxy(syntheticCase(e1440, 16.67));
const repeatB = runProxy(syntheticCase(e1440, 16.67));
const repeatStable = repeatA.stats.statesVisited === repeatB.stats.statesVisited
  && repeatA.stats.edgesChecked === repeatB.stats.edgesChecked
  && repeatA.stats.segmentsTotal === repeatB.stats.segmentsTotal
  && repeatA.verdict === repeatB.verdict && repeatA.reason === repeatB.reason;

/* 7. 断言 */
check("corpus:uniqueConfigs", corpus.counts.uniqueConfigs === 21, corpus.counts);
check("corpus:movingHazards", corpus.counts.movingHazards === 19, corpus.counts);
check("runs:nonEmpty", runs.length > 0, { runs: runs.length });
check("per-edge:cuts-small", edgeDist.cuts.max <= 1, edgeDist.cuts);
check("per-edge:segments-small", edgeDist.segments.max <= 2, edgeDist.segments);
check("u9:segments-bounded", u9 == null || u9.segmentsAllPhases < 100_000, u9);
check("witness:path-within-caps", witnessMax <= 1_000_000 && witnessBytesMax <= capBytes, { witnessMax, witnessBytesMax, witnessCompactMax });
check("witness:policy-full-record-exceeds-64MiB", policyBytesFull > capBytes, { policyCapacityMax, policyBytesFull, maxTransitionsUnderByteCapFull });
check("witness:policy-compact-record-bounded", policyBytesCompact <= 256 * 1024 * 1024, { policyBytesCompact });
check("determinism:counts-stable", repeatStable, {
  a: { v: repeatA.stats.statesVisited, e: repeatA.stats.edgesChecked, c: repeatA.stats.segmentsTotal },
  b: { v: repeatB.stats.statesVisited, e: repeatB.stats.edgesChecked, c: repeatB.stats.segmentsTotal },
});

const out = {
  meta: {
    ticket: "I02-D5B",
    generatedAt: new Date().toISOString(),
    inputsSha256: sha256(casesBytes),
    inventory: { rel: cases.meta.inventory, sha256: cases.meta.inventorySha256 },
    model: { kind: "D3/D10-shaped proxy", notProduction: true },
    cutsDefinition: "cuts = interior turnaround points; segments = cuts + 1 analytic pieces",
  },
  environment: environment(),
  counts: corpus.counts,
  filters: { corpusRows: rows.length },
  distributions,
  perLag,
  perLagLimit,
  edgeDist,
  candidateCoverage,
  bounds: { maxCutsRecommended, maxSegRecommended, maxSegHard, maxCutsHard: Math.max(0, ...hard.map((r) => r.stats.cutsTotal)) },
  u9,
  witness: {
    path: { maxTransitions: witnessMax, bytesPerTransition: WITNESS_TRANSITION_BYTES, estimatedBytesAtMax: witnessBytesMax, compactBytesPerTransition: WITNESS_COMPACT_BYTES, compactBytesAtMax: witnessCompactMax },
    policyBound: {
      stateCapacityMax: policyCapacityMax, bytesFullRecord: policyBytesFull, bytesCompactRecord: policyBytesCompact,
      maxTransitionsUnder64MiBFull: maxTransitionsUnderByteCapFull, maxTransitionsUnder64MiBCompact: maxTransitionsUnderByteCapCompact,
      atRecommendedStateCap: policyAt(cases.corpus.limits.recommended.maxStates),
      atHardStateCap: policyAt(cases.corpus.limits.hard.maxStates),
    },
    caps: { transitions: 1_000_000, bytes: 64 * 1024 * 1024 },
    safeRuns: safeRuns.map((r) => ({ label: r.label, verdict: r.verdict, reason: r.reason, transitions: r.stats.witnessTransitions, statesVisited: r.stats.statesVisited, edgesChecked: r.stats.edgesChecked })),
  },
  determinism: { repeatStable },
  checks,
  runs,
};

writeFileSync(join(here, "outputs", "run.json"), JSON.stringify(out, null, 2) + "\n");
const lines = [];
lines.push(`D5B runs=${runs.length} checks=${checks.filter((c) => c.ok).length}/${checks.length}`);
lines.push(`edge cuts: ${JSON.stringify(edgeDist.cuts)}`);
lines.push(`edge segments: ${JSON.stringify(edgeDist.segments)}`);
lines.push(`recommended(500k): cuts p50=${distributions.cutsTotal.p50} p90=${distributions.cutsTotal.p90} max=${distributions.cutsTotal.max}; segments max=${maxSegRecommended}`);
lines.push(`hard(1M): cuts max=${distributions.cutsTotalHard.max}; segments max=${maxSegHard}`);
lines.push(`candidates: ${candidateCoverage.map((c) => `${c.cap}:${c.coversRecommendedSegments ? "ok" : "trip"}`).join(" ")}`);
lines.push(`u9: ${JSON.stringify(u9)}`);
lines.push(`witness path: maxTransitions=${witnessMax} bytesPer=${WITNESS_TRANSITION_BYTES} estMaxBytes=${witnessBytesMax} compactBytesPer=${WITNESS_COMPACT_BYTES}`);
lines.push(`witness policy bound: stateCapacityMax=${policyCapacityMax} fullBytes=${policyBytesFull} compactBytes=${policyBytesCompact} maxTransitions@64MiB(full)=${maxTransitionsUnderByteCapFull} maxTransitions@64MiB(compact)=${maxTransitionsUnderByteCapCompact}`);
lines.push(`perLag: ${JSON.stringify(perLag)}`);
lines.push(`perLagLimit: ${JSON.stringify(perLagLimit)}`);
lines.push(`determinism=${repeatStable}`);
for (const c of checks) if (!c.ok) lines.push(`FAIL ${c.id} ${JSON.stringify(c.detail)}`);
lines.push(`exit=${checks.every((c) => c.ok) ? 0 : 1}`);
writeFileSync(join(here, "outputs", "stdout.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(checks.every((c) => c.ok) ? 0 : 1);
