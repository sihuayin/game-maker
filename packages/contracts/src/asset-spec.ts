// AssetSpec —— 「**需要什么**」的规格，四类一等公民（R4）。
//
// ⚠️ 它与 [[Asset]] 是 **Spec 与 Artifact 两层**：
//   AssetSpec 是设计意图（有尺寸/锚点/动画的**需求**），
//   DrawList / 位图 / manifest 是实际做出的东西。
//   两者的对账在 `audit.ts` 的 `auditAssetSpec()`。
//
// ⚠️ **两类逃生舱（`visual` / `geometry`）已删除**（票 27）。R2 之后确定性校验是唯一留下的
//   质量控制，而 `z.record(z.unknown())` 正是「校验不到的地方」。现在四类各有自己的字段，
//   任何一个字段都能被校验，就没地方藏东西了。
import { z } from "zod";
import { Anchor } from "./assetpack.js";

/** 四类的**公共部分** —— 抽出来当基类，因为「生成它必须知道的信息」里有一半是四类共有的。 */
const COMMON = {
  id: z.string().min(1),
  role: z.string(),
  description: z.string(),
  styleId: z.string(),
  /** 逐资源声明的锚点（票 26：**不能**从 ink 包围盒自动推 —— 那会把 jump 帧的脚钉回地面）。 */
  anchor: Anchor,
  /** 交付态的目标尺寸（像素）。 */
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  /** 只用于**生成顺序**，不用于组合（票 05）。 */
  dependencies: z.array(z.string()).default([]),
  required: z.boolean().default(true),
};

/**
 * 一个动画的**需求**：名字 + **帧数** + 播放参数。
 *
 * ⚠️ `frames` 是**数量**（要几帧），不是「哪几帧」—— 后者是**产物**（manifest 的
 * `Animation.frames` 是帧名列表）。两者的对账见 `auditAssetSpec()`。
 */
export const AnimationSpec = z.object({
  name: z.string().min(1),
  frames: z.number().int().positive(),
  fps: z.number().positive().optional(),
  loop: z.boolean().default(true),
}).strict();

/** 单帧静止资源（道具、砖块、平台）。**不允许声明动画** —— 那是 `animation` 类的事。 */
export const SpriteSpec = z.object({ kind: z.literal("sprite"), ...COMMON }).strict();

/** 多帧、按时间播放。**必须声明至少一个动画**（票 26：动画是 Asset 内部唯一的分组概念）。 */
export const AnimatedSpec = z.object({
  kind: z.literal("animation"), ...COMMON,
  animations: z.array(AnimationSpec).min(1),
}).strict();

/** 场景尺度。与 `sprite` 的分野是**尺寸级别与镜头关系**，不是画法。 */
export const BackgroundSpec = z.object({
  kind: z.literal("background"), ...COMMON,
  /** 分层视差：从远到近各层的视差系数（0 = 完全跟随镜头）。缺省 = 单层、无视差。 */
  layers: z.array(z.object({ parallax: z.number().min(0) }).strict()).optional(),
  /** 可平铺的轴。⚠️ 目前只是**声明** —— 接缝一致性检查需要渲染后扫像素，尚未实现。 */
  tileable: z.object({ x: z.boolean(), y: z.boolean() }).strict().optional(),
}).strict();

/**
 * 屏幕空间资源（面板、按钮、HUD）。
 *
 * ⚠️ 判据是**它活在屏幕空间还是世界空间**，不是「它长得像不像面板」——
 * 一个画着嵌套边框的世界道具仍然是 `sprite`（票 27 对 `bg_sign` 的裁决）。
 */
export const UiSpec = z.object({
  kind: z.literal("ui"), ...COMMON,
  /** 九宫格四边内缩（像素）。中央区必须非空 —— 检查在 union 那一层做（见下）。 */
  ninePatch: z.object({
    left: z.number().int().nonnegative(), right: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(), bottom: z.number().int().nonnegative(),
  }).strict().optional(),
  /** 尺寸按视口算而不是世界坐标。四类里只有 UI 是屏幕空间，所以默认 true。 */
  screenSpace: z.boolean().default(true),
}).strict();

// ⚠️ 九宫格那条检查必须放在 **union 这一层**：`.superRefine()` 会把成员变成 `ZodEffects`，
// 而 `discriminatedUnion` 只接受 `ZodObject`。放在这里反而更清楚 —— 它是**类级**的规则。
export const AssetSpecSchema = z
  .discriminatedUnion("kind", [SpriteSpec, AnimatedSpec, BackgroundSpec, UiSpec])
  .superRefine((s, ctx) => {
    if (s.kind !== "ui" || !s.ninePatch) return;
    const { left, right, top, bottom } = s.ninePatch;
    // 中央区为空的话，拉伸时九宫格要么算出负宽高，要么把边框本身拉长 —— 两种都不是想要的
    if (left + right >= s.size.w)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `九宫格左右内缩之和 ${left + right} ≥ 宽度 ${s.size.w} —— 中央区会空`, path: ["ninePatch"] });
    if (top + bottom >= s.size.h)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `九宫格上下内缩之和 ${top + bottom} ≥ 高度 ${s.size.h} —— 中央区会空`, path: ["ninePatch"] });
  });

export type AssetSpec = z.infer<typeof AssetSpecSchema>;
export type AnimationSpec = z.infer<typeof AnimationSpec>;
export type SpriteSpec = z.infer<typeof SpriteSpec>;
export type AnimatedSpec = z.infer<typeof AnimatedSpec>;
export type BackgroundSpec = z.infer<typeof BackgroundSpec>;
export type UiSpec = z.infer<typeof UiSpec>;
