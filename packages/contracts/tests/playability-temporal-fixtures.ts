// **TEST_ONLY** —— U1 内存夹具：构造器 / 断言辅助 / 规范化序列化。
//
// ⚠️ 不注册测试、不读写文件系统、不被 `src/**` 引用、不含产品逻辑。
// ⚠️ 不新增 JSON fixture；所有边界值都在内存里构造。
import type { Aabb } from "../src/playability/geometry.js";
import {
  intersectContinuous,
  type CollisionInterval,
  type ContinuousCheckInput,
  type ContinuousCheckResult,
  type HazardBoxSpec,
  type TriangleMotion,
} from "../src/playability/temporal-motion.js";
import type {
  BudgetProfile,
  Certificate,
  Diagnostics,
  Stats,
  TemporalInternalResult,
} from "../src/playability/temporal-result.js";
import { parseAssetPack, parseGameConfig } from "../src/index.js";
import type { AssetPackManifest } from "../src/assetpack.js";
import type { GameConfig } from "../src/game-config.js";
import type { WitnessHazard } from "../src/playability/temporal-witness.js";

export type TriangleMotionArgs = {
  readonly atX?: number;
  readonly atY?: number;
  readonly distance?: number;
  readonly periodMs?: number;
};

/** 默认：`at=(0,0)`、往返 100px、周期 1000ms（上升段速度 0.2 px/ms）。 */
export const triangleMotion = (args: TriangleMotionArgs = {}): TriangleMotion => ({
  at: { x: args.atX ?? 0, y: args.atY ?? 0 },
  distance: args.distance ?? 100,
  periodMs: args.periodMs ?? 1000,
});

export type HazardSpecArgs = {
  readonly w?: number;
  readonly h?: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
};

/** 默认：20×20、底边中心锚点；`at.y = 0` 时盒子 y 区间为 `[-20, 0]`。 */
export const hazardSpec = (args: HazardSpecArgs = {}): HazardBoxSpec => ({
  size: { w: args.w ?? 20, h: args.h ?? 20 },
  anchor: { x: args.anchorX ?? 0.5, y: args.anchorY ?? 1 },
});

export const aabb = (x: number, y: number, w: number, h: number): Aabb => ({ x, y, w, h });

/** 默认玩家盒：`[40, 50] × [-20, 0]`，与默认 Hazard 盒的 y 区间严格重叠。 */
export const baseCheckInput = (
  overrides: Partial<ContinuousCheckInput> = {},
): ContinuousCheckInput => ({
  motion: triangleMotion(),
  hazard: hazardSpec(),
  playerBox: aabb(40, -20, 10, 20),
  playerSpeedX: 0,
  t0: 0,
  t1: 1000,
  ...overrides,
});

export const checkContinuous = (
  overrides: Partial<ContinuousCheckInput> = {},
): ContinuousCheckResult => intersectContinuous(baseCheckInput(overrides));

export type OkContinuousCheck = Extract<ContinuousCheckResult, { ok: true }>;

export const okResult = (result: ContinuousCheckResult): OkContinuousCheck => {
  if (!result.ok) throw new Error(`expected ok result, got ${result.reason}`);
  return result;
};

export const okIntervals = (result: ContinuousCheckResult): readonly CollisionInterval[] =>
  okResult(result).intervals;

export const intervalAt = (
  intervals: readonly CollisionInterval[],
  index: number,
): CollisionInterval => {
  const interval = intervals[index];
  if (interval === undefined) throw new Error(`missing interval at index ${index}`);
  return interval;
};

/** 完整 `BudgetProfile` 夹具；默认值与 D5 / D5B 一致。 */
export const budgetProfileFixture = (overrides: Partial<BudgetProfile> = {}): BudgetProfile => ({
  maxStates: 500_000,
  maxEdges: 1_600_000,
  timeBudgetMs: 2_000,
  maxCutsPerCheck: 1_000_000,
  maxCutsPerBranch: 5_000_000,
  maxWitnessTransitions: 1_000_000,
  maxWitnessBytes: 64 * 1024 * 1024,
  maxHopSamples: 240,
  timeBudgetCheckpointWork: 1024,
  ...overrides,
});

export type InternalResultOverrides = {
  readonly internalResult?: TemporalInternalResult["internalResult"];
  readonly certificate?: Certificate;
  readonly grid?: Partial<Stats["grid"]>;
  readonly work?: Partial<Stats["work"]>;
  readonly timing?: Partial<Stats["timing"]>;
  readonly budget?: Partial<Stats["budget"]>;
  readonly diagnostics?: Partial<Diagnostics>;
  readonly determinismSignature?: string;
};

