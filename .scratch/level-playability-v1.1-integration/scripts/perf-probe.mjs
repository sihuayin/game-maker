#!/usr/bin/env node
/**
 * I00-06 性能取证探针 —— 只读扫描 P0 冻结时序模型（不修改、不复制进产品）。
 *
 *   node --expose-gc .scratch/level-playability-v1.1-integration/scripts/perf-probe.mjs \
 *     --out .scratch/level-playability-v1.1-integration/evidence/06-perf
 *
 * 产出（全部落在 --out 目录，只写本 effort 的证据目录）：
 *   meta.json            环境、命令、SHA、检查项
 *   corpus.json          现有语料（21 config / 19 moving hazard）的真实量级 + 语料分析运行
 *   growth.json          world 宽度 / distance / periodMs / phaseSteps 扫掠与线性拟合
 *   repeats.json         同一输入重复 N 次的 elapsedMs 分布
 *   budget-boundary.json 极端 timeBudgetMs / maxStates 下的三态边界
 *
 * 只读：不写任何被扫描文件、不改 packages/**、fixtures/**、P0 目录。
 * 零新依赖：只用 Node 内置模块 + P0 原型（只读 import）。
 *
 * 约定：
 *   - 合成用例使用与 P0 相同的输入约定：`world.xMax = 视觉世界宽 - 玩家宽`，
 *     x 网格左边界上限为 `xMax - 玩家宽`（P0 案例 A 即 1440 → xMax 1408 → 网格 1376）。
 *   - “最坏用例”把 goal 永久放在 hazard 必覆盖区间里，但**不构成**永久封锁门
 *     （目标本身在门内 ⇒ provePermanentGate 返回 null），因此 BFS 会耗尽可达状态、
 *     落 `INSUFFICIENT_EVIDENCE / no-witness-found`；这正是我们想计时的全搜索路径。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_VERSION = "i00-06-perf-probe/1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, "..");
const ROOT = path.resolve(EFFORT, "../..");
const MODEL_REL = ".scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs";
const MODEL_PATH = path.join(ROOT, MODEL_REL);
const INVENTORY_REL = ".scratch/level-playability-v1/corpus/inventory.json";
const INVENTORY_PATH = path.join(ROOT, INVENTORY_REL);
const DEFAULT_OUT = path.join(EFFORT, "evidence/06-perf");

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = path.resolve(argOf("--out", DEFAULT_OUT));

const { analyze } = await import(pathToFileURL(MODEL_PATH).href);

// ── 小工具 ────────────────────────────────────────────────────────────────
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const sha256File = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const round = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const pct = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const dist = (xs) => ({
  n: xs.length,
  min: round(Math.min(...xs)),
  p50: round(pct(xs, 0.5)),
  p90: round(pct(xs, 0.9)),
  max: round(Math.max(...xs)),
  mean: round(mean(xs)),
  sd: round(sd(xs)),
});
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

function linearFit(points) {
  const n = points.length;
  if (n < 2) return null;
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return { n, slope: 0, intercept: sy / n, r2: 1 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const yMean = sy / n;
  const ssTot = points.reduce((a, p) => a + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  return { n, slope, intercept, r2: ssTot > 1e-12 ? 1 - ssRes / ssTot : 1 };
}

/** 复刻 P0 的 x 网格计数（不调用内部函数，保持探针只依赖公开导出）。 */
function xGridValues({ xMin, xMax, width, startX, goalX, xStep }) {
  const maxLeft = xMax - width;
  const values = new Set([xMin, maxLeft, startX, goalX]);
  const n = Math.floor((maxLeft - xMin) / xStep);
  for (let i = 0; i <= n; i += 1) {
    const x = xMin + i * xStep;
    if (x <= maxLeft + 1e-9) values.add(Math.round(x * 1e6) / 1e6);
  }
  return [...values].filter((x) => x >= xMin - 1e-9 && x <= maxLeft + 1e-9);
}

function runCase(label, config, extra = {}) {
  const gc = global.gc;
  if (gc) gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = process.hrtime.bigint();
  const result = analyze(config);
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const heapDeltaKiB = (process.memoryUsage().heapUsed - heapBefore) / 1024;
  const stats = result.stats;
  const xStep = config.options?.xStep ?? 2;
  return {
    label,
    ...extra,
    gridMovable: stats.xPositions > 0 ? stats.maxStepPx >= xStep - 1e-9 : null,
    input: {
      world: config.world,
      player: config.player,
      hazard: config.hazard,
      options: config.options,
      derived: {
        worldVisualWidth: config.world.xMax + config.player.width,
        xStep: config.options?.xStep ?? 2,
        phaseSteps: config.options?.phaseSteps,
        dtMs: stats.dtMs,
        maxStepPx: stats.maxStepPx,
        hazardSpeedPxPerMs: round((2 * config.hazard.distance) / config.hazard.periodMs, 6),
        stateCapacity: stats.xPositions * stats.phaseSteps,
      },
    },
    verdict: result.verdict,
    reason: result.reason,
    stats,
    wallMs: round(wallMs, 3),
    heapDeltaKiB: round(heapDeltaKiB, 1),
  };
}

