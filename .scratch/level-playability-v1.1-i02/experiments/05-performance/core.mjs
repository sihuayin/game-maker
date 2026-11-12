/**
 * I02-05 · 性能与预算基线 —— ⚠️ SCRATCH（THROWAWAY）。
 *
 * 被测算法：**P0 冻结时序模型**（`.scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs`）。
 * I-02 的连续时间核心尚未实现，因此本文件的所有数字都是 **P0 代理**，不是 I-02 数字。
 * 差异注记见 evidence/05-performance.md §2。
 *
 * 只读：不写被扫描文件、不改 packages/** / fixtures/** / P0 目录。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../../../..");
export const MODEL_REL = ".scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs";
export const INVENTORY_REL = ".scratch/level-playability-v1/corpus/inventory.json";
const MODEL_PATH = path.join(ROOT, MODEL_REL);
export const { analyze } = await import(pathToFileURL(MODEL_PATH).href);

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const sha256File = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
export const round = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
export const pct = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
export const dist = (xs) => (xs.length ? {
  n: xs.length,
  min: round(Math.min(...xs)),
  p50: round(pct(xs, 0.5)),
  p90: round(pct(xs, 0.9)),
  max: round(Math.max(...xs)),
  mean: round(mean(xs)),
  sd: round(sd(xs)),
} : { n: 0 });

/** 复刻 P0 的 x 网格计数。 */
export function xGridValues({ xMin, xMax, width, startX, goalX, xStep }) {
  const maxLeft = xMax - width;
  const values = new Set([xMin, maxLeft, startX, goalX]);
  const n = Math.floor((maxLeft - xMin) / xStep);
  for (let i = 0; i <= n; i += 1) {
    const x = xMin + i * xStep;
    if (x <= maxLeft + 1e-9) values.add(Math.round(x * 1e6) / 1e6);
  }
  return [...values].filter((x) => x >= xMin - 1e-9 && x <= maxLeft + 1e-9);
}

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

const FALLBACK = {
  player: { w: 32, h: 48, anchorX: 0.5, anchorY: 0.95 },
  hazard: { w: 40, h: 40, anchorX: 0.5, anchorY: 1 },
};

/** I-00 perf-probe 的语料口径：parseOk ∧ format=game-config/v1 ∧ unique by contentHash。 */
export function scanCorpus() {
  const inv = readJson(path.join(ROOT, INVENTORY_REL));
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
    const configSpeed = (cfg.player?.move?.speed ?? 90) / 1000;
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
        configSha256: entry.sha256 ?? null,
        manifest: entry.auditManifest ?? null,
        visualWidth: visualW,
        playerGeometry: playerGeom,
        playerConfigSpeedPxPerMs: round(configSpeed, 6),
        startX,
        goalAtX: goalEntity?.at?.x ?? null,
        goalX: round(goalX, 3),
        hazardId: e.id,
        hazardGeometry: hazGeom,
        hazardAtX: e.at?.x ?? null,
        distance: e.motion.distance,
        periodMs: e.motion.periodMs,
        axis: e.motion.axis,
        kind: e.motion.kind,
        hazardSpeedPxPerMs: round((2 * e.motion.distance) / e.motion.periodMs, 6),
        canonical: grid ? {
          xStep: 2,
          phaseSteps: 200,
          xPositions: grid.length,
          stateCapacity: grid.length * 200,
        } : null,
      });
    }
  }
  const moving = rows.filter((r) => r.axis === "x");
  const configsWithMotion = new Set(rows.map((r) => r.config)).size;
  let hazardsTotal = 0;
  for (const { cfg } of unique.values()) hazardsTotal += (cfg.entities ?? []).filter((e) => e.kind === "hazard").length;
  return {
    scope: { inventory: INVENTORY_REL, inventorySha256: sha256File(path.join(ROOT, INVENTORY_REL)), filter: "parseOk ∧ format=game-config/v1 ∧ unique by contentHash", skipped },
    counts: { uniqueConfigs: unique.size, hazardsTotal, configsWithMotion, movingHazards: moving.length, nonXAxisMoving: rows.filter((r) => r.axis !== "x").length },
    rows,
  };
}