/** 最小 D9 结果夹具；U1 子集的 `certificate` 默认 `{ kind: "none" }`。 */
export const internalResultFixture = (
  overrides: InternalResultOverrides = {},
): TemporalInternalResult => ({
  internalResult: overrides.internalResult ?? "insufficient-evidence",
  modelConditional: true,
  publicCapability: "BLOCKED",
  publicResult: null,
  certificate: overrides.certificate ?? { kind: "none" },
  stats: {
    grid: {
      phaseSteps: 10,
      dtMs: 100,
      xStep: 1,
      xPositions: 100,
      stateCapacity: 1000,
      phaseGridCapped: false,
      phaseCapReason: null,
      N_max: 20,
      ...overrides.grid,
    },
    work: {
      statesEnqueued: 0,
      statesVisited: 0,
      edgesChecked: 0,
      cutPointsTotal: 3,
      segmentsTotal: 4,
      hopSamplesChecked: 0,
      witnessTransitions: 0,
      witnessBytes: 0,
      maxBranching: 2,
      workUnitsSinceLastCheckpoint: 5,
      ...overrides.work,
    },
    timing: {
      wallClockMs: 12,
      timeBudgetCheckpointWork: 1024,
      ...overrides.timing,
    },
    budget: {
      budgetProfile: budgetProfileFixture(),
      budgetStatus: "complete",
      budgetKind: null,
      ...overrides.budget,
    },
    determinismSignature: overrides.determinismSignature ?? "00000000",
  },
  diagnostics: {
    degradationReason: null,
    secondaryReasons: [],
    ...overrides.diagnostics,
  },
});

/** 规范化 JSON：对象键排序、数组保留语义顺序。 */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const record = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });

/** 剔除 `wallClockMs` / `detail` 后的完整结果视图，供逐字节比较。 */
export const deterministicView = (result: TemporalInternalResult): unknown => ({
  ...result,
  stats: {
    ...result.stats,
    timing: {
      timeBudgetCheckpointWork: result.stats.timing.timeBudgetCheckpointWork,
    },
  },
  diagnostics: {
    degradationReason: result.diagnostics.degradationReason,
    secondaryReasons: result.diagnostics.secondaryReasons,
  },
});

// ── U2-06：内存世界夹具（**不读文件系统**） ─────────────────────────────────
//
// ⚠️ 这些构造器只产出 raw object，由调用方交给 `parseGameConfig` / `parseAssetPack`
//    做 schema 校验；夹具本身不注册测试、不写盘、不被 `src/**` 引用。
//
// 世界形状（默认）：
//   - 一块 100×60 的地面世界，地面顶边 y = 40，玩家脚点固定 y = 40；
//   - 玩家 2×20（脚点 x 为整数格，盒 `[x−1, x+1] × [20, 40]`）；
//   - spawn x = 5，goal 在 x = 90（anchor 0.5/1，盒 `[87, 93] × [20, 40]`）；
//   - 周期移动 Hazard 4×12，锚点在 `[50, 60]` 往返、周期 200ms；
//   - 玩家速度 20 px/s ⇒ `maxSpeed = 0.02 px/ms`、`N_max = 4`、`dt = 50ms`、
//     `maxStep = 1px`（一条 move 最多走一格）。
//
// 所有派生量都只是**输入**（速度 / 周期 / 尺寸 / spawn），不是对产品逻辑的复刻。
export type WitnessWorldOptions = {
  readonly worldW?: number;
  readonly worldH?: number;
  /** 地面顶边 = 玩家脚点 y。 */
  readonly footY?: number;
  readonly groundH?: number;
  readonly playerW?: number;
  readonly playerH?: number;
  /** `config.player.move.speed`，px/s。 */
  readonly playerSpeed?: number;
  readonly spawnX?: number;
  readonly spawnY?: number;
  readonly goalX?: number;
  readonly goalW?: number;
  readonly goalH?: number;
  readonly hazardX?: number;
  readonly hazardY?: number;
  readonly hazardDistance?: number;
  readonly hazardPeriodMs?: number;
  readonly hazardW?: number;
  readonly hazardH?: number;
  /** 非 null 时在脚点行放一块 `wallW × wallH` 的 solid（会把走廊切断）。 */
  readonly wallX?: number | null;
  readonly wallW?: number;
  readonly wallH?: number;
};