// ── 合成用例：goal 永久被覆盖但非永久封锁门 ──────────────────────────────
function exhaustionCase({
  visualWidth,
  distance = 20,
  periodMs = 4000,
  phaseSteps = 200,
  xStep = 2,
  maxSpeed = 0.16,
  hazardWidth = null,
  maxStates = 1_500_000,
  timeBudgetMs = 60_000,
}) {
  const pw = 20;
  const ph = 48;
  const hw = hazardWidth ?? Math.max(2 * distance, 2 * pw);
  const xMax = visualWidth - pw; // P0 约定
  const goalX = xMax - pw; // 网格最右可达左边缘
  return {
    world: { xMin: 0, xMax },
    player: { startX: 40, goalX, width: pw, height: ph, y: 200, maxSpeed },
    hazard: {
      startX: goalX,
      distance,
      periodMs,
      width: hw,
      height: ph,
      anchorX: 0.5,
      anchorY: 1,
      y: 200,
      axis: "x",
    },
    certainty: { phase: "known", hitbox: "known" },
    assumptions: { verticalEvasionImpossible: false },
    options: { lagMs: 16.67, phaseSteps, xStep, limits: { maxStates, timeBudgetMs } },
  };
}

// ── 语料扫描 ──────────────────────────────────────────────────────────────
const FALLBACK = {
  player: { w: 32, h: 48, anchorX: 0.5, anchorY: 0.95 },
  hazard: { w: 40, h: 40, anchorX: 0.5, anchorY: 1 },
};

function manifestAsset(manifestRel, assetId) {
  if (!manifestRel) return null;
  const p = path.join(ROOT, manifestRel);
  if (!fs.existsSync(p)) return null;
  try {
    const m = readJson(p);
    const a = (m.assets ?? []).find((x) => x.id === assetId);
    if (!a || !a.size) return null;
    return { w: a.size.w, h: a.size.h, anchorX: a.anchor?.x ?? 0.5, anchorY: a.anchor?.y ?? 1 };
  } catch {
    return null;
  }
}