/** 语料行的 P0 输入（与 I-00 perf-probe 同式）。 */
export function corpusConfig(row, speed, limits = { maxStates: 200000, timeBudgetMs: 5000 }) {
  const FLOOR_Y = 250;
  const playerTop = FLOOR_Y - row.playerGeometry.anchorY * row.playerGeometry.h;
  const hazardTop = FLOOR_Y - row.hazardGeometry.anchorY * row.hazardGeometry.h;
  return {
    world: { xMin: 0, xMax: row.visualWidth - row.playerGeometry.w },
    player: {
      startX: row.startX,
      goalX: row.goalX,
      width: row.playerGeometry.w,
      height: row.playerGeometry.h,
      y: playerTop,
      maxSpeed: speed,
    },
    hazard: {
      startX: row.hazardAtX,
      distance: row.distance,
      periodMs: row.periodMs,
      width: row.hazardGeometry.w,
      height: row.hazardGeometry.h,
      anchorX: row.hazardGeometry.anchorX,
      anchorY: row.hazardGeometry.anchorY,
      y: hazardTop,
      axis: "x",
    },
    certainty: { phase: "known", hitbox: "known" },
    assumptions: { verticalEvasionImpossible: false },
    options: { lagMs: 16.67, phaseSteps: 200, xStep: 2, limits },
  };
}

/** 合成最坏用例：goal 永久被覆盖但落在门内 ⇒ 不构成永久封锁门，BFS 会耗尽状态。 */
export function exhaustionCase({
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
  const xMax = visualWidth - pw;
  const goalX = xMax - pw;
  return {
    world: { xMin: 0, xMax },
    player: { startX: 40, goalX, width: pw, height: ph, y: 200, maxSpeed },
    hazard: {
      startX: goalX, distance, periodMs, width: hw, height: ph,
      anchorX: 0.5, anchorY: 1, y: 200, axis: "x",
    },
    certainty: { phase: "known", hitbox: "known" },
    assumptions: { verticalEvasionImpossible: false },
    options: { lagMs: 16.67, phaseSteps, xStep, limits: { maxStates, timeBudgetMs } },
  };
}

export function runCase(label, config, extra = {}) {
  const gc = global.gc;
  if (gc) gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = process.hrtime.bigint();
  const result = analyze(config);
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const heapDeltaKiB = (process.memoryUsage().heapUsed - heapBefore) / 1024;
  return {
    label,
    ...extra,
    verdict: result.verdict,
    reason: result.reason,
    stats: result.stats,
    stateCapacity: (result.stats.xPositions ?? 0) * (result.stats.phaseSteps ?? 0),
    wallMs: round(wallMs, 3),
    heapDeltaKiB: round(heapDeltaKiB, 1),
    input: {
      world: config.world,
      player: config.player,
      hazard: config.hazard,
      options: config.options,
    },
  };
}

/** 环境快照（与 I-00 perf-probe 同口径）。 */
export function environment() {
  let repoHead = null;
  let branch = null;
  try {
    repoHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch { /* git unavailable */ }
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()?.[0]?.model ?? null,
    cores: os.cpus()?.length ?? null,
    totalMemMiB: round(os.totalmem() / 1024 / 1024, 0),
    loadavg: os.loadavg().map((x) => round(x, 2)),
    repoHead,
    branch,
    exposeGc: Boolean(global.gc),
  };
}

/** I-02 若采用“移动图脚点 × 相位”的二级代理容量（D3 未定，仅注记）。 */
export async function graphCapacity(rows) {
  const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
  const { buildMovementGraph } = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/playability/graph.js")).href);
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.config)) continue;
    seen.add(r.config);
    try {
      const cfg = C.parseGameConfig(readJson(path.join(ROOT, r.config)));
      if (!cfg.ok) { out.push({ config: r.config, error: "parse-config" }); continue; }
      const man = C.parseAssetPack(readJson(path.join(ROOT, r.manifest)));
      if (!man.ok) { out.push({ config: r.config, error: "parse-manifest" }); continue; }
      const g = buildMovementGraph(cfg.value, man.value);
      if (!g) { out.push({ config: r.config, error: "build-null" }); continue; }
      let standable = 0;
      for (let i = 0; i < g.standable.length; i += 1) if (g.standable[i] === 1) standable += 1;
      out.push({ config: r.config, world: cfg.value.world?.size, standable, stateCapacity200: standable * 200 });
    } catch (e) {
      out.push({ config: r.config, error: String(e?.message ?? e) });
    }
  }
  return out;
}