const WITNESS_DEFAULTS = {
  worldW: 100,
  worldH: 60,
  footY: 40,
  groundH: 10,
  playerW: 2,
  playerH: 20,
  playerSpeed: 20,
  spawnX: 5,
  goalX: 90,
  goalW: 6,
  goalH: 20,
  hazardX: 50,
  hazardDistance: 10,
  hazardPeriodMs: 200,
  hazardW: 4,
  hazardH: 12,
  wallX: null,
  wallW: 2,
  wallH: 20,
} as const;

const resolvedWitnessWorld = (options: WitnessWorldOptions) => ({
  worldW: options.worldW ?? WITNESS_DEFAULTS.worldW,
  worldH: options.worldH ?? WITNESS_DEFAULTS.worldH,
  footY: options.footY ?? WITNESS_DEFAULTS.footY,
  groundH: options.groundH ?? WITNESS_DEFAULTS.groundH,
  playerW: options.playerW ?? WITNESS_DEFAULTS.playerW,
  playerH: options.playerH ?? WITNESS_DEFAULTS.playerH,
  playerSpeed: options.playerSpeed ?? WITNESS_DEFAULTS.playerSpeed,
  spawnX: options.spawnX ?? WITNESS_DEFAULTS.spawnX,
  spawnY: options.spawnY ?? options.footY ?? WITNESS_DEFAULTS.footY,
  goalX: options.goalX ?? WITNESS_DEFAULTS.goalX,
  goalW: options.goalW ?? WITNESS_DEFAULTS.goalW,
  goalH: options.goalH ?? WITNESS_DEFAULTS.goalH,
  hazardX: options.hazardX ?? WITNESS_DEFAULTS.hazardX,
  hazardY: options.hazardY ?? options.footY ?? WITNESS_DEFAULTS.footY,
  hazardDistance: options.hazardDistance ?? WITNESS_DEFAULTS.hazardDistance,
  hazardPeriodMs: options.hazardPeriodMs ?? WITNESS_DEFAULTS.hazardPeriodMs,
  hazardW: options.hazardW ?? WITNESS_DEFAULTS.hazardW,
  hazardH: options.hazardH ?? WITNESS_DEFAULTS.hazardH,
  wallX: options.wallX ?? WITNESS_DEFAULTS.wallX,
  wallW: options.wallW ?? WITNESS_DEFAULTS.wallW,
  wallH: options.wallH ?? WITNESS_DEFAULTS.wallH,
});

const zeroChecksum = "sha256:" + "0".repeat(64);

/** 最小合法 `assetpack/v4` raw object；所有尺寸随世界选项变化。 */
export const witnessManifestRaw = (options: WitnessWorldOptions = {}): unknown => {
  const w = resolvedWitnessWorld(options);
  const asset = (
    id: string,
    kind: "sprite" | "animation" | "background" | "ui",
    size: { w: number; h: number },
    frames: string[],
    animations?: { name: string; frames: string[] }[],
  ) => ({
    id,
    kind,
    role: `u2 fixture ${id}`,
    origin: "generated",
    paletteBinding: "exact",
    required: true,
    size,
    anchor: { x: 0.5, y: 1 },
    atlasId: "sprites",
    frames: frames.map((name) => ({ name })),
    ...(animations === undefined ? {} : { animations }),
    authoring: [{ kind: "drawlist", ref: `authoring/drawlist/${id}.json` }],
  });

  const assets = [
    asset("hero", "animation", { w: w.playerW, h: w.playerH },
      ["hero.idle", "hero.run", "hero.jump"],
      [
        { name: "idle", frames: ["hero.idle"] },
        { name: "run", frames: ["hero.run"] },
        { name: "jump", frames: ["hero.jump"] },
      ]),
    asset("bg", "background", { w: w.worldW, h: w.worldH }, ["bg"]),
    asset("beacon", "sprite", { w: w.goalW, h: w.goalH }, ["beacon"]),
    asset("hazard", "sprite", { w: w.hazardW, h: w.hazardH }, ["hazard"]),
    asset("wall", "sprite", { w: w.wallW, h: w.wallH }, ["wall"]),
    asset("panel", "ui", { w: 8, h: 8 }, ["panel"]),
    asset("pip", "ui", { w: 2, h: 2 }, ["pip"]),
  ];

  return {
    format: "assetpack/v4",
    id: "u2-memory-world",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    generator: { name: "u2-fixture", version: "0.0.0" },
    provenance: { mode: "generated" },
    palette: {
      ref: "authoring/stylespec.json#/palette",
      size: 3,
      values: ["#000000", "#ffffff", "#ff0000"],
      coverage: { exact: 3, composited: 0, quantized: 0, unbound: 0 },
    },
    atlases: [{
      id: "sprites",
      kind: "sprite",
      meta: "delivery/atlas.sprites.json",
      image: "delivery/atlas.sprites.png",
      size: { w: 32, h: 32 },
      frames: 10,
      assets: assets.map((a) => a.id),
      checksum: zeroChecksum,
    }],
    assets,
    files: [
      { path: "delivery/atlas.sprites.json", bytes: 1, checksum: zeroChecksum },
      { path: "delivery/atlas.sprites.png", bytes: 1, checksum: zeroChecksum },
      ...assets.map((a) => ({ path: `authoring/drawlist/${a.id}.json`, bytes: 1, checksum: zeroChecksum })),
    ],
  };
};