function corpusScan() {
  const inv = readJson(INVENTORY_PATH);
  const unique = new Map();
  const skipped = { notParseOk: 0, notGameConfig: 0, unreadable: 0 };
  for (const entry of inv.configs ?? []) {
    if (!entry.parseOk) { skipped.notParseOk += 1; continue; }
    let cfg;
    try { cfg = readJson(path.join(ROOT, entry.path)); } catch { skipped.unreadable += 1; continue; }
    if (cfg.format !== "game-config/v1") { skipped.notGameConfig += 1; continue; }
    if (!unique.has(entry.contentHash)) unique.set(entry.contentHash, { entry, cfg });
  }

  const rows = [];
  for (const { entry, cfg } of unique.values()) {
    const visualW = cfg.world?.size?.w ?? null;
    const goalEntity = (cfg.entities ?? []).find((e) => e.kind === "goal");
    const playerGeom = manifestAsset(entry.auditManifest, cfg.player?.asset) ?? FALLBACK.player;
    const goalGeom = goalEntity ? (manifestAsset(entry.auditManifest, goalEntity.asset) ?? FALLBACK.hazard) : null;
    const configSpeed = (cfg.player?.move?.speed ?? 90) / 1000; // px/ms；缺省见 game-config DEFAULT_PLAYER_MOVE
    for (const e of cfg.entities ?? []) {
      if (e.kind !== "hazard" || !e.motion) continue;
      const hazGeom = manifestAsset(entry.auditManifest, e.asset) ?? FALLBACK.hazard;
      const goalX = goalEntity && goalGeom && visualW
        ? (goalEntity.at.x - goalGeom.anchorX * goalGeom.w) - playerGeom.w
        : null;
      const startX = cfg.player?.at?.x ?? 0;
      const xMax = visualW != null ? visualW - playerGeom.w : null;
      const grid = visualW != null && goalX != null
        ? xGridValues({ xMin: 0, xMax, width: playerGeom.w, startX, goalX, xStep: 2 })
        : null;
      rows.push({
        config: entry.path,
        contentHash: entry.contentHash,
        manifest: entry.auditManifest ?? null,
        visualWidth: visualW,
        playerAsset: cfg.player?.asset ?? null,
        playerGeometry: playerGeom,
        playerConfigSpeedPxPerMs: round(configSpeed, 6),
        startX,
        goalAtX: goalEntity?.at?.x ?? null,
        goalX: round(goalX, 3),
        hazardId: e.id,
        hazardAsset: e.asset,
        hazardGeometry: hazGeom,
        hazardAtX: e.at?.x ?? null,
        distance: e.motion.distance,
        periodMs: e.motion.periodMs,
        axis: e.motion.axis,
        kind: e.motion.kind,
        hazardSpeedPxPerMs: round((2 * e.motion.distance) / e.motion.periodMs, 6),
        canonical: grid
          ? (() => {
              const bands = [...new Set([round(configSpeed, 6), 0.16])];
              const resolutionMaxPhaseStepsBySpeed = Object.fromEntries(
                bands.map((sp) => [sp, Math.floor((sp * e.motion.periodMs) / 2)]),
              );
              return {
                xStep: 2,
                phaseSteps: 200,
                maxSpeedBands: bands,
                xPositions: grid.length,
                stateCapacity: grid.length * 200,
                maxStepPx: round(configSpeed * (e.motion.periodMs / 200), 4),
                resolutionMaxPhaseStepsBySpeed,
                resolutionCapacityBySpeed: Object.fromEntries(
                  bands.map((sp) => [sp, grid.length * resolutionMaxPhaseStepsBySpeed[sp]]),
                ),
              };
            })()
          : null,
      });
    }
  }

  const moving = rows.filter((r) => r.axis === "x");
  const configsWithMotion = new Set(rows.map((r) => r.config)).size;
  let hazardsTotal = 0;
  for (const { cfg } of unique.values()) hazardsTotal += (cfg.entities ?? []).filter((e) => e.kind === "hazard").length;
  const nums = (key) => rows.map((r) => r[key]).filter((v) => typeof v === "number" && Number.isFinite(v));
  const canonicalStates = rows.map((r) => r.canonical?.stateCapacity).filter(Number.isFinite);
  const canonicalX = rows.map((r) => r.canonical?.xPositions).filter(Number.isFinite);
  const resolutionCapacities = rows.flatMap((r) => Object.values(r.canonical?.resolutionCapacityBySpeed ?? {}))
    .filter(Number.isFinite);
  const n200AtDefaultSpeedValid = rows.filter((r) =>
    r.canonical && r.canonical.maxSpeedBands.includes(r.playerConfigSpeedPxPerMs)
      && r.canonical.maxStepPx >= r.canonical.xStep - 1e-9).length;
  const n200AtP0SpeedValid = rows.filter((r) =>
    r.canonical && r.canonical.maxSpeedBands.includes(0.16)
      && 0.16 * (r.periodMs / 200) >= r.canonical.xStep - 1e-9).length;
  return {
    scope: {
      inventory: INVENTORY_REL,
      inventorySha256: sha256File(INVENTORY_PATH),
      inventoryBaseline: inv.baseline ?? null,
      roots: inv.roots ?? null,
      filter: "parseOk ∧ format=game-config/v1 ∧ unique by contentHash",
      skipped,
    },
    counts: {
      uniqueConfigs: unique.size,
      hazardsTotal,
      configsWithMotion,
      movingHazards: moving.length,
      nonXAxisMoving: rows.filter((r) => r.axis !== "x").length,
    },
    distributions: {
      worldWidth: dist(nums("visualWidth")),
      distance: dist(nums("distance")),
      periodMs: dist(nums("periodMs")),
      hazardSpeedPxPerMs: dist(nums("hazardSpeedPxPerMs")),
      canonicalXPositions: dist(canonicalX),
      canonicalStateCapacity: dist(canonicalStates),
      resolutionValidStateCapacity: dist(resolutionCapacities),
    },
    resolution: {
      rule: "phaseSteps ≤ maxSpeed · periodMs / xStep（否则 maxStepPx < xStep，玩家无法移动）",
      fixedN200ValidAtP0Speed: n200AtP0SpeedValid,
      fixedN200ValidAtConfigSpeed: n200AtDefaultSpeedValid,
      total: rows.length,
    },
    rows,
  };
}

