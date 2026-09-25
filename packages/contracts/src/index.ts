// 各阶段之间**唯一**的通信面（docs/文档.md 第 5.1 节 Contract First）。
//
// ⚠️ 这里只放**当前终点**用得到的契约。2026-09-24 的重画把自我修复闭环整体判出局
// （R2），随它出局的 schema 已从本文件删除 —— 明细见票 07 的 Answer。
// 需要历史的，去 git 历史里找 `demo/src/contracts/index.ts`。
import { z } from "zod";
import { PaletteSchema } from "./drawlist.js";
import { AssetSpecSchema } from "./asset-spec.js";

// ── 需求 ──────────────────────────────────────────────────────────────────
export const RequirementPriority = z.enum(["core", "important", "optional"]);
export const RequirementSchema = z.object({
  id: z.string(), description: z.string(), priority: RequirementPriority,
  acceptance: z.array(z.string()).default([])
});
export type Requirement = z.infer<typeof RequirementSchema>;

// ── 风格 ──────────────────────────────────────────────────────────────────
/**
 * 从参考图提取出的**视觉语法**，不是参考图的描述（docs/文档.md 第 11 节）。
 *
 * ⚠️ `palette` 是**有序数组**，drawlist 用 `palette:<下标>` 引用它（票 24 / 票 36）。
 * 有序是硬约束：换掉整个色板时，创作态文本必须**一字不变**。
 */
export const StyleSpecSchema = z.object({
  id: z.string(),
  identity: z.array(z.string()),
  camera: z.record(z.unknown()).default({}),
  composition: z.record(z.unknown()).default({}),
  // ⚠️ 规范化色板（票 24 Q3 定的落点）：**有序**、小写 `#rrggbb`、不得重复色。
  // 「换掉整个色板 → 创作态文本一字不变」这条性质全靠它的**顺序**稳定。
  palette: PaletteSchema.default([]),
  lighting: z.record(z.unknown()).default({}),
  shapeLanguage: z.array(z.string()).default([]),
  material: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  characterStyle: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});
export type StyleSpec = z.infer<typeof StyleSpecSchema>;

// ── 游戏 ──────────────────────────────────────────────────────────────────
export const GameSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreLoop: z.array(z.string()),
  world: z.record(z.unknown()).default({}),
  player: z.record(z.unknown()).default({}),
  mechanics: z.array(z.string()),
  entities: z.array(z.record(z.unknown())),
  scenes: z.array(z.record(z.unknown())),
  ui: z.array(z.record(z.unknown())),
  rules: z.array(z.string()),
  winConditions: z.array(z.string()),
  loseConditions: z.array(z.string()),
  requirements: z.array(RequirementSchema)
});
export type GameSpec = z.infer<typeof GameSpecSchema>;

// ── 资源规格 ──────────────────────────────────────────────────────────────


// ── 产物引用 ──────────────────────────────────────────────────────────────
/**
 * ⚠️ 归属权在票 18。票 24 已判定资源包内**不用** ArtifactRef（包内每个文件只需
 * path/bytes/checksum，version 与 createdAt 是包级的）。本类型保留给包**之间**的引用，
 * 等票 18 收口。`ArtifactType` 里 evaluation / repair-plan / benchmark 三项随 R2 出局，
 * 一并留给票 18 处置。
 */
export const ArtifactType = z.enum([
  "requirement","style-spec","game-spec","asset-manifest","asset","scene",
  "build","screenshot","evaluation","repair-plan","benchmark"
]);
export const ArtifactRefSchema = z.object({
  id: z.string(), type: ArtifactType, path: z.string(),
  version: z.number().int().positive(), checksum: z.string(), createdAt: z.string()
});
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

// ── 创建项目 ──────────────────────────────────────────────────────────────
export const CreationProjectSchema = z.object({
  id: z.string(), title: z.string(), requirement: z.string(),
  referenceImage: z.string().optional(), createdAt: z.string()
});
export type CreationProject = z.infer<typeof CreationProjectSchema>;

// ── 创作态：drawlist ──────────────────────────────────────────────────────
export * from "./drawlist.js";
export * from "./geometry.js";

// ── 交付态：资源包自描述 ──────────────────────────────────────────────────
export * from "./assetpack.js";

// ── 资源规格（四类）与确定性校验 ──────────────────────────────────────────
export * from "./asset-spec.js";
export * from "./audit.js";
export * from "./recipe.js";
