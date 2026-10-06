// `asset-recipe/v1` 的 **v4 镜像** —— **只为一个消费者存在**：`plan-assets` 那一次工具调用。
//
// ⚠️ **为什么需要它**（票 12 的 Q4 裁定逼出来的）：`toolInputSchema` **只吃 `zod/v4`**
//   （票 28 定的边界：v3 的 `ZodObject` 连 `_zod` 都没有 ⇒ `toJSONSchema` 直接崩），
//   而 `recipe.ts` 是 **v3** 写的旧契约。⇒ 想让 planner 走 R16 的强制工具调用，就必须有一份 v4 的形状。
//   **先例是票 02**：`visual-world.ts` 里为 `StyleSpec` 立过同一款镜像（v3/v4 不许互相嵌套）。
//
// ⚠️ **它只镜像「形状」** —— 类型 · 可选性 · 封口 · 长度下限 · 枚举 · 默认值。
//   **一个 `refine` 都不镜像**，两条理由缺一不可：
//     ① `toJSONSchema` **静默丢掉** `superRefine`（票 08 实测）⇒ 镜像里有没有它们，**模型看见的一样**；
//     ② 把那些判据在两种方言里各写一遍，就是 `derivePackMode` 那种「写入侧与校验侧各写一份必然漂移」。
//   ⇒ 于是**权威是 v3 那一份**，本文件只是**线形状**。两段的分工写死在调用方：
//     `parseToolUse(..., RecipeToolSchema)` 判「**入参过没过线**」，
//     紧接着 `parseRecipe(...)`（v3）判「**这份清单成不成立**」（依赖图 · 母版比例 · 九宫格中央区 ·
//     路径字符）。v3 那一步不过 ⇒ 同样算 `schema` 失败、重采样。
//
// ⚠️ **默认值必须逐字跟上**（`required` / `loop` / `tileable.{x,y}`）：`io: "input"` 下带 `.default()`
//   的字段对模型是**可选**的，漏一个默认值，镜像与原件在「省略该键的输入」上就会分叉。
//
// ⚠️ **漂移测试盯着这一条**（`tests/recipe-tool.test.ts`）：拿**真实 fixture** 与一批边界输入
//   比对**行为**（两份都过 / 两份都拒），而把上面那几条 refines **写成明示例外**。
import { z } from "zod/v4";

/** 与 `assetpack.ts` 的 `Anchor` 同形。 */
const AnchorShape = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
});

/** 与 `assetpack.ts` 的 `Layer` 同形（⚠️ 默认值 `false` 也要跟上）。 */
const LayerShape = z.strictObject({
  name: z.string().min(1),
  parallax: z.number().min(0),
  tileable: z
    .strictObject({ x: z.boolean().default(false), y: z.boolean().default(false) })
    .optional()
});

/** 与 `asset-spec.ts` 的 `LayerSpec` 同形。 */
const LayerSpecShape = LayerShape.extend({
  description: z.string().min(1).optional()
});

const SizeShape = z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() });

/** 与 `asset.ts` 的 `InputPath` 同形 —— **只到 `min(1)`**：路径的字符检查归 v3（见文件头）。 */
const InputPathShape = z.string().min(1);

const AnimationSpecShape = z.strictObject({
  name: z.string().min(1),
  frames: z.number().int().positive(),
  fps: z.number().positive().optional(),
  loop: z.boolean().default(true)
});

/** 四类的公共部分（对 `asset-spec.ts` 的 `COMMON`）。⚠️ `role` / `description` / `styleId` **没有** `min(1)` —— 原件也没有。 */
const COMMON_SHAPE = {
  id: z.string().min(1),
  role: z.string(),
  description: z.string(),
  styleId: z.string(),
  anchor: AnchorShape,
  size: SizeShape,
  required: z.boolean().default(true),
  characterId: z.string().min(1).optional(),
  masterAsset: z.string().min(1).optional(),
  dependsOn: z.array(z.string().min(1)).optional()
};

const SpriteSpecShape = z.strictObject({ kind: z.literal("sprite"), ...COMMON_SHAPE });
const AnimatedSpecShape = z.strictObject({
  kind: z.literal("animation"),
  ...COMMON_SHAPE,
  animations: z.array(AnimationSpecShape).min(1)
});
const BackgroundSpecShape = z.strictObject({
  kind: z.literal("background"),
  ...COMMON_SHAPE,
  layers: z.array(LayerSpecShape).optional()
});
const UiSpecShape = z.strictObject({
  kind: z.literal("ui"),
  ...COMMON_SHAPE,
  ninePatch: z
    .strictObject({
      left: z.number().int().nonnegative(),
      right: z.number().int().nonnegative(),
      top: z.number().int().nonnegative(),
      bottom: z.number().int().nonnegative()
    })
    .optional()
});

/** ⚠️ 判别式在 **union 这一层**（与原件同款：`.superRefine()` 会把成员变成非 `ZodObject`）。 */
export const AssetSpecShape = z.discriminatedUnion("kind", [
  SpriteSpecShape, AnimatedSpecShape, BackgroundSpecShape, UiSpecShape
]);

const SheetShape = z.strictObject({
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  offsetX: z.number().int().nonnegative().optional(),
  offsetY: z.number().int().nonnegative().optional(),
  spacingX: z.number().int().nonnegative().optional(),
  spacingY: z.number().int().nonnegative().optional(),
  names: z.array(z.string().min(1)).min(1),
  animations: z
    .array(z.strictObject({ name: z.string().min(1), frames: z.array(z.string().min(1)).min(1) }))
    .optional()
});

export const AssetSourceShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("drawlist") }),
  z.strictObject({
    kind: z.literal("image"),
    prompt: z.string().min(1).optional(),
    reference: InputPathShape.optional(),
    background: z.strictObject({ tolerance: z.number().nonnegative() }).optional(),
    alphaThreshold: z.number().min(0).max(1).nullable().optional()
  }),
  z.strictObject({
    kind: z.literal("import"),
    ref: InputPathShape,
    sheet: SheetShape.optional(),
    background: z.strictObject({ tolerance: z.number().nonnegative() }).optional(),
    alphaThreshold: z.number().min(0).max(1).nullable().optional()
  })
]);

export const RecipeEntryShape = z.strictObject({ spec: AssetSpecShape, source: AssetSourceShape });

export const AuthoringAssetShape = z.strictObject({
  id: z.string().min(1),
  role: z.string(),
  description: z.string(),
  source: AssetSourceShape,
  characterId: z.string().min(1),
  size: SizeShape
});

/** 线形状的 `asset-recipe/v1`。**不是**契约 —— 契约是 `recipe.ts` 那份（见文件头）。 */
export const RecipeToolSchema = z.strictObject({
  format: z.literal("asset-recipe/v1"),
  id: z.string().min(1),
  styleRef: InputPathShape,
  referenceImage: InputPathShape.optional(),
  characterRef: InputPathShape.optional(),
  assets: z.array(RecipeEntryShape).min(1),
  authoring: z.array(AuthoringAssetShape).optional()
});