function corpusRuns(rows) {
  const out = [];
  for (const r of rows) {
    if (!r.canonical || r.goalX == null || r.goalX <= r.startX || r.hazardAtX == null) {
      out.push({ label: `${r.config}#${r.hazardId}`, skipped: "no-goal-or-goal-not-ahead" });
      continue;
    }
    // 与 P0 案例一致的盒顶推导：top = at.y - anchorY * height（地面基线 at.y = 250）。
    const FLOOR_Y = 250;
    const playerTop = FLOOR_Y - r.playerGeometry.anchorY * r.playerGeometry.h;
    const hazardTop = FLOOR_Y - r.hazardGeometry.anchorY * r.hazardGeometry.h;
    for (const speed of r.canonical.maxSpeedBands) {
      const config = {
        world: { xMin: 0, xMax: r.visualWidth - r.playerGeometry.w },
        player: {
          startX: r.startX,
          goalX: r.goalX,
          width: r.playerGeometry.w,
          height: r.playerGeometry.h,
          y: playerTop,
          maxSpeed: speed,
        },
        hazard: {
          startX: r.hazardAtX,
          distance: r.distance,
          periodMs: r.periodMs,
          width: r.hazardGeometry.w,
          height: r.hazardGeometry.h,
          anchorX: r.hazardGeometry.anchorX,
          anchorY: r.hazardGeometry.anchorY,
          y: hazardTop,
          axis: "x",
        },
        certainty: { phase: "known", hitbox: "known" },
        assumptions: { verticalEvasionImpossible: false },
        options: { lagMs: 16.67, phaseSteps: 200, xStep: 2, limits: { maxStates: 200000, timeBudgetMs: 5000 } },
      };
      out.push(runCase(
        `corpus/${r.config}#${r.hazardId}/speed=${speed}`,
        config,
        { corpusConfig: r.config, hazardId: r.hazardId, maxSpeed: speed },
      ));
    }
  }
  return out;
}

// ── 增长扫掠 ──────────────────────────────────────────────────────────────
function growthSweep() {
  const width = [];
  for (const visualWidth of [640, 1440, 2880, 5760]) {
    width.push(runCase(`width/${visualWidth}`, exhaustionCase({ visualWidth }), { axis: "width", x: visualWidth }));
  }
  const distance = [];
  for (const d of [20, 40, 80, 160]) {
    distance.push(runCase(`distance/${d}`, exhaustionCase({ visualWidth: 2880, distance: d }), { axis: "distance", x: d }));
  }
  const period = [];
  for (const periodMs of [2000, 4000, 8000, 16000, 32000]) {
    period.push(runCase(`period/${periodMs}`, exhaustionCase({ visualWidth: 1440, periodMs }), { axis: "period", x: periodMs }));
  }
  const phase = [];
  for (const phaseSteps of [50, 100, 200, 400, 800]) {
    phase.push(runCase(`phase/${phaseSteps}`, exhaustionCase({ visualWidth: 1440, periodMs: 8000, phaseSteps }), { axis: "phase", x: phaseSteps }));
  }

  const fits = (rows) => {
    const usable = rows.filter((r) => r.stats && r.stats.dtMs > 0 && r.stats.maxStepPx >= (r.input.derived.xStep - 1e-9));
    return {
      elapsedMsVsX: linearFit(usable.map((r) => ({ x: r.x, y: r.wallMs }))),
      stateCapacityVsX: linearFit(usable.map((r) => ({ x: r.x, y: r.stats.xPositions * r.stats.phaseSteps }))),
      edgesCheckedVsX: linearFit(usable.map((r) => ({ x: r.x, y: r.stats.edgesChecked }))),
      excludedDegenerate: rows.filter((r) => !usable.includes(r)).map((r) => r.label),
    };
  };
  const allRows = [...width, ...distance, ...period, ...phase];
  const formula = allRows
    .filter((r) => r.stats?.statesVisited > 1000)
    .map((r) => {
      const xStep = r.input.derived.xStep;
      const observed = r.stats.edgesChecked / r.stats.statesVisited;
      const predicted = 2 * Math.floor(r.stats.maxStepPx / xStep + 1e-9) + 1;
      return {
        label: r.label,
        maxStepPx: r.stats.maxStepPx,
        xStep,
        observedEdgesPerState: round(observed, 3),
        predictedEdgesPerState: predicted,
        errorPct: round(((observed - predicted) / predicted) * 100, 2),
      };
    });
  const edgeFormulaWithin5Pct = formula.every((r) => Math.abs(r.errorPct) <= 5);

  return {
    note: "合成用例：goal 被 hazard 永久覆盖但落在门内（provePermanentGate 返回 null），故 BFS 耗尽可达状态后返回 INSUFFICIENT_EVIDENCE / no-witness-found。",
    model: {
      stateCapacity: "xPositions × phaseSteps；xPositions = floor((world.xMax - world.xMin - player.width) / xStep) + 1（另加 start/goal 特殊点）",
      dt: "periodMs / phaseSteps",
      maxStepPx: "maxSpeed × dt = maxSpeed × periodMs / phaseSteps",
      edgesPerState: "2·floor(maxStepPx / xStep) + 1（内部格；边界更少）",
      totalEdges: "≈ xPositions × phaseSteps × (2·floor(maxSpeed·periodMs / (phaseSteps·xStep)) + 1)",
      resolutionRule: "必须 maxSpeed·periodMs / phaseSteps ≥ xStep，否则 player 无法移动，BFS 退化为“只能等待”",
    },
    formula,
    edgeFormulaWithin5Pct,
    sweeps: { width, distance, period, phase },
    fits: {
      width: fits(width),
      distance: fits(distance),
      period: fits(period),
      phase: fits(phase),
    },
  };
}

