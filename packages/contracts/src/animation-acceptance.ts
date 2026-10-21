// `animation-acceptance/v1` —— 一次动画 / 资源验收的**可追溯报告**（Phase 1 Q4 A）。
//
// ⚠️ **它不是 `qa-report/v1` 的扩展**：QA 报告是「游戏能不能跑」的裁决；
//   这份是「交付的动画 / 图集长什么样、和基线差多少」的验收证据。两者不共享语义
//   （Phase 0 计划 §10）。
//
// 三条边界（计划 §4.1）：
//   1. `findings[]` 每条**必须能定位**（file / assetId / anim / frame 至少一个）——
//      「某处有问题」在 61 帧的图集上等于没说。
//   2. `human.items` 的 7 项**必须齐**：少一项就不是「看过」，是「看了一部分」。
//   3. `runtime` 只记录声明 vs 实际，**不参与结构验收**（Q1 A：运行时不修）。
import { z } from "zod";
import { Checksum } from "./assetpack.js";
import { formatIssues } from "./zod-issues.js";

export const ANIMATION_ACCEPTANCE_FORMAT = "animation-acceptance/v1" as const;

/** 报告里的一张图集：只钉身份与 checksum，不复制帧表（帧表在图集 JSON 里）。 */
export const AcceptanceAtlasRef = z.object({
  id: z.string().min(1),
  imageChecksum: Checksum,
  metaChecksum: Checksum
}).strict();

export type AcceptanceAtlasRef = z.infer<typeof AcceptanceAtlasRef>;

/** 被验收的包身份。`manifestChecksum` 是 manifest 文件的 sha256。 */
export const AcceptancePackRef = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  manifestChecksum: Checksum,
  atlases: z.array(AcceptanceAtlasRef)
}).strict();

export type AcceptancePackRef = z.infer<typeof AcceptancePackRef>;

/**
 * 对照基准的身份。`path` 是仓库内 / 显式基准目录里的相对路径，**不是**包内路径，
 * 所以不复用 `assetpack.ts` 的 `PackPath`。
 */
export const AcceptanceBaselineRef = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  checksum: Checksum,
  standardVersion: z.string().min(1)
}).strict();

export type AcceptanceBaselineRef = z.infer<typeof AcceptanceBaselineRef>;

/**
 * 票 12 的七项读数。⚠️ **没有 baseline 时整块为 `null`**（计划 §4.1）——
 * 「没量」与「量了是 0」必须是两种写法。
 */
export const AcceptanceMetrics = z.object({
  alphaMaskDiffPct: z.number().min(0).max(100),
  bboxWidthDiffPct: z.number().nonnegative(),
  positionDriftPct: z.number().nonnegative(),
  backgroundL1: z.number().nonnegative(),
  paletteCountMin: z.number().int().nonnegative(),
  offPalette: z.number().int().nonnegative(),
  boundaryDarkPctMin: z.number().min(0).max(100)
}).strict();

export type AcceptanceMetrics = z.infer<typeof AcceptanceMetrics>;

export const AcceptanceSeverity = z.enum(["error", "warning", "info"]);
export type AcceptanceSeverity = z.infer<typeof AcceptanceSeverity>;

/**
 * 一条 finding。
 *
 * ⚠️ `code` 是**点分隔的闭集**（例：`atlas.frame.out-of-bounds`）；闭集由产生方
 *   `packages/assets/src/acceptance.ts` 拥有。这里只钉「非空字符串」——
 *   在契约这一层枚举还没定稿的码，会让实现方为了一个新检查回头改契约版本，
 *   而这里真正要守的是**严重度与可定位性**。
 */
export const AcceptanceFinding = z.object({
  code: z.string().min(1),
  severity: AcceptanceSeverity,
  message: z.string().min(1),
  file: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  anim: z.string().min(1).optional(),
  frame: z.string().min(1).optional()
}).strict().superRefine((f, ctx) => {
  if (!f.file && !f.assetId && !f.anim && !f.frame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["file"],
      message: "finding 至少需要一个定位字段：file / assetId / anim / frame"
    });
  }
});

export type AcceptanceFinding = z.infer<typeof AcceptanceFinding>;

/** 动画指标的绿 / 黄 / 红。⚠️ 无 baseline 时没有读数，`verdict` 为 `null`。 */
export const AcceptanceVerdict = z.enum(["green", "yellow", "red"]);
export type AcceptanceVerdict = z.infer<typeof AcceptanceVerdict>;