/** 最小合法 `game-config/v1` raw object；spawn / goal / hazard / wall 都来自世界选项。 */
export const witnessConfigRaw = (options: WitnessWorldOptions = {}): unknown => {
  const w = resolvedWitnessWorld(options);
  const entities: unknown[] = [
    {
      id: "goal",
      kind: "goal",
      at: { x: w.goalX, y: w.footY },
      asset: "beacon",
    },
    {
      id: "hazard",
      kind: "hazard",
      at: { x: w.hazardX, y: w.hazardY },
      asset: "hazard",
      motion: {
        kind: "cycle",
        axis: "x",
        distance: w.hazardDistance,
        periodMs: w.hazardPeriodMs,
      },
    },
  ];
  if (w.wallX !== null) {
    entities.push({
      id: "wall",
      kind: "solid",
      at: { x: w.wallX, y: w.footY },
      asset: "wall",
    });
  }
  return {
    format: "game-config/v1",
    world: { size: { w: w.worldW, h: w.worldH } },
    scene: { background: { asset: "bg" } },
    player: {
      asset: "hero",
      anims: { idle: "idle", run: "run", jump: "jump" },
      at: { x: w.spawnX, y: w.spawnY },
      move: { speed: w.playerSpeed, jumpVelocity: 330, gravity: 900 },
    },
    terrain: [{ x: 0, y: w.footY, w: w.worldW, h: w.groundH }],
    entities,
    hud: {
      panel: { asset: "panel", at: { x: 0, y: 0 }, size: { w: 8, h: 8 } },
      pip: { asset: "pip", at: { x: 0, y: 0 }, step: { x: 2, y: 0 } },
    },
    objective: { kind: "collect-then-reach", gate: "goal" },
  };
};

/** 解析后的 manifest；夹具构造必须自身过 schema。 */
export const witnessManifest = (options: WitnessWorldOptions = {}): AssetPackManifest => {
  const parsed = parseAssetPack(witnessManifestRaw(options));
  if (!parsed.ok) throw new Error("U2 内存 manifest 不过 schema：" + parsed.errors.join("；"));
  return parsed.value;
};

/** 解析后的 config；夹具构造必须自身过 schema。 */
export const witnessConfig = (options: WitnessWorldOptions = {}): GameConfig => {
  const parsed = parseGameConfig(witnessConfigRaw(options));
  if (!parsed.ok) throw new Error("U2 内存 config 不过 schema：" + parsed.errors.join("；"));
  return parsed.value;
};

/** 解析后的 config + manifest 一起取。 */
export const witnessWorld = (
  options: WitnessWorldOptions = {},
): { readonly config: GameConfig; readonly manifest: AssetPackManifest } => ({
  config: witnessConfig(options),
  manifest: witnessManifest(options),
});

/** 与 config 中 hazard 实体一致的 `WitnessHazard`（motion + manifest 盒）。 */
export const witnessHazard = (options: WitnessWorldOptions = {}): WitnessHazard => {
  const w = resolvedWitnessWorld(options);
  const motion: TriangleMotion = {
    at: { x: w.hazardX, y: w.hazardY },
    distance: w.hazardDistance,
    periodMs: w.hazardPeriodMs,
  };
  const box: HazardBoxSpec = {
    size: { w: w.hazardW, h: w.hazardH },
    anchor: { x: 0.5, y: 1 },
  };
  return { motion, box };
};

/** 世界几何派生量（测试断言用；只复述输入，不实现产品逻辑）。 */
export const witnessWorldGeometry = (options: WitnessWorldOptions = {}) => {
  const w = resolvedWitnessWorld(options);
  return {
    ...w,
    playerHalfW: w.playerW / 2,
    maxSpeedPxPerMs: w.playerSpeed / 1000,
    nMax: Math.floor((w.playerSpeed / 1000) * w.hazardPeriodMs),
  } as const;
};
