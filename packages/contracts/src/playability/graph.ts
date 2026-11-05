// 共享移动图（LP-01）—— LP-02～LP-04 的**唯一**空间底座。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、节点是**脚点**，不是 `at`
//
//   `at` 是「资源锚点落在哪」；玩家的锚点是 `{x:.5, y:.95}`，落在 `at` 上的是身高
//   95% 那一点。图里一律用脚点（盒子底边中点）：脚下那个点落在哪，盒子就长在它上面。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、边只有三种，且都从**站得住**的格子出发
//
//   walk     相邻列、同一高度，走过去不撞
//   walk-off 相邻列走出去（脚下悬空），再落到该列的下一个落脚点
//   fall     从**自由空中格**竖直落到下一个落脚点（`fallTarget`）；站得住的格子下方
//            必然是实心体，所以 fall 只作为 walk-off 的组成原语存在
//   hop      抛物线跳跃（`hopTargets`，按需计算；不是预物化边）
//
//   ⚠️ 不预物化 hop：一次 BFS 里每个落脚点扫 `maxDx` 列，预物化会把正常关卡拖成秒级。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、模型往「玩家更强」那一侧偏
//
//   这是可达性判据的正当性来源：只有**高估**玩家能力，「不在可达集里」才是可靠的那半句话。
//   walk / walk-off / fall 都是真实会发生的移动；hop 的弧线按真抛物线采样，不是示意图。

import { jumpSpan, maxJumpHeight } from "../game-config.js";
import type { GameConfig, GameEntity } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb, Vec } from "./geometry.js";
import { FIXED_RUNTIME_PROFILE, runtimeEntityGeometry, runtimePlayerGeometry } from "./profile.js";
import type { FixedRuntimeProfile, GeometryCoverage, RuntimePlayerGeometry } from "./profile.js";

export type MoveParams = { readonly speed: number; readonly jumpVelocity: number; readonly gravity: number };
export type MovementEdgeKind = "walk" | "fall" | "walk-off";
export type MovementEdge = { readonly x: number; readonly y: number; readonly kind: MovementEdgeKind };

export type GraphSolid = {
  readonly id: string;
  readonly kind: "terrain" | "solid";
  readonly box: Aabb;
  readonly coverage: GeometryCoverage;
  readonly moving: boolean;
};

export type MovementGraph = {
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  /** 脚点格是否被玩家盒子撞进实心体（严格相交，贴边不算）。 */
  readonly blocked: Uint8Array;
  /** 脚点格自由，且脚点下方一点点就撞 —— 站得住。 */
  readonly standable: Uint8Array;
  /** 每一列的落脚点 y（升序）。 */
  readonly columns: readonly (readonly number[])[];
  readonly player: RuntimePlayerGeometry;
  readonly solids: readonly GraphSolid[];
  readonly coverage: GeometryCoverage;
  freeAt(x: number, y: number): boolean;
  standableAt(x: number, y: number): boolean;
  /** 出生点附近一个身位内、脚点之下的落脚点（宽松接位）。 */
  startCells(): readonly Vec[];
};

const sweptBox = (box: Aabb, entity: GameEntity): Aabb => {
  if (!entity.motion) return box;
  const d = entity.motion.distance;
  return entity.motion.axis === "x"
    ? { x: Math.min(box.x, box.x + d), y: box.y, w: box.w + Math.abs(d), h: box.h }
    : { x: box.x, y: Math.min(box.y, box.y + d), w: box.w, h: box.h + Math.abs(d) };
};

/**
 * 建图。玩家资源解不到返回 `null` —— 那是引用族的事，本层不重复报。
 */