/** 逐动画的验收条目。⚠️ `findings[].anim` 回指这里的 `anim`。 */
export const AcceptanceAnimation = z.object({
  assetId: z.string().min(1),
  anim: z.string().min(1),
  frames: z.array(z.string().min(1)).min(1),
  /** manifest 里**声明**的值。`fps` 在 `assetpack` 契约里是可选的，所以这里可为 `null`。 */
  declared: z.object({
    fps: z.number().positive().nullable(),
    loop: z.boolean()
  }).strict(),
  metrics: AcceptanceMetrics.nullable(),
  verdict: AcceptanceVerdict.nullable(),
  findings: z.array(AcceptanceFinding)
}).strict();

export type AcceptanceAnimation = z.infer<typeof AcceptanceAnimation>;

/** 人裁的 7 项 key（计划 §4.1 逐字）。顺序即报告里的展示顺序。 */
export const HUMAN_REVIEW_ITEM_KEYS = [
  "identity",
  "pose",
  "lighting",
  "loop",
  "alpha",
  "outline",
  "style"
] as const;

export type HumanReviewItemKey = (typeof HUMAN_REVIEW_ITEM_KEYS)[number];

export const HumanVerdict = z.enum(["pending", "pass", "fail"]);
export type HumanVerdict = z.infer<typeof HumanVerdict>;

export const HumanReviewItem = z.object({
  key: z.enum(HUMAN_REVIEW_ITEM_KEYS),
  label: z.string().min(1),
  verdict: HumanVerdict,
  note: z.string()
}).strict();

export type HumanReviewItem = z.infer<typeof HumanReviewItem>;

/**
 * 人裁块。7 项必须**齐全且不重复**：`.length(7)` 管数量，superRefine 管
 * 「7 个不同 key」。少了 / 重了都不是「看过」。
 */
export const AcceptanceHuman = z.object({
  verdict: HumanVerdict,
  reviewer: z.string().min(1).nullable(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  items: z.array(HumanReviewItem).length(7).superRefine((items, ctx) => {
    const seen = new Set(items.map((i) => i.key));
    for (const key of HUMAN_REVIEW_ITEM_KEYS) {
      if (!seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [],
          message: `人裁项缺失或重复："${key}"`
        });
      }
    }
  }),
  /** 证据文件路径（联系表 / 循环预览 / 截图），供追溯。 */
  evidence: z.array(z.string().min(1))
}).strict();

export type AcceptanceHuman = z.infer<typeof AcceptanceHuman>;

/** 运行时证据的状态。⚠️ **不参与结构验收的 exit code**（Q1 A）。 */
export const RuntimeStatus = z.enum(["verified", "unverified", "not-run"]);
export type RuntimeStatus = z.infer<typeof RuntimeStatus>;

/** manifest 声明 vs 运行时实测。只记录有实测的动画。 */
export const DeclaredVsActual = z.object({
  anim: z.string().min(1),
  declaredFps: z.number().positive(),
  actualFps: z.number().positive(),
  declaredLoop: z.boolean(),
  actualLoop: z.boolean()
}).strict();

export type DeclaredVsActual = z.infer<typeof DeclaredVsActual>;

export const AcceptanceRuntime = z.object({
  status: RuntimeStatus,
  evidence: z.array(z.string().min(1)),
  declaredVsActual: z.array(DeclaredVsActual)
}).strict();

export type AcceptanceRuntime = z.infer<typeof AcceptanceRuntime>;

export const AnimationAcceptance = z.object({
  format: z.literal(ANIMATION_ACCEPTANCE_FORMAT),
  createdAt: z.string().datetime({ offset: true }),
  toolVersion: z.string().min(1),
  pack: AcceptancePackRef,
  /** 没有对照基准时为 `null`；此时每个动画的 `metrics` / `verdict` 也应为 `null`。 */
  baseline: AcceptanceBaselineRef.nullable(),
  animations: z.array(AcceptanceAnimation),
  findings: z.array(AcceptanceFinding),
  human: AcceptanceHuman,
  runtime: AcceptanceRuntime
}).strict();

export type AnimationAcceptance = z.infer<typeof AnimationAcceptance>;

export function parseAnimationAcceptance(input: unknown): { ok: true; value: AnimationAcceptance } | { ok: false; errors: string[] } {
  const r = AnimationAcceptance.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: formatIssues(r.error) };
}