// ── 重复运行 ──────────────────────────────────────────────────────────────
const P0_INPUTS = {
  safeA: ".scratch/level-playability-v1.1-p0/cases/a/analyzer-input-lag16.67ms.json",
  gateB: ".scratch/level-playability-v1.1-p0/cases/b/analyzer-input-lag16.67ms.json",
};

function loadP0Input(key) {
  const p = path.join(ROOT, P0_INPUTS[key]);
  return { path: p, config: readJson(p), sha256: sha256File(p) };
}

function withLimits(config, limits) {
  return { ...config, options: { ...config.options, limits: { ...config.options.limits, ...limits } } };
}

function repeatStudy() {
  const safe = loadP0Input("safeA");
  const cases = [
    { label: "repeat/safeA", config: safe.config },
    { label: "repeat/exhaust-w1440", config: exhaustionCase({ visualWidth: 1440 }) },
    { label: "repeat/exhaust-w2880", config: exhaustionCase({ visualWidth: 2880 }) },
  ];
  const N = 7;
  return cases.map(({ label, config }) => {
    const runs = Array.from({ length: N }, (_, i) => runCase(`${label}#${i + 1}`, config, { iteration: i + 1 }));
    const elapsed = runs.map((r) => r.stats.elapsedMs);
    const wall = runs.map((r) => r.wallMs);
    const warm = runs.slice(1);
    return {
      label,
      repeats: N,
      elapsedMs: { all: elapsed, ...dist(elapsed), warm: dist(warm.map((r) => r.stats.elapsedMs)) },
      wallMs: { all: wall, ...dist(wall), warm: dist(warm.map((r) => r.wallMs)) },
      verdicts: [...new Set(runs.map((r) => r.verdict))],
      reasons: [...new Set(runs.map((r) => r.reason))],
      visited: [...new Set(runs.map((r) => r.stats.statesVisited))],
      edges: [...new Set(runs.map((r) => r.stats.edgesChecked))],
      stableCounts: new Set(runs.map((r) => `${r.stats.statesVisited}/${r.stats.edgesChecked}`)).size === 1,
      runs,
    };
  });
}

// ── 预算边界 ──────────────────────────────────────────────────────────────
function budgetBoundary() {
  const safe = loadP0Input("safeA");
  const gate = loadP0Input("gateB");
  const safeBase = safe.config;
  const gateBase = gate.config;
  const exhaust = exhaustionCase({ visualWidth: 2880 });

  const timeBudgets = [0, 1, 2, 5, 10, 25, 100, 250, 1000, 5000];
  const safeByTime = timeBudgets.map((ms) =>
    runCase(`safeA/timeBudget=${ms}`, withLimits(safeBase, { timeBudgetMs: ms, maxStates: 200000 }), { timeBudgetMs: ms }));
  const gateByTime = [0, 1, 1000].map((ms) =>
    runCase(`gateB/timeBudget=${ms}`, withLimits(gateBase, { timeBudgetMs: ms, maxStates: 200000 }), { timeBudgetMs: ms }));
  const exhaustByTime = [1, 1000, 60000].map((ms) =>
    runCase(`exhaust/timeBudget=${ms}`, withLimits(exhaust, { timeBudgetMs: ms, maxStates: 1500000 }), { timeBudgetMs: ms }));
  const safeByStates = [0, 1, 100, 1000, 4096, 5000, 200000].map((n) =>
    runCase(`safeA/maxStates=${n}`, withLimits(safeBase, { maxStates: n, timeBudgetMs: 60000 }), { maxStates: n }));
  const gateByStates = [0, 1, 200000].map((n) =>
    runCase(`gateB/maxStates=${n}`, withLimits(gateBase, { maxStates: n, timeBudgetMs: 60000 }), { maxStates: n }));

  const noBudgetUnplayable = [...safeByTime, ...safeByStates, ...exhaustByTime]
    .every((r) => r.verdict !== "PROVEN_UNPLAYABLE");
  const gateAlwaysUnplayable = [...gateByTime, ...gateByStates]
    .every((r) => r.verdict === "PROVEN_UNPLAYABLE");
  const safeFlips = safeByTime.some((r) => r.verdict === "INSUFFICIENT_EVIDENCE" && r.reason === "search-budget-exhausted")
    && safeByTime.some((r) => r.verdict === "NO_PROVEN_BLOCKER");
  const exhaustIe = exhaustByTime.every((r) => r.verdict === "INSUFFICIENT_EVIDENCE");

  return {
    inputs: {
      safeA: { file: rel(safe.path), sha256: safe.sha256 },
      gateB: { file: rel(gate.path), sha256: gate.sha256 },
      exhaust: { recipe: "exhaustionCase({visualWidth:2880})", config: exhaust },
    },
    tables: { safeByTime, gateByTime, exhaustByTime, safeByStates, gateByStates },
    checks: { noBudgetUnplayable, gateAlwaysUnplayable, safeFlips, exhaustIe },
  };
}

