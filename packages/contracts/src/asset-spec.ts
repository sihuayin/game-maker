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
import { Anchor, Layer } from "./assetpack.js";

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
/**
 * **配方里的**一层：与交付清单那份（`Layer`）同形，**多一样只有作者知道的东西 —— 这一层画什么**。
 *
 * ⚠️ **为什么另开一个形状，而不是给 `Layer` 加个字段**（2026-09-30 · 票 02）：
 *   `Layer` 是 `assetpack`（**交付清单**）与这里**共用**的，而 `pack` 会把 `spec.layers`
 *   **原样拷进 manifest** ⇒ 加在那份上，**作者的散文会进交付清单**（而壳子从不读它）。
 *   这个分岔在清单里**早就有先例**：`role` 进、`description` 不进。
 *
 * ⚠️ 而**不用升 `assetpack/v2 → v3`**：清单那份 `Layer` **一个字没动**，
 *   磁盘上已有的包照旧解析得过（升版的判据见 `assetpack.ts` 的文件头）。
 */
export const LayerSpec = Layer.extend({
  /**
   * **这一层画什么。**缺省 = 回落到 `spec.description`（整张场景那份）。
   *
   * ⚠️ 不给它的时候，**每一层的提示词里写的都是整张场景** —— 模板那一行原样插 `spec.description`，
   *   而「整张场景」描述不了「这一层该画哪一段」。这是票 02 要补的那处缝。
   *
   * ⚠️ **别跟模板里最远那一支对着写**。模板对最远层另说一套
   *   （「这一层就是天空……整块画布从头到尾都要是画出来的颜色」），而那段是
   *   **票 51 四次真跑**量出来的（原禁色清单里那句「天空色」字面上就是「别画天空」）。
   *   ⚠️ 实测两版都跑过（只写正面 / 再补一句「更近的那几层不要画」），**结果一样** ——
   *   所以这不是一条硬规矩，是**别去跟一段量出来的话对着写**。
   */
  description: z.string().min(1).optional(),
});

export const BackgroundSpec = z.object({
  kind: z.literal("background"), ...COMMON,
  /**
   * 分层视差：**从远到近**各层。缺省 = 单层、无视差。**一层一帧**，
   * 帧名 = `<资源 id>.<层名>`（与 animation 的帧命名规则同构）。
   *
   * ⚠️ 层的形状与 manifest 里那份**共用一个定义**（`Layer`，见 assetpack.ts）。
   * ⚠️ **所有层共用 `spec.size`** —— 与 drawlist 的 `viewBox` 模型一致（内容可以比画布小），
   *   不引入第二套尺寸。要让一层铺满更宽的世界，用的是这一层自己的 `tileable`。
   * ⚠️ **2026-09-26（票 42）**：`tileable` 从**资源级下沉到层**。资源级那个表达不了
   *   「天空不平铺、墙和地平铺」—— 而三层背景里这恰恰是常态，且它当时零消费者。
   */
  layers: z.array(LayerSpec).optional(),
}).strict();

/**
 * 屏幕空间资源（面板、按钮、HUD）。
 *
 * ⚠️ 判据是**它活在屏幕空间还是世界空间**，不是「它长得像不像面板」——
 * 一个画着嵌套边框的世界道具仍然是 `sprite`（票 27 对 `bg_sign` 的裁决）。
 */
export const UiSpec = z.object({
  kind: z.literal("ui"), ...COMMON,
  /**
   * 九宫格四边内缩（像素）。中央区必须非空 —— 检查在 union 那一层做（见下）。
   * 它会被算成中央矩形的 `{x,y,w,h}` 写进交付态图集的 `scale9Borders`
   * （Phaser 的 `add.nineslice()` 零参数自动读）。
   */
  ninePatch: z.object({
    left: z.number().int().nonnegative(), right: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(), bottom: z.number().int().nonnegative(),
  }).strict().optional(),
}).strict();
// ⚠️ **`screenSpace` 已删除**（2026-09-26，票 42）：本类的**判据**就是
//   「它活在屏幕空间还是世界空间」（票 27 对 `bg_sign` 的裁决），所以 `kind: "ui"`
//   与「屏幕空间」本来就同义，那个字段是同义反复 —— 而它唯一非默认的取值
//   （`false`，即一个「世界空间的 ui」）描述的东西按定义是个 `sprite`。

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
