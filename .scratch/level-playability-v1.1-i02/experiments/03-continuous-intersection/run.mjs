/**
 * I02-03 · 连续时间求交可行性实验 —— 运行器。
 *
 * 读取 `inputs/cases.json`（由 build-inputs.mjs 生成），逐项断言，写
 * `outputs/run.json`。任何断言失败 ⇒ 退出码 1。
 *
 * 复现：node build-inputs.mjs && node run.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as C from "./core.mjs";
import * as P0 from "../../../level-playability-v1.1-p0/prototype/temporal-model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const inputsPath = join(here, "inputs", "cases.json");
const inputsBytes = readFileSync(inputsPath);
const decodeNonFinite = (v) => {
  if (Array.isArray(v)) return v.map(decodeNonFinite);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = decodeNonFinite(x);
    return out;
  }
  if (v === "__NaN__") return NaN;
  if (v === "__Infinity__") return Infinity;
  if (v === "__-Infinity__") return -Infinity;
  return v;
};
const cases = decodeNonFinite(JSON.parse(inputsBytes.toString("utf8")));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

function p0cfg(cfg) {
  return {
    world: cfg.world,
    player: {
      startX: 0, goalX: 0, width: cfg.player.width, height: cfg.player.height,
      y: cfg.player.y, maxSpeed: 1,
    },
    hazard: {
      startX: cfg.hazard.at, distance: cfg.hazard.distance, periodMs: cfg.hazard.periodMs,
      width: cfg.hazard.width, height: cfg.hazard.height, anchorX: cfg.hazard.anchorX,
      anchorY: 1, y: cfg.hazard.y, axis: "x",
    },
    certainty: { phase: "known", hitbox: "known" },
    options: { lagMs: 0 },
  };
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/* ------------------------------------------------------------------ */

