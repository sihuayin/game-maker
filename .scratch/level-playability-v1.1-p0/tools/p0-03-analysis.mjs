#!/usr/bin/env node
// P0-03：对 A/B/C 的分析器输入求值，并计算 A 的安全窗口 / 构造“等待后通过”witness。
//
//   node .scratch/level-playability-v1.1-p0/tools/p0-03-analysis.mjs [--out <json>] [--json]
//
// ⚠️ 只读 cases/** 与 prototype/**；--out 只写本 effort 的证据 JSON。
// ⚠️ 真实 Runtime 的最终 lagMs 由 evidence/03-runs/ 的 trace 决定（见 03-case-comparison.md）；
//   本工具对 16.67 / 200 两档做敏感性，并额外跑最终档。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyze, verifyWitness, trianglePosition, hazardSpeed } from "../prototype/temporal-model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, "..");
const ROOT = path.resolve(EFFORT, "../..");
const OUT = (() => {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
})();
const JSON_OUT = process.argv.includes("--json");
const FINAL_LAG_MS = 200;
const BANDS = [16.67, 200];
const sha256 = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const load = (c, f) => JSON.parse(fs.readFileSync(path.join(EFFORT, "cases", c, f), "utf8"));

function withLag(cfg, lagMs) {
  return { ...cfg, options: { ...(cfg.options ?? {}), lagMs } };
}

function windowForA(cfg, lagMs) {
  const h = cfg.hazard, p = cfg.player;
  const pad = hazardSpeed(h) * lagMs;
  const threshold = p.goalX + p.width + h.anchorX * h.width + pad; // P(t) must exceed this
  const speed = hazardSpeed(h); // px/ms, P(t) = start + speed*t while outbound
  const outbound = (threshold - h.startX) / speed;
  const inbound = h.periodMs - outbound;
  return {
    lagMs, padPx: pad, thresholdPx: threshold,
    windowMs: [outbound, inbound], durationMs: inbound - outbound,
    playerRightAtGoal: p.goalX + p.width,
  };
}

function waitThenRunWitness(cfg, lagMs) {
  const h = cfg.hazard, p = cfg.player;
  const w = windowForA(cfg, lagMs);
  // Wait just outside the lag-expanded sweep band: player right edge = bandLeft - pad - 2px.
  const waitLeft = h.startX - h.anchorX * h.width - hazardSpeed(h) * lagMs - 2 - p.width;
  const depart = w.windowMs[0];
  const arrive = depart + (p.goalX - waitLeft) / p.maxSpeed;
  const witness = {
    segments: [
      { t0: 0, t1: depart, x0: waitLeft, x1: waitLeft },
      { t0: depart, t1: arrive, x0: waitLeft, x1: p.goalX },
    ],
    departAt: depart, arriveAt: arrive, elapsedMs: 0,
  };
  return { waitLeft, witness, verify: verifyWitness(cfg, witness, lagMs) };
}

const aBase = load("a", "analyzer-input-lag200ms.json");
const bBase = load("b", "analyzer-input-lag200ms.json");
const c1 = load("c", "analyzer-phase-unknown.json");
const c2 = load("c", "analyzer-hitbox-unverifiable.json");

const rows = [];
for (const [caseId, base, file] of [
  ["A", aBase, "cases/a/analyzer-input-lag200ms.json"],
  ["B", bBase, "cases/b/analyzer-input-lag200ms.json"],
  ["C1", c1, "cases/c/analyzer-phase-unknown.json"],
  ["C2", c2, "cases/c/analyzer-hitbox-unverifiable.json"],
]) {
  for (const lagMs of [...new Set([...BANDS, FINAL_LAG_MS])]) {
    const cfg = withLag(base, lagMs);
    const r = analyze(cfg);
    rows.push({
      case: caseId, file, lagMs,
      verdict: r.verdict, reason: r.reason,
      proof: r.proof ?? null,
      witness: r.witness
        ? { departAt: r.witness.departAt, arriveAt: r.witness.arriveAt, segments: r.witness.segments.length,
            movingSegments: r.witness.segments.filter((s) => Math.abs(s.x1 - s.x0) > 1e-9).length }
        : null,
      stats: r.stats,
    });
  }
}

const aWindows = BANDS.map((lag) => ({ ...windowForA(aBase, lag), constructed: waitThenRunWitness(aBase, lag) }));

const report = {
  script: "tools/p0-03-analysis.mjs",
  scriptVersion: "p0-03-analysis/1",
  at: new Date().toISOString(),
  command: "node .scratch/level-playability-v1.1-p0/tools/p0-03-analysis.mjs --out .scratch/level-playability-v1.1-p0/evidence/03-analyzer-results.json --json",
  node: process.version,
  finalLagMs: FINAL_LAG_MS,
  bands: BANDS,
  inputs: {
    a: { file: "cases/a/analyzer-input-lag200ms.json", sha256: sha256(path.join(EFFORT, "cases/a/analyzer-input-lag200ms.json")) },
    b: { file: "cases/b/analyzer-input-lag200ms.json", sha256: sha256(path.join(EFFORT, "cases/b/analyzer-input-lag200ms.json")) },
    c1: { file: "cases/c/analyzer-phase-unknown.json", sha256: sha256(path.join(EFFORT, "cases/c/analyzer-phase-unknown.json")) },
    c2: { file: "cases/c/analyzer-hitbox-unverifiable.json", sha256: sha256(path.join(EFFORT, "cases/c/analyzer-hitbox-unverifiable.json")) },
  },
  rows,
  aSafeWindow: aWindows,
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, serialized); }
if (JSON_OUT || !OUT) process.stdout.write(serialized);
else console.log(`wrote ${rel(OUT)}`);
