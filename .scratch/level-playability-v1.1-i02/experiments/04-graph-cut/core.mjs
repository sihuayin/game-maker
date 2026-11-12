/**
 * I02-04 · 图割 / forbiddenBoxes / hopSamples 可行性实验 —— ⚠️ SCRATCH（THROWAWAY）。
 *
 * 只读产品代码：通过 `packages/contracts/dist/**` 调用已构建的 `buildMovementGraph`、
 * `movementNeighbors`、`reachableCells`。**不修改任何产品文件。**
 *
 * 本文件额外提供：
 *   - `hopSamplesN` / `hopEdgesN` / `reachN`：与 `graph.ts` 同式的抛物线采样，
 *     但采样率与上限可参数化，用来模拟「hop 采样加倍」而不改 `graph.ts`。
 *   - `sampleWithRects`：同一采样器 + 轴对齐禁区并集，用于快速扫几何。
 *   - `expandRect`：复刻 `graph.ts` 的脚点格外扩规则。
 *
 * 语义基线：
 *   - `forbidden` = `blocked` ∪ `forbiddenBoxes`；不可穿越、**不提供支撑**。
 *   - `standable` 只看 `blocked`（实心体），不看 `forbidden`。
 *   - 世界外：栅格 `freeAt` 为 false；抛物线采样跳过界外点、不参与判决。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as C from "../../../../packages/contracts/dist/index.js";
import {
  buildMovementGraph,
  hopEdges,
  hopSamples,
  movementNeighbors,
  reachableCells,
} from "../../../../packages/contracts/dist/playability/graph.js";
import { jumpSpan, maxJumpHeight } from "../../../../packages/contracts/dist/game-config.js";

export const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export function loadFixture() {
  const manifest = C.parseAssetPack(
    JSON.parse(readFileSync(ROOT + "fixtures/packs/last-train/v2/manifest.json", "utf8")),
  );
  const config = C.parseGameConfig(
    JSON.parse(readFileSync(ROOT + "fixtures/game-configs/last-train.json", "utf8")),
  );
  if (!manifest.ok || !config.ok) throw new Error("fixture parse failed");
  return { manifest: manifest.value, config: config.value, move: C.playerMoveOf(config.value) };
}

/** 克隆夹具并替换地形 / 实体 / 世界宽度。 */
export function scenarioConfig(base, { terrain, entities = [], worldWidth, worldHeight } = {}) {
  const c = structuredClone(base);
  if (terrain) c.terrain = terrain;
  c.entities = entities;
  if (worldWidth !== undefined) c.world.size.w = worldWidth;
  if (worldHeight !== undefined) c.world.size.h = worldHeight;
  return c;
}

export function build(cfg, manifest, forbiddenBoxes) {
  return forbiddenBoxes === undefined
    ? buildMovementGraph(cfg, manifest)
    : buildMovementGraph(cfg, manifest, undefined, { forbiddenBoxes });
}

/** 复刻 `graph.ts:127-135` 的禁区外扩：按玩家宽高、脚点格语义。 */
export function expandRect(box, width, height, playerW, playerH) {
  return {
    x0: Math.max(0, Math.floor(box.x - playerW / 2) + 1),
    x1: Math.min(width, Math.ceil(box.x + box.w + playerW / 2) - 1),
    y0: Math.max(0, Math.floor(box.y) + 1),
    y1: Math.min(height, Math.ceil(box.y + box.h + playerH) - 1),
  };
}

/**
 * `graph.ts:225-255` 的同式采样器，采样率 `hz`（默认 60）与上限可调。
 * 默认参数必须与产品 `hopSamples` 逐点一致（run.mjs 会验证）。
 */
export function hopSamplesN(g, ax, ay, bx, by, move, { hz = 60, maxSamples = 120 } = {}) {
  const apex = maxJumpHeight(move);
  const dh = ay - by;
  if (dh > apex || dh < -g.height) return null;
  const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh;
  if (disc < 0) return null;
  const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
  const dx = bx - ax;
  if (Math.abs(dx) > move.speed * t) return null;
  const n = Math.max(6, Math.min(maxSamples, Math.ceil(t * hz)));
  const samples = [];
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const tt = t * f;
    const px = Math.round(ax + dx * f);
    const py = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
    // 界外采样点不参与判决（与产品同义）。
    if (px < 0 || px > g.width || py < 0 || py > g.height) continue;
    if (g.forbidden[px * g.stride + py] === 1) return null;
    samples.push({ x: px, y: py });
  }
  return samples.length > 0 ? samples : null;
}

export function hopEdgesN(g, x, y, move, opts) {
  const maxDx = Math.ceil(jumpSpan(move, g.height));
  const out = [];
  for (let dx = -maxDx; dx <= maxDx; dx += 1) {
    const bx = x + dx;
    if (bx < 0 || bx > g.width) continue;
    for (const by of g.columns[bx] ?? []) {
      if (bx === x && by === y) continue;
      const samples = hopSamplesN(g, x, y, bx, by, move, opts);
      if (samples) out.push({ x: bx, y: by });
    }
  }
  return out;
}

export function reachN(g, starts, move, opts) {
  const seen = new Set();
  const queue = [];
  const add = (c) => {
    const key = `${c.x},${c.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(c);
  };
  starts.forEach(add);
  for (let head = 0; head < queue.length; head += 1) {
    const c = queue[head];
    for (const e of movementNeighbors(g, c.x, c.y)) add({ x: e.x, y: e.y });
    for (const e of hopEdgesN(g, c.x, c.y, move, opts)) add(e);
  }
  return seen;
}

/** 产品 BFS（60Hz 固定）。 */
export const productReach = (g, move) => reachableCells(g, g.startCells(), move, true);

export { hopSamples, hopEdges, movementNeighbors, reachableCells };

/**
 * 快速采样：只查一组轴对齐矩形（已外扩），不建图。
 * 与 `graph.ts` 的采样逐点同式；用于扫几何。
 */
export function sampleWithRects(ax, ay, bx, by, move, rects, { hz = 60, maxSamples = 120 } = {}, world = { w: 1e9, h: 1e9 }) {
  const apex = maxJumpHeight(move);
  const dh = ay - by;
  if (dh > apex || dh < -world.h) return false;
  const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh;
  if (disc < 0) return false;
  const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
  const dx = bx - ax;
  if (Math.abs(dx) > move.speed * t) return false;
  const n = Math.max(6, Math.min(maxSamples, Math.ceil(t * hz)));
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const tt = t * f;
    const px = Math.round(ax + dx * f);
    const py = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
    if (px < 0 || px > world.w || py < 0 || py > world.h) continue;
    for (const r of rects) {
      if (px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) return false;
    }
  }
  return true;
}