function runAll(c) {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  const m = {};

  /* 1. 严格相交谓词 ------------------------------------------------ */
  m.predicate = c.predicate.map((pc) => {
    const got = C.overlapsStrict(pc.a, pc.b);
    check(`predicate:${pc.id}`, got === pc.expect, { got, expect: pc.expect, note: pc.note });
    return { id: pc.id, got, expect: pc.expect };
  });

  /* 2. 三角波 ------------------------------------------------------ */
  const w = c.wave;
  const wave = { positions: [], symmetry: [], continuity: [], speed: C.triangleSpeed(w.params.distance, w.params.periodMs), stationary: [] };
  for (const p of w.positions) {
    const got = C.trianglePosition(w.params.at, w.params.distance, w.params.periodMs, p.t);
    check(`wave:pos:${p.t}`, close(got, p.expect, 1e-12), { got, expect: p.expect });
    wave.positions.push({ t: p.t, got, expect: p.expect });
  }
  check("wave:speed", close(wave.speed, w.speed, 1e-15), { got: wave.speed, expect: w.speed });
  for (const [a, b] of w.symmetryPairs) {
    const pa = C.trianglePosition(w.params.at, w.params.distance, w.params.periodMs, a);
    const pb = C.trianglePosition(w.params.at, w.params.distance, w.params.periodMs, b);
    check(`wave:sym:${a}`, close(pa, pb, 1e-12), { pa, pb });
    wave.symmetry.push({ t: a, pAtT: pa, pAtNegT: pb });
  }
  for (const p of w.turnaroundContinuity) {
    const got = C.trianglePosition(w.params.at, w.params.distance, w.params.periodMs, p.t);
    check(`wave:turn:${p.t}`, close(got, p.expect, 1e-12), { got, expect: p.expect });
    wave.continuity.push({ t: p.t, got, expect: p.expect });
  }
  for (const p of w.stationary.positions) {
    const got = C.trianglePosition(w.stationary.at, w.stationary.distance, w.stationary.periodMs, p.t);
    check(`wave:still:${p.t}`, got === p.expect, { got, expect: p.expect });
    wave.stationary.push({ t: p.t, got, expect: p.expect });
  }
  m.wave = wave;

  /* 3. 线段求交 ---------------------------------------------------- */
  m.segments = [];
  for (const sc of c.segments) {
    if (sc.predicateOnly) {
      const got = C.overlapsStrict(sc.a, sc.b);
      check(`segment:${sc.id}`, got === sc.expect.hit, { got, expect: sc.expect.hit, note: sc.note });
      m.segments.push({ id: sc.id, predicate: got, expect: sc.expect.hit, note: sc.note });
      continue;
    }
    const r = C.segmentCollides(sc.segment, sc.config, sc.opts ?? {});
    const entry = { id: sc.id, ok: r.ok, hit: r.hit, intervals: r.intervals, note: sc.note };
    m.segments.push(entry);
    if (!r.ok) {
      check(`segment:${sc.id}:ok`, false, { error: r.error });
      continue;
    }
    check(`segment:${sc.id}:hit`, r.hit === sc.expect.hit, { got: r.hit, expect: sc.expect.hit });
    check(`segment:${sc.id}:count`, r.intervals.length === sc.expect.intervals.length, {
      got: r.intervals.length, expect: sc.expect.intervals.length,
    });
    if (r.intervals.length === sc.expect.intervals.length) {
      for (let i = 0; i < r.intervals.length; i += 1) {
        const [lo, hi] = r.intervals[i];
        const [elo, ehi] = sc.expect.intervals[i];
        check(`segment:${sc.id}:i${i}:lo`, close(lo, elo, sc.expect.tol), { got: lo, expect: elo });
        check(`segment:${sc.id}:i${i}:hi`, close(hi, ehi, sc.expect.tol), { got: hi, expect: ehi });
      }
    }
    if (sc.expect.gapMax !== undefined && r.intervals.length === 2) {
      const gap = r.intervals[1][0] - r.intervals[0][1];
      check(`segment:${sc.id}:gap`, gap > 0 && gap < sc.expect.gapMax, { gap, max: sc.expect.gapMax });
      entry.gap = gap;
    }
  }

  /* 4. 非有限输入 -------------------------------------------------- */
  m.errors = [];
  for (const ec of c.errors) {
    const r = C.segmentCollides(ec.segment, ec.config, ec.opts ?? {});
    const ok = r.ok === false && r.error === ec.expect;
    check(`error:${ec.id}`, ok, { got: r.ok ? "no-error" : r.error, expect: ec.expect, note: ec.note });
    m.errors.push({ id: ec.id, ok: r.ok, error: r.error ?? null, expect: ec.expect });
  }

  /* 5. 采样陷阱 ---------------------------------------------------- */
  m.sampling = [];
  for (const d of c.sampling) {
    const r = C.segmentCollides(d.segment, d.config);
    const entry = { id: d.id, hit: r.hit, intervals: r.intervals, note: d.note, scans: [] };
    if (d.expectIntervals) {
      check(`sampling:${d.id}:analytic-hit`, r.hit === true, { hit: r.hit });
      check(`sampling:${d.id}:analytic-count`, r.intervals.length === d.expectIntervals.length, {
        got: r.intervals.length, expect: d.expectIntervals.length,
      });
      for (let i = 0; i < Math.min(r.intervals.length, d.expectIntervals.length); i += 1) {
        check(`sampling:${d.id}:i${i}:lo`, close(r.intervals[i][0], d.expectIntervals[i][0], 1e-9), {
          got: r.intervals[i][0], expect: d.expectIntervals[i][0],
        });
        check(`sampling:${d.id}:i${i}:hi`, close(r.intervals[i][1], d.expectIntervals[i][1], 1e-9), {
          got: r.intervals[i][1], expect: d.expectIntervals[i][1],
        });
      }
    }
    if (d.expectHit !== undefined) {
      check(`sampling:${d.id}:analytic-hit`, r.hit === d.expectHit, { got: r.hit, expect: d.expectHit });
    }
    for (const n of d.sampleCounts ?? []) {
      const scan = C.sampleScan(d.segment, d.config, n);
      check(`sampling:${d.id}:miss@${n}`, scan.hits.length === 0, { hits: scan.hits, samples: n });
      entry.scans.push({ samples: n, hits: scan.hits.length });
    }
    if (d.frameSamples) {
      const scan = C.sampleScan(d.segment, d.config, d.frameSamples);
      check(`sampling:${d.id}:miss@frame`, scan.hits.length === 0, { hits: scan.hits, samples: d.frameSamples });
      entry.scans.push({ samples: d.frameSamples, hits: scan.hits.length, note: "16.67ms" });
    }
    m.sampling.push(entry);
  }

  /* 6. ε ------------------------------------------------------------ */
  m.epsilon = { worlds: [], gates: [], verdicts: [] };
  for (const ew of c.epsilon.worlds) {
    const got = C.epsilonFor(ew.world);
    check(`eps:world:${ew.world.xMax - ew.world.xMin}`, close(got, ew.expectEps, Math.max(1e-15, ew.expectEps * 1e-12)), {
      got, expect: ew.expectEps,
    });
    m.epsilon.worlds.push({ span: ew.world.xMax - ew.world.xMin, got, expect: ew.expectEps });
  }
  for (const eg of c.epsilon.gates) {
    const h = { at: 50, distance: 100, periodMs: 2000, width: eg.width, height: 100, anchorX: 0.5 };
    const g = C.gateInterval(h);
    const width = g.R - g.L;
    check(`eps:gate:${eg.id}`, close(width, eg.expectWidth, 1e-12), { got: width, expect: eg.expectWidth });
    m.epsilon.gates.push({ id: eg.id, L: g.L, R: g.R, width, expectWidth: eg.expectWidth });
  }
  for (const ev of c.epsilon.verdicts) {
    const eps = C.epsilonFor({ xMin: 0, xMax: ev.worldWidth });
    const valid = ev.gateWidth > eps;
    check(`eps:verdict:${ev.worldWidth}:${ev.gateWidth}`, valid === ev.expectValid, { valid, expect: ev.expectValid, eps });
    m.epsilon.verdicts.push({ worldWidth: ev.worldWidth, gateWidth: ev.gateWidth, eps, valid, expectValid: ev.expectValid });
  }

  /* 7. 与 P0 的定向差异 -------------------------------------------- */
  m.p0Probes = [];
  for (const p of c.p0Probes) {
    if (p.segmentInterval) {
      const p0Interval = P0.segmentCollides(p.segmentInterval, p0cfg(p.config), 0);
      const p0Point = P0.segmentCollides(p.segmentPoint, p0cfg(p.config), 0);
      const minePoint = C.segmentCollides(p.segmentPoint, p.config);
      check(`p0:${p.id}:interval`, (p0Interval !== null) === p.expectIntervalHit, { got: p0Interval !== null });
      check(`p0:${p.id}:point`, (p0Point !== null) === p.expectPointHit, { got: p0Point !== null });
      m.p0Probes.push({
        id: p.id, note: p.note,
        p0IntervalHit: p0Interval !== null, expectIntervalHit: p.expectIntervalHit,
        p0PointHit: p0Point !== null, expectPointHit: p.expectPointHit,
        minePointHit: minePoint.hit,
      });
      continue;
    }
    if (p.lagMs !== undefined) {
      const pad = C.segmentCollides(p.segment, p.config, { lagMs: p.lagMs, lagMode: "pad" });
      const none = C.segmentCollides(p.segment, p.config, { lagMs: p.lagMs, lagMode: "none" });
      const reach = C.exactReachableSpanAt(p.config.hazard, p.segment.t0, p.lagMs);
      const playerBox = C.playerBoxAt(p.config.player, p.segment.x0);
      const reachHit = C.overlapsStrict(playerBox, {
        x: reach.left, y: p.config.hazard.y, w: reach.right - reach.left, h: p.config.hazard.height,
      });
      check(`p0:${p.id}:pad`, pad.hit === p.expectPadHit, { got: pad.hit });
      check(`p0:${p.id}:reach`, reachHit === p.expectExactReachableHit, { got: reachHit });
      const p0Pad = P0.segmentCollides(p.segment, p0cfg(p.config), p.lagMs) !== null;
      check(`p0:${p.id}:p0-pad`, p0Pad === p.expectPadHit, { got: p0Pad });
      m.p0Probes.push({
        id: p.id, note: p.note, padHit: pad.hit, p0PadHit: p0Pad, exactNoLagHit: none.hit,
        reachableHit: reachHit, reachableSpan: reach,
        expectPadHit: p.expectPadHit, expectReachableHit: p.expectExactReachableHit,
      });
      continue;
    }
    const mine = C.segmentCollides(p.segment, p.config);
    const p0 = P0.segmentCollides(p.segment, p0cfg(p.config), 0);
    check(`p0:${p.id}:mine`, mine.hit === p.expectMineHit, { got: mine.hit, expect: p.expectMineHit });
    check(`p0:${p.id}:p0`, (p0 !== null) === p.expectP0Hit, { got: p0 !== null, expect: p.expectP0Hit });
    m.p0Probes.push({
      id: p.id, note: p.note, mineHit: mine.hit, p0Hit: p0 !== null,
      expectMineHit: p.expectMineHit, expectP0Hit: p.expectP0Hit,
    });
  }

  /* 7b. 竖直边界附近的确定性枚举 ---------------------------------- */
  m.nearCritical = [];
  for (const nc of c.nearCritical.cases) {
    const cfg = {
      world: { xMin: 0, xMax: 2000 },
      player: c.nearCritical.player,
      hazard: { ...c.nearCritical.hazard, y: 16 + nc.yOffset },
    };
    const mine = C.segmentCollides(c.nearCritical.segment, cfg);
    const p0 = P0.segmentCollides(c.nearCritical.segment, p0cfg(cfg), 0) !== null;
    const kind = mine.hit && p0 ? "both-hit" : !mine.hit && !p0 ? "both-miss" : mine.hit ? "exact-only" : "p0-only";
    check(`nearCritical:${nc.yOffset}`, kind === nc.expect, { kind, expect: nc.expect });
    m.nearCritical.push({ yOffset: nc.yOffset, overlapY: -nc.yOffset, mineHit: mine.hit, p0Hit: p0, kind, expect: nc.expect });
  }

  /* 8. 随机差分 ---------------------------------------------------- */
  const rnd = lcg(c.p0Random.seed);
  const p0Mode = {
    intervalTol: 1e-9, slopeClamp: 1e-9, constTol: 1e-9, cutEps: 1e-9, dtEps: 1e-9, yMode: "p0",
  };
  const stats = { cases: 0, bothHit: 0, bothMiss: 0, mineOnly: 0, p0Only: 0, p0EmulationMismatch: 0 };
  const divergences = [];
  for (let i = 0; i < c.p0Random.count; i += 1) {
    const cfg = {
      world: { xMin: 0, xMax: 2000 },
      player: { y: 0, height: pick(rnd, [8, 16]), width: pick(rnd, [1, 2, 4, 7]) },
      hazard: {
        at: -50 + Math.floor(rnd() * 201),
        distance: pick(rnd, [0, 1, 10, 50, 100]),
        periodMs: pick(rnd, [100, 200, 1000, 2000]),
        width: pick(rnd, [2, 10, 20]),
        height: pick(rnd, [10, 100]),
        anchorX: pick(rnd, [0, 0.25, 0.5, 1]),
        y: pick(rnd, [0, 1000]),
      },
    };
    const dt = pick(rnd, [1, 5, 20, 100]);
    const seg = {
      t0: pick(rnd, [-500, -100, 0, 50, 500]),
      x0: pick(rnd, [-20, 0, 50, 100, 150]),
      x1: pick(rnd, [-20, 0, 50, 100, 150]),
      t1: 0,
    };
    seg.t1 = seg.t0 + dt;

    const mine = C.segmentCollides(seg, cfg);
    const emu = C.segmentCollides(seg, cfg, p0Mode);
    const p0 = P0.segmentCollides(seg, p0cfg(cfg), 0) !== null;
    stats.cases += 1;
    if (mine.hit && p0) stats.bothHit += 1;
    else if (!mine.hit && !p0) stats.bothMiss += 1;
    else if (mine.hit && !p0) {
      stats.mineOnly += 1;
      if (divergences.length < 10) divergences.push({ i, kind: "exact-only", seg, cfg, mine: mine.intervals, p0 });
    } else {
      stats.p0Only += 1;
      if (divergences.length < 10) divergences.push({ i, kind: "p0-only", seg, cfg, mine: mine.intervals, p0 });
    }
    if (emu.hit !== p0) {
      stats.p0EmulationMismatch += 1;
      if (divergences.length < 10) divergences.push({ i, kind: "emulation-mismatch", seg, cfg, emu: emu.hit, p0 });
    }
  }
  check("p0:random:emulation", stats.p0EmulationMismatch === 0, stats);
  m.random = { seed: c.p0Random.seed, ...stats, divergenceExamples: divergences };

  return { measurements: m, checks };
}