export function buildMovementGraph(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): MovementGraph | null {
  const player = runtimePlayerGeometry(config, manifest);
  if (!player) return null;

  const width = config.world.size.w;
  const height = config.world.size.h;
  const solids: GraphSolid[] = [];
  let coverage: GeometryCoverage = player.coverage;

  for (const [i, t] of config.terrain.entries()) {
    solids.push({ id: `terrain#${i}`, kind: "terrain", box: { x: t.x, y: t.y, w: t.w, h: t.h }, coverage: "checked", moving: false });
  }
  for (const entity of config.entities) {
    if (entity.kind !== "solid") continue;
    const geometry = runtimeEntityGeometry(entity, manifest, profile);
    if (!geometry) { coverage = "partial"; continue; }
    const box = profile.solidMotion === "swept" ? sweptBox(geometry.box, entity) : geometry.box;
    solids.push({
      id: entity.id, kind: "solid", box, coverage: geometry.coverage, moving: Boolean(entity.motion),
    });
    if (geometry.coverage === "partial") coverage = "partial";
  }

  // 脚点格被实心体撞进：玩家盒子以脚点为中心（x）、底边（y）对齐。
  const stride = height + 1;
  const blocked = new Uint8Array((width + 1) * stride);
  const halfW = player.size.w / 2;
  for (const solid of solids) {
    const x0 = Math.max(0, Math.floor(solid.box.x - halfW) + 1);
    const x1 = Math.min(width, Math.ceil(solid.box.x + solid.box.w + halfW) - 1);
    const y0 = Math.max(0, Math.floor(solid.box.y) + 1);
    const y1 = Math.min(height, Math.ceil(solid.box.y + solid.box.h + player.size.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }

  // 站得住：这里自由，且再往下一点点就撞。⚠️ 世界的底不是地板。
  const standable = new Uint8Array(blocked.length);
  for (let x = 0; x <= width; x++) {
    for (let y = 0; y <= height; y++) {
      const i = x * stride + y;
      if (blocked[i] === 0 && y + 1 <= height && blocked[i + 1] === 1) standable[i] = 1;
    }
  }

  const columns: number[][] = [];
  for (let x = 0; x <= width; x++) {
    const ys: number[] = [];
    for (let y = 0; y <= height; y++) if (standable[x * stride + y] === 1) ys.push(y);
    columns.push(ys);
  }

  const inBounds = (x: number, y: number): boolean => x >= 0 && x <= width && y >= 0 && y <= height;
  const freeAt = (x: number, y: number): boolean => inBounds(x, y) && blocked[x * stride + y] === 0;
  const standableAt = (x: number, y: number): boolean => inBounds(x, y) && standable[x * stride + y] === 1;

  return {
    width, height, stride, blocked, standable, columns, player, solids, coverage,
    freeAt, standableAt,
    startCells: () => {
      const out: Vec[] = [];
      const minX = Math.max(0, Math.round(player.foot.x - player.size.w));
      const maxX = Math.min(width, Math.round(player.foot.x + player.size.w));
      for (let x = minX; x <= maxX; x++)
        for (const y of columns[x] ?? []) if (y >= player.foot.y - player.size.h) out.push({ x, y });
      return out;
    },
  };
}

/** 同一列里第一个 y' > y 的落脚点。 */
export function nextStandableBelow(graph: MovementGraph, x: number, y: number): number | null {
  const ys = graph.columns[x];
  if (!ys) return null;
  let lo = 0;
  let hi = ys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ys[mid]! < y) lo = mid + 1;
    else hi = mid;
  }
  return lo < ys.length ? ys[lo]! : null;
}

/** 从任意自由格竖直下落能落到的第一个落脚点（fall 原语）。 */
export function fallTarget(graph: MovementGraph, x: number, y: number): number | null {
  return graph.freeAt(x, y) ? nextStandableBelow(graph, x, y + 1) : null;
}

/** 站得住的格子的 walk / walk-off / fall 边。 */
export function movementNeighbors(graph: MovementGraph, x: number, y: number): MovementEdge[] {
  if (!graph.standableAt(x, y)) return [];
  const out: MovementEdge[] = [];
  const seen = new Set<string>();
  const push = (nx: number, ny: number, kind: MovementEdgeKind): void => {
    const key = `${nx},${ny},${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x: nx, y: ny, kind });
  };

  for (const dx of [-1, 1] as const) {
    const nx = x + dx;
    if (!graph.freeAt(nx, y)) continue;
    if (graph.standableAt(nx, y)) push(nx, y, "walk");
    else {
      const ny = nextStandableBelow(graph, nx, y);
      if (ny !== null) push(nx, ny, "walk-off");
    }
  }

  const fy = nextStandableBelow(graph, x, y + 1);
  if (fy !== null) push(x, fy, "fall");
  return out;
}

/**
 * 从落脚点跳出去能落到的落脚点（按需计算）。
 * ⚠️ 与 `auditReachability` 是同一条抛物线；两种写法会漂移，LP-02 接线时必须只留这一份。
 */
export function hopTargets(graph: MovementGraph, x: number, y: number, move: MoveParams): Vec[] {
  const apex = maxJumpHeight(move);
  const maxDx = Math.ceil(jumpSpan(move, graph.height));
  const out: Vec[] = [];
  const v = move.jumpVelocity;
  const gravity = move.gravity;

  for (let dx = -maxDx; dx <= maxDx; dx++) {
    const bx = x + dx;
    if (bx < 0 || bx > graph.width) continue;
    for (const by of graph.columns[bx] ?? []) {
      if (bx === x && by === y) continue;
      const dh = y - by;
      if (dh > apex || dh < -graph.height) continue;
      const disc = v * v - 2 * gravity * dh;
      if (disc < 0) continue;
      const t = (v + Math.sqrt(disc)) / gravity;
      if (Math.abs(dx) > move.speed * t) continue;

      const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
      let clear = true;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const tt = t * f;
        const px = Math.round(x + dx * f);
        const py = Math.round(y - (v * tt - (gravity * tt * tt) / 2));
        if (px < 0 || px > graph.width || py < 0 || py > graph.height) continue;
        if (graph.blocked[px * graph.stride + py] === 1) { clear = false; break; }
      }
      if (clear) out.push({ x: bx, y: by });
    }
  }
  return out;
}

/** BFS 可达集（键 `"x,y"`）。`includeHop=false` 只走地面移动，给 LP-01 的测试与调试用。 */
export function reachableCells(
  graph: MovementGraph, starts: readonly Vec[], move: MoveParams, includeHop = true,
): Set<string> {
  const seen = new Set<string>();
  const queue: Vec[] = [];
  const add = (cell: Vec): void => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(cell);
  };
  for (const start of starts) add(start);

  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const edge of movementNeighbors(graph, cell.x, cell.y)) add({ x: edge.x, y: edge.y });
    if (includeHop) for (const target of hopTargets(graph, cell.x, cell.y, move)) add(target);
  }
  return seen;
}