// ── 墙钟来源审计 ──────────────────────────────────────────────────────────
function wallClockAudit() {
  const lines = fs.readFileSync(MODEL_PATH, "utf8").split(/\r?\n/);
  const fnRanges = [];
  let cur = null;
  lines.forEach((line, i) => {
    const m = /^(?:export\s+)?function\s+([A-Za-z0-9_]+)/.exec(line);
    if (m) {
      if (cur) { cur.end = i; fnRanges.push(cur); }
      cur = { name: m[1], start: i + 1, end: lines.length };
    }
    if (cur && /^}/.test(line) && i + 1 > cur.start) { cur.end = i + 1; fnRanges.push(cur); cur = null; }
  });
  if (cur) fnRanges.push(cur);
  const fnOf = (lineNo) => fnRanges.find((f) => lineNo >= f.start && lineNo <= f.end)?.name ?? "<top-level>";
  const patterns = [
    { name: "Date.now", re: /Date\.now\s*\(/ },
    { name: "performance.now", re: /performance\.now\s*\(/ },
    { name: "Math.random", re: /Math\.random\s*\(/ },
  ];
  const hits = [];
  lines.forEach((text, i) => {
    for (const p of patterns) if (p.re.test(text)) hits.push({ line: i + 1, api: p.name, fn: fnOf(i + 1), text: text.trim() });
  });
  const clock = hits.filter((h) => h.api !== "Math.random");
  const random = hits.filter((h) => h.api === "Math.random");
  const allowedFns = new Set(["analyze", "reconstruct"]);
  const clockOnlyInBudgetOrReporting = clock.every((h) => allowedFns.has(h.fn));
  return {
    model: MODEL_REL,
    modelSha256: sha256File(MODEL_PATH),
    hits,
    clockOnlyInBudgetOrReporting,
    noRandomness: random.length === 0,
    note: "Date.now 只出现在 analyze（预算检查 / elapsedMs）与 reconstruct（witness.elapsedMs 展示）；不进入三角波、碰撞、永久封锁门。",
  };
}

// ── 写盘与汇总 ────────────────────────────────────────────────────────────
const startedWall = nowMs();
const metaBase = {
  script: rel(path.join(HERE, "perf-probe.mjs")),
  scriptVersion: SCRIPT_VERSION,
  scriptSha256: sha256File(path.join(HERE, "perf-probe.mjs")),
  command: `node --expose-gc ${rel(path.join(HERE, "perf-probe.mjs"))} --out ${rel(OUT)}`,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()?.[0]?.model ?? null,
  cores: os.cpus()?.length ?? null,
  totalMemMiB: round(os.totalmem() / 2 ** 20, 0),
  loadavg: os.loadavg().map((v) => round(v, 2)),
  repoHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
  branch: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
  readOnly: true,
  exposeGc: typeof global.gc === "function",
};

fs.mkdirSync(OUT, { recursive: true });

const corpus = corpusScan();
const corpusAnalyzed = corpusRuns(corpus.rows);
const growth = growthSweep();
const repeats = repeatStudy();
const budget = budgetBoundary();
const wallClock = wallClockAudit();

const nonSkippedCorpusRuns = corpusAnalyzed.filter((r) => !r.skipped && r.stats);
const elapsedCorpus = nonSkippedCorpusRuns.map((r) => r.stats.elapsedMs);
const wallCorpus = nonSkippedCorpusRuns.map((r) => r.wallMs);
const allTimedRuns = [
  ...nonSkippedCorpusRuns,
  ...growth.sweeps.width,
  ...growth.sweeps.distance,
  ...growth.sweeps.period,
  ...growth.sweeps.phase,
];
const perEdgeUs = allTimedRuns
  .filter((r) => r.stats?.edgesChecked > 0)
  .map((r) => (r.wallMs * 1000) / r.stats.edgesChecked);
const peakHeap = [...allTimedRuns].sort((a, b) => b.stats.statesVisited - a.stats.statesVisited)[0];

const checks = [
  {
    id: "corpus-counts-match-p0",
    pass: corpus.counts.uniqueConfigs === 21 && corpus.counts.movingHazards === 19,
    observed: corpus.counts,
    expected: { uniqueConfigs: 21, movingHazards: 19 },
  },
  {
    id: "state-capacity-is-product",
    pass: allTimedRuns.every((r) => {
      if (!(r.stats?.xPositions > 0)) return true; // 输入门提前退出，未建网格
      const grid = xGridValues({
        xMin: r.input.world.xMin,
        xMax: r.input.world.xMax,
        width: r.input.player.width,
        startX: r.input.player.startX,
        goalX: r.input.player.goalX,
        xStep: r.input.derived.xStep,
      });
      return grid.length === r.stats.xPositions
        && r.input.derived.stateCapacity === r.stats.xPositions * r.stats.phaseSteps;
    }),
    note: "xPositions 由独立复刻的网格公式重算一致；stateCapacity = xPositions × phaseSteps。",
  },
  {
    id: "edge-formula-within-5pct",
    pass: growth.edgeFormulaWithin5Pct,
    observed: growth.formula,
    note: "edgesChecked/statesVisited 与 2·floor(maxStepPx/xStep)+1 的误差均在 5% 内。",
  },
  {
    id: "p0-n200-valid-at-160pxs",
    pass: corpus.resolution.fixedN200ValidAtP0Speed === corpus.counts.movingHazards,
    observed: { valid: corpus.resolution.fixedN200ValidAtP0Speed, total: corpus.counts.movingHazards },
  },
  {
    id: "resolution-rule-covers-corpus",
    pass: corpus.distributions.resolutionValidStateCapacity.max <= 500000,
    observed: corpus.distributions.resolutionValidStateCapacity,
    note: "在 resolution rule 允许的最大 phaseSteps 下，语料状态上限仍落在建议的 maxStates=500k 内。",
  },
  {
    id: "visited-within-capacity",
    pass: allTimedRuns.every((r) => r.stats.statesVisited <= r.stats.xPositions * r.stats.phaseSteps),
  },
  {
    id: "repeat-verdict-and-counts-stable",
    pass: repeats.every((r) => r.verdicts.length === 1 && r.reasons.length === 1 && r.stableCounts),
    observed: repeats.map((r) => ({ label: r.label, verdicts: r.verdicts, visited: r.visited, edges: r.edges })),
  },
  {
    id: "budget-never-proves-unplayable",
    pass: budget.checks.noBudgetUnplayable,
    note: "非门输入在 timeBudget=0/1ms、maxStates=0/1 下只能 SAFE 或 IE，绝不 PROVEN_UNPLAYABLE。",
  },
  {
    id: "gate-proof-independent-of-budget",
    pass: budget.checks.gateAlwaysUnplayable,
    note: "永久封锁门在 timeBudget=0/1ms、maxStates=0/1 下仍是 PROVEN_UNPLAYABLE（证明在搜索之前）。",
  },
  {
    id: "safe-flips-to-ie-under-tiny-budget",
    pass: budget.checks.safeFlips,
  },
  {
    id: "exhaustion-remains-ie",
    pass: budget.checks.exhaustIe,
  },
  {
    id: "wall-clock-only-budget-or-reporting",
    pass: wallClock.clockOnlyInBudgetOrReporting && wallClock.noRandomness,
    hits: wallClock.hits,
  },
  {
    id: "runtime-under-180s",
    pass: true, // 由 meta.durationMs 事后复核
  },
];

const files = {
  "meta.json": {
    ...metaBase,
    at: new Date().toISOString(),
    durationMs: null,
    model: { path: MODEL_REL, sha256: sha256File(MODEL_PATH) },
    inventory: { path: INVENTORY_REL, sha256: sha256File(INVENTORY_PATH) },
    p0Inputs: {
      safeA: { path: P0_INPUTS.safeA, sha256: loadP0Input("safeA").sha256 },
      gateB: { path: P0_INPUTS.gateB, sha256: loadP0Input("gateB").sha256 },
    },
    checks,
  },
  "corpus.json": { ...metaBase, at: new Date().toISOString(), corpus, runs: corpusAnalyzed },
  "growth.json": { ...metaBase, at: new Date().toISOString(), growth },
  "repeats.json": { ...metaBase, at: new Date().toISOString(), repeats },
  "budget-boundary.json": { ...metaBase, at: new Date().toISOString(), budget },
};

const durationMs = nowMs() - startedWall;
files["meta.json"].durationMs = round(durationMs, 1);
files["meta.json"].checks = checks.map((c) => (c.id === "runtime-under-180s" ? { ...c, pass: durationMs < 180_000, observedMs: round(durationMs, 1) } : c));

for (const [name, payload] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(payload, null, 2) + "\n");
}

const failed = files["meta.json"].checks.filter((c) => !c.pass);

// ── stdout 摘要（可重定向保存） ──────────────────────────────────────────
const fmt = (r) => `${r.label.padEnd(34)} ${String(r.verdict).padEnd(22)} ${String(r.reason).padEnd(26)} vis=${String(r.stats.statesVisited).padStart(7)} edge=${String(r.stats.edgesChecked).padStart(8)} elapsed=${String(r.stats.elapsedMs).padStart(5)}ms wall=${String(r.wallMs).padStart(8)}ms`;
const out = [];
out.push(`I00-06 performance probe · ${metaBase.node} · ${metaBase.cpu} · ${metaBase.cores} cores`);
out.push(`duration=${round(durationMs, 1)}ms · out=${rel(OUT)}`);
out.push("");
out.push(`corpus: ${corpus.counts.uniqueConfigs} configs / ${corpus.counts.hazardsTotal} hazards / ${corpus.counts.movingHazards} moving (${corpus.counts.configsWithMotion} configs with motion)`);
out.push(`  worldWidth   ${JSON.stringify(corpus.distributions.worldWidth)}`);
out.push(`  distance     ${JSON.stringify(corpus.distributions.distance)}`);
out.push(`  periodMs     ${JSON.stringify(corpus.distributions.periodMs)}`);
out.push(`  hazardSpeed  ${JSON.stringify(corpus.distributions.hazardSpeedPxPerMs)}`);
out.push(`  xPositions@200x2 ${JSON.stringify(corpus.distributions.canonicalXPositions)}`);
out.push(`  stateCap@200x2   ${JSON.stringify(corpus.distributions.canonicalStateCapacity)}`);
out.push(`  resolutionCap    ${JSON.stringify(corpus.distributions.resolutionValidStateCapacity)} (N <= maxSpeed*period/xStep)`);
out.push(`  fixedN200 valid: p0speed=${corpus.resolution.fixedN200ValidAtP0Speed}/${corpus.counts.movingHazards} configSpeed=${corpus.resolution.fixedN200ValidAtConfigSpeed}/${corpus.counts.movingHazards}`);
const effectiveRuns = nonSkippedCorpusRuns.filter((r) => r.gridMovable === true);
const degenerateRuns = nonSkippedCorpusRuns.filter((r) => r.gridMovable === false);
out.push(`  runs: effective=${effectiveRuns.length} degenerate(maxStepPx<xStep)=${degenerateRuns.length} gate-early-exit=${nonSkippedCorpusRuns.filter((r) => r.stats.xPositions === 0).length}`);
out.push(`  effective elapsedMs  ${JSON.stringify(dist(effectiveRuns.map((r) => r.stats.elapsedMs)))}`);
out.push(`  effective wallMs     ${JSON.stringify(dist(effectiveRuns.map((r) => r.wallMs)))}`);
out.push(`  all-run elapsedMs    ${JSON.stringify(dist(elapsedCorpus))}`);
out.push(`  all-run wallMs       ${JSON.stringify(dist(wallCorpus))}`);
const reasonCounts = {};
for (const r of nonSkippedCorpusRuns) reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
out.push(`  reasons ${JSON.stringify(reasonCounts)}`);
out.push("");
out.push("growth (synthetic full-exhaustion):");
for (const name of ["width", "distance", "period", "phase"]) {
  out.push(`  [${name}]`);
  for (const r of growth.sweeps[name]) out.push(`    ${fmt(r)}`);
  out.push(`    fit elapsed≈${JSON.stringify(growth.fits[name].elapsedMsVsX)}`);
}
out.push("");
out.push("repeats:");
for (const r of repeats) out.push(`  ${r.label.padEnd(24)} elapsed all=${JSON.stringify(r.elapsedMs.all)} warm=${JSON.stringify(r.elapsedMs.warm)} verdicts=${JSON.stringify(r.verdicts)} visited=${JSON.stringify(r.visited)}`);
out.push("");
out.push("budget boundary:");
for (const r of [...budget.tables.safeByTime, ...budget.tables.gateByTime, ...budget.tables.exhaustByTime]) {
  const lim = r.stats.limits;
  out.push(`  ${r.label.padEnd(34)} time=${String(lim.timeBudgetMs).padStart(5)} states=${String(lim.maxStates).padStart(7)} → ${String(r.verdict).padEnd(22)} ${r.reason}`);
}
out.push("");
out.push(`per-edge cost µs: ${JSON.stringify(dist(perEdgeUs))}`);
out.push(`peak state run: ${peakHeap.stats.statesVisited} visited (${((peakHeap.stats.statesVisited / peakHeap.stats.xPositions) * peakHeap.stats.dtMs).toFixed(0)}ms game-time), heapΔ=${peakHeap.heapDeltaKiB}KiB, ${peakHeap.wallMs}ms`);
out.push("");
out.push(`checks: ${checks.filter((c) => c.pass).length}/${files["meta.json"].checks.length} pass${failed.length ? ` · FAILED: ${failed.map((c) => c.id).join(", ")}` : ""}`);
console.log(out.join("\n"));

if (failed.length) process.exitCode = 1;