/* ------------------------------------------------------------------ */

const first = runAll(cases);
const second = runAll(cases);
const deterministicInProcess = JSON.stringify(first.measurements) === JSON.stringify(second.measurements);
first.checks.push({ id: "determinism:in-process", ok: deterministicInProcess });

const failed = first.checks.filter((x) => !x.ok);
const payload = {
  meta: {
    ticket: "I02-03",
    effort: "level-playability-v1.1-i02",
    note: "scratch-only feasibility experiment; not production acceptance",
    node: process.version,
    inputsSha256: sha256(inputsBytes),
    p0ModelSha256: sha256(readFileSync(join(here, "../../../level-playability-v1.1-p0/prototype/temporal-model.mjs"))),
    coreSha256: sha256(readFileSync(join(here, "core.mjs"))),
  },
  determinism: {
    inProcess: deterministicInProcess,
    measurementSha256: sha256(JSON.stringify(first.measurements)),
  },
  summary: {
    checks: first.checks.length,
    passed: first.checks.length - failed.length,
    failed: failed.length,
  },
  failures: failed,
  measurements: first.measurements,
};

writeFileSync(join(here, "outputs", "run.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify(payload.summary));
console.log("determinism.inProcess =", deterministicInProcess);
console.log("measurementSha256 =", payload.determinism.measurementSha256);
if (failed.length) {
  console.log("FAILURES:");
  for (const f of failed) console.log(" -", f.id, JSON.stringify(f.detail ?? {}));
  process.exit(1);
}
