/**
 * I02-04 · 图割 / forbiddenBoxes / hopSamples 实验运行器。
 * 读取 `inputs/cases.json`，断言，写 `outputs/run.json`；失败退出码 1。
 * 复现：node build-inputs.mjs && node run.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ROOT, loadFixture, scenarioConfig, build, expandRect,
  hopSamplesN, reachN, productReach, movementNeighbors, hopSamples, sampleWithRects,
} from "./core.mjs";
import { maxJumpHeight } from "../../../../packages/contracts/dist/game-config.js";

const here = dirname(fileURLToPath(import.meta.url));
const inputsBytes = readFileSync(join(here, "inputs", "cases.json"));
const cases = JSON.parse(inputsBytes.toString("utf8"));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const { manifest, config, move } = loadFixture();
const player = { w: 32, h: 48 };  // last-train 玩家；run.mjs 会从图里复核

function runAll(c) {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  const m = {};

  const cfgOf = (s) => scenarioConfig(config, {
    terrain: s.terrain,
    entities: s.entities ?? [],
    worldWidth: s.world?.w,
    worldHeight: s.world?.h,
  });
  const goalIn = (seen, goal) => seen.has(`${goal.x},${goal.y}`);

  /* 0. 夹具与玩家几何 ---------------------------------------------- */
  {
    const g = build(cfgOf(c.baseline), manifest);
    m.player = { w: g.player.size.w, h: g.player.size.h, foot: g.player.foot };
    check("player:size", g.player.size.w === player.w && g.player.size.h === player.h, m.player);
    check("start:has-40,250", g.standableAt(40, 250), { standable: g.standableAt(40, 250) });
  }

  /* 1. 基线：产品 BFS vs scratch 60Hz ------------------------------ */
  {
    const g = build(cfgOf(c.baseline), manifest);
    const p = productReach(g, move);
    const s60 = reachN(g, g.startCells(), move, { hz: 60 });
    const s120 = reachN(g, g.startCells(), move, { hz: 120 });
    const pList = [...p].sort();
    const s60List = [...s60].sort();
    check("baseline:product-equals-scratch60", JSON.stringify(pList) === JSON.stringify(s60List), {
      product: p.size, scratch60: s60.size,
    });
    check("baseline:goal", goalIn(p, c.baseline.goalCell), { goal: c.baseline.goalCell });
    check("baseline:60-vs-120", JSON.stringify([...s60].sort()) === JSON.stringify([...s120].sort()), {
      n60: s60.size, n120: s120.size,
    });
    m.baseline = { product: p.size, scratch60: s60.size, scratch120: s120.size, goal: goalIn(p, c.baseline.goalCell) };
  }

  /* 2. forbidden 语义 ---------------------------------------------- */
  {
    const s = c.semantics;
    const g = build(scenarioConfig(config, { terrain: s.terrain, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, [s.gate]);
    const rect = expandRect(s.gate, s.world.w, s.world.h, player.w, player.h);
    const rectOk = ["x0", "x1", "y0", "y1"].every((k) => rect[k] === s.gateRect[k]);
    check("semantics:gate-rect", rectOk, { got: rect, expect: s.gateRect });

    const inGate = s.gateProbe.x * g.stride + s.gateProbe.y;
    check("semantics:freeAt-false", g.freeAt(s.gateProbe.x, s.gateProbe.y) === false);
    check("semantics:forbidden-1", g.forbidden[inGate] === 1);
    check("semantics:blocked-0 (no support)", g.blocked[inGate] === 0);
    check("semantics:standableAt-hazard-top-false", g.standableAt(s.gateTopProbe.x, s.gateTopProbe.y) === false, {
      standable: g.standableAt(s.gateTopProbe.x, s.gateTopProbe.y),
    });

    const nb = movementNeighbors(g, s.approach.x, s.approach.y);
    check("semantics:walk-cannot-enter", !nb.some((e) => e.x === s.approach.x + 1), { neighbors: nb.slice(0, 6) });

    const hr = hopSamples(g, s.hopReject.ax, s.hopReject.ay, s.hopReject.bx, s.hopReject.by, move);
    check("semantics:hop-rejects-crossing-arc", hr === null, { hit: hr !== null });

    m.semantics = {
      gateRect: rect,
      freeAt: g.freeAt(s.gateProbe.x, s.gateProbe.y),
      standableAtTop: g.standableAt(s.gateTopProbe.x, s.gateTopProbe.y),
      hopReject: hr === null,
      walkNeighbors: nb.filter((e) => e.x <= s.approach.x + 2).map((e) => `${e.x},${e.y},${e.kind}`),
    };
  }

  /* 2b. 世界外按自由空间处理（抛物线采样） ------------------------- */
  {
    const s = c.semantics.smallWorld;
    const g = build(scenarioConfig(config, { terrain: s.terrain, worldWidth: s.world.w, worldHeight: s.world.h }), manifest);
    const samples = hopSamplesN(g, s.edge.ax, s.edge.ay, s.edge.bx, s.edge.by, move, {});
    const apex = maxJumpHeight(move);
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * (s.edge.ay - s.edge.by);
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    const dx = s.edge.bx - s.edge.ax;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    let outside = 0;
    let counterfactualReject = false;
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      const tt = t * f;
      const px = Math.round(s.edge.ax + dx * f);
      const py = Math.round(s.edge.ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (px < 0 || px > g.width || py < 0 || py > g.height) {
        outside += 1;
        // 反事实：若把界外点当作禁区，该弧会被拒绝。
        counterfactualReject = true;
      }
    }
    check("semantics:out-of-world-sample-occurs", outside > 0, { outside, samples: samples?.length ?? 0 });
    check("semantics:out-of-world-not-judged", samples !== null, { samples: samples?.length ?? 0 });
    check("semantics:grid-out-of-bounds-not-free", g.freeAt(-1, 50) === false && g.freeAt(g.width + 1, 50) === false);
    m.outOfWorld = { outsideSamples: outside, edgeAccepted: samples !== null, counterfactualReject };
  }

  /* 3. N1：门上方平台可绕过 --------------------------------------- */
  {
    const s = c.N1;
    const gFlat = build(scenarioConfig(config, { terrain: s.flat, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, [s.gate]);
    const gPlat = build(scenarioConfig(config, { terrain: s.withPlatform, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, [s.gate]);
    const flat60 = reachN(gFlat, gFlat.startCells(), move, { hz: 60 });
    const plat60 = reachN(gPlat, gPlat.startCells(), move, { hz: 60 });
    const plat120 = reachN(gPlat, gPlat.startCells(), move, { hz: 120 });
    check("N1:flat-goal-false", goalIn(flat60, s.goalCell) === s.expectFlatGoal);
    check("N1:platform-goal-true", goalIn(plat60, s.goalCell) === s.expectPlatformGoal);
    check("N1:platform-60-vs-120", goalIn(plat60, s.goalCell) === goalIn(plat120, s.goalCell));
    check("N1:platform-standable-650,210", gPlat.standableAt(650, 210) === true);
    m.N1 = {
      flatGoal60: goalIn(flat60, s.goalCell),
      platformGoal60: goalIn(plat60, s.goalCell),
      platformGoal120: goalIn(plat120, s.goalCell),
      platformCells60: plat60.size,
      platformStandable650_210: gPlat.standableAt(650, 210),
    };
  }

  /* 4. N2：门下坑道可绕行 ----------------------------------------- */
  {
    const s = c.N2;
    const gFlat = build(scenarioConfig(config, { terrain: s.flat, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, [s.gate]);
    const gPit = build(scenarioConfig(config, { terrain: s.withPit, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, [s.gate]);
    const flat60 = reachN(gFlat, gFlat.startCells(), move, { hz: 60 });
    const pit60 = reachN(gPit, gPit.startCells(), move, { hz: 60 });
    const pit120 = reachN(gPit, gPit.startCells(), move, { hz: 120 });
    check("N2:flat-goal-false", goalIn(flat60, s.goalCell) === s.expectFlatGoal);
    check("N2:pit-goal-true", goalIn(pit60, s.goalCell) === s.expectPitGoal);
    check("N2:pit-60-vs-120", goalIn(pit60, s.goalCell) === goalIn(pit120, s.goalCell));
    check("N2:pit-standable-700,260", gPit.standableAt(700, 260) === true);
    m.N2 = {
      flatGoal60: goalIn(flat60, s.goalCell),
      pitGoal60: goalIn(pit60, s.goalCell),
      pitGoal120: goalIn(pit120, s.goalCell),
      pitCells60: pit60.size,
      pitStandable700_260: gPit.standableAt(700, 260),
    };
  }

  /* 5. N7a：边级反向翻转 ------------------------------------------ */
  {
    const s = c.N7a;
    const g = build(scenarioConfig(config, { terrain: s.terrain, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, s.forbiddenBoxes);
    const e60 = hopSamplesN(g, s.edge.ax, s.edge.ay, s.edge.bx, s.edge.by, move, { hz: 60 });
    const e120 = hopSamplesN(g, s.edge.ax, s.edge.ay, s.edge.bx, s.edge.by, move, { hz: 120 });
    check("N7a:edge60-reject", (e60 !== null) === s.expectEdge60);
    check("N7a:edge120-accept", (e120 !== null) === s.expectEdge120);
    const r60 = reachN(g, g.startCells(), move, { hz: 60 });
    const r120 = reachN(g, g.startCells(), move, { hz: 120 });
    check("N7a:goal60", goalIn(r60, s.goalCell) === s.expectGoal60);
    check("N7a:goal120", goalIn(r120, s.goalCell) === s.expectGoal120);
    const crossing = (hz) => {
      let n = 0;
      const left = [];
      const right = [];
      for (let x = 0; x <= g.width; x += 1) {
        if (g.standableAt(x, 250) && x <= 630) left.push(x);
        if (g.standableAt(x, 231) && x >= 666) right.push(x);
      }
      for (const ax of left) for (const bx of right) if (hopSamplesN(g, ax, 250, bx, 231, move, { hz })) n += 1;
      return { n, left: left.length, right: right.length };
    };
    m.N7a = {
      edge60: e60 !== null,
      edge120: e120 !== null,
      goal60: goalIn(r60, s.goalCell),
      goal120: goalIn(r120, s.goalCell),
      crossing60: crossing(60),
      crossing120: crossing(120),
    };
  }

  /* 6. N7b：图级正向翻转 ------------------------------------------ */
  {
    const s = c.N7b;
    const g = build(scenarioConfig(config, { terrain: s.terrain, worldWidth: s.world.w, worldHeight: s.world.h }), manifest, s.forbiddenBoxes);
    const r60 = reachN(g, g.startCells(), move, { hz: 60 });
    const r120 = reachN(g, g.startCells(), move, { hz: 120 });
    const right = (seen) => [...seen].filter((k) => Number(k.split(",")[0]) >= 640).length;
    check("N7b:goal60", goalIn(r60, s.goalCell) === s.expectGoal60, { got: goalIn(r60, s.goalCell) });
    check("N7b:goal120", goalIn(r120, s.goalCell) === s.expectGoal120, { got: goalIn(r120, s.goalCell) });
    check("N7b:right60", right(r60) >= s.expectRight60Min, { got: right(r60) });
    check("N7b:right120", right(r120) === s.expectRight120, { got: right(r120) });
    const crossing = (hz) => {
      let n = 0;
      const left = [];
      const rightCells = [];
      for (let x = 0; x <= g.width; x += 1) {
        if (g.standableAt(x, 250) && x <= 616) left.push(x);
        if (g.standableAt(x, 250) && x >= 624) rightCells.push(x);
      }
      for (const ax of left) for (const bx of rightCells) if (hopSamplesN(g, ax, 250, bx, 250, move, { hz })) n += 1;
      return { n, left: left.length, right: rightCells.length };
    };
    m.N7b = {
      goal60: goalIn(r60, s.goalCell),
      goal120: goalIn(r120, s.goalCell),
      right60: right(r60),
      right120: right(r120),
      crossing60: crossing(60),
      crossing120: crossing(120),
    };
  }

  /* 7. 扫描：采样密度对边 / 图连通性的影响 ------------------------ */
  const rndOf = (seed) => {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  };

  // 7a. 边级：把禁区角点放到采样点附近，最大化边界敏感度
  {
    const { seed, trials } = c.sweeps.edge;
    const rnd = rndOf(seed);
    const W = 1440;
    const H = 270;
    const counts = { forward: 0, reverse: 0 };
    const examples = [];
    for (let it = 0; it < trials; it += 1) {
      const ax = 600 + Math.floor(rnd() * 40);
      const bx = ax + 5 + Math.floor(rnd() * 55);
      const by = 250 - Math.floor(rnd() * 56);
      // 取一条粗采样点，把禁区外扩矩形的角放到它附近
      const base = { hz: 60, maxSamples: 120 };
      const disc = move.jumpVelocity ** 2 - 2 * move.gravity * (250 - by);
      const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
      const n = Math.max(6, Math.min(120, Math.ceil(t * base.hz)));
      const k = Math.floor(rnd() * (n + 1));
      const f = k / n;
      const px = Math.round(ax + (bx - ax) * f);
      const py = Math.round(250 - (move.jumpVelocity * (t * f) - (move.gravity * (t * f) ** 2) / 2));
      const box = {
        x: px - 16 + (rnd() - 0.5) * 6,
        y: py - 1 + (rnd() - 0.5) * 3,
        w: 0.5 + rnd() * 3,
        h: 0.5 + rnd() * 10,
      };
      const rect = expandRect(box, W, H, player.w, player.h);
      const a = sampleWithRects(ax, 250, bx, by, move, [rect], { hz: 60 }, { w: W, h: H });
      const b = sampleWithRects(ax, 250, bx, by, move, [rect], { hz: 120 }, { w: W, h: H });
      if (a === b) continue;
      if (a) counts.forward += 1; else counts.reverse += 1;
      if (examples.length < 4) examples.push({ ax, ay: 250, bx, by, box, rect, hit60: !a, hit120: !b });
    }
    check("sweep:edge-has-both-directions", counts.reverse > 0, counts);
    m.sweepEdge = { seed, trials, ...counts, examples };
  }

  // 7b. 图级：任意一条跨沟 hop 被接受 ⇒ 两侧连通（平台内部连通）
  {
    const runGraphSweep = (family) => {
      const rnd = rndOf(family.seed);
      const counts = { forward: 0, reverse: 0, both: 0, total: family.trials, none: 0 };
      const examples = [];
      for (let it = 0; it < family.trials; it += 1) {
        const gap = 25 + Math.floor(rnd() * 40);
        const wl = 560 + Math.floor(rnd() * 40);
        const yR = family.varied ? [210, 220, 230, 240, 250][Math.floor(rnd() * 5)] : 250;
        const leftTerr = { x: 0, y: 250, w: wl, h: 20 };
        const rightTerr = { x: wl + gap, y: yR, w: 800 - (wl + gap), h: 270 - yR };
        const lr = expandRect(leftTerr, 800, 270, player.w, player.h);
        const rr = expandRect(rightTerr, 800, 270, player.w, player.h);
        const box = {
          x: wl - 20 + rnd() * (gap + 40),
          y: yR - 30 + rnd() * 35,
          w: 0.5 + rnd() * 6,
          h: 2 + rnd() * 20,
        };
        const br = expandRect(box, 800, 270, player.w, player.h);
        const rects = [lr, rr, br];
        // 只有既在平台支撑范围内、又不在禁区内（即真实 standable）的脚点才参与。
        const inRect = (x, r) => x >= r.x0 && x <= r.x1;
        const blockedByBox = (x, y) => x >= br.x0 && x <= br.x1 && y >= br.y0 && y <= br.y1;
        let a60 = 0;
        let a120 = 0;
        for (let ax = lr.x0; ax <= lr.x1; ax += 1) {
          if (blockedByBox(ax, 250)) continue;
          for (let bx = rr.x0; bx <= rr.x1; bx += 1) {
            if (blockedByBox(bx, yR)) continue;
            if (sampleWithRects(ax, 250, bx, yR, move, rects, { hz: 60 }, { w: 800, h: 270 })) a60 += 1;
            if (sampleWithRects(ax, 250, bx, yR, move, rects, { hz: 120 }, { w: 800, h: 270 })) a120 += 1;
          }
        }
        if (a60 === 0 && a120 === 0) { counts.none += 1; continue; }
        if (a60 === a120) { counts.both += 1; continue; }
        if (a60 > 0 && a120 === 0) counts.forward += 1;
        else if (a60 === 0 && a120 > 0) counts.reverse += 1;
        else { counts.both += 1; continue; }
        if (examples.length < 3) examples.push({ wl, gap, yR, box, cross60: a60 > 0, cross120: a120 > 0, n60: a60, n120: a120 });
      }
      return { seed: family.seed, varied: !!family.varied, ...counts, examples };
    };
    m.sweepGraphSameHeight = runGraphSweep({ ...c.sweeps.graphSameHeight, varied: false });
    m.sweepGraphVariedHeight = runGraphSweep({ ...c.sweeps.graphVariedHeight, varied: true });
    check("sweep:graph-forward-exists",
      m.sweepGraphSameHeight.forward + m.sweepGraphVariedHeight.forward > 0,
      { same: m.sweepGraphSameHeight.forward, varied: m.sweepGraphVariedHeight.forward });
    check("sweep:graph-reverse-absent",
      m.sweepGraphSameHeight.reverse === 0 && m.sweepGraphVariedHeight.reverse === 0,
      { same: m.sweepGraphSameHeight.reverse, varied: m.sweepGraphVariedHeight.reverse });
  }

  return { measurements: m, checks };
}

/* ------------------------------------------------------------------ */

const first = runAll(cases);
const second = runAll(cases);
const deterministicInProcess = JSON.stringify(first.measurements) === JSON.stringify(second.measurements);
first.checks.push({ id: "determinism:in-process", ok: deterministicInProcess });

const failed = first.checks.filter((x) => !x.ok);
const hashOf = (rel) => sha256(readFileSync(ROOT + rel));
const payload = {
  meta: {
    ticket: "I02-04",
    effort: "level-playability-v1.1-i02",
    note: "scratch-only; product code read-only; not production acceptance",
    node: process.version,
    inputsSha256: sha256(inputsBytes),
    sources: {
      "packages/contracts/src/playability/graph.ts": hashOf("packages/contracts/src/playability/graph.ts"),
      "packages/contracts/src/playability/reach.ts": hashOf("packages/contracts/src/playability/reach.ts"),
      "packages/contracts/dist/playability/graph.js": hashOf("packages/contracts/dist/playability/graph.js"),
      "packages/contracts/src/game-config.ts": hashOf("packages/contracts/src/game-config.ts"),
      "fixtures/game-configs/last-train.json": hashOf("fixtures/game-configs/last-train.json"),
      "fixtures/packs/last-train/v2/manifest.json": hashOf("fixtures/packs/last-train/v2/manifest.json"),
    },
  },
  determinism: { inProcess: deterministicInProcess, measurementSha256: sha256(JSON.stringify(first.measurements)) },
  summary: { checks: first.checks.length, passed: first.checks.length - failed.length, failed: failed.length },
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
