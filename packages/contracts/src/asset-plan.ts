// `asset-plan/v1` —— **规划记录**（plan sidecar）的独立契约（v3 票 09）。
//
// ⚠️ **它不是 Recipe Schema 的一部分**（第一轮 Q5 = (a)）：规划理由与可执行清单分离，
//   Recipe 仍只有 `spec + source`；本文件只描述 sidecar。
// ⚠️ **route 的最终裁决在 assets 的 `resolveRoute`**；本契约只负责结构与合法性，
//   不把规划算法的内部实现暴露给 contracts（第三轮 / 第五轮边界）。
import { z } from "zod";
import { formatIssues } from "./drawlist.js";

export const ASSET_PLAN_FORMAT = "asset-plan/v1" as const;

/** 与 `AssetSource["kind"]` 同一组值。⚠️ 新增 source.kind 时这里必须跟着改（测试会盯）。 */
export const ASSET_PLAN_ROUTES = ["image", "drawlist", "import"] as const;
export type AssetPlanRoute = (typeof ASSET_PLAN_ROUTES)[number];

/** reason code 的**闭合枚举**（第三轮 Q10.5；不得用自由文本替代）。 */
export const ASSET_PLAN_REASON_CODES = [
  "import:explicit-ref",
  "image:character",
  "image:master",
  "image:animation",
  "image:background",
  "drawlist:ui-ninepatch",
  "image:candidate",
  "drawlist:candidate",
] as const;
export type AssetPlanReasonCode = (typeof ASSET_PLAN_REASON_CODES)[number];

/** 能力快照：三个 route 的可用性 + design 的 runtimeProfile（只记录，不参与规则）。 */
export const AssetPlanCapabilities = z.object({
  routes: z.object({
    image: z.boolean(),
    drawlist: z.boolean(),
    import: z.boolean(),
  }).strict(),
  runtime: z.object({
    profile: z.string().min(1),
    version: z.string().min(1),
    capabilities: z.array(z.string()),
  }).strict(),
}).strict();
export type AssetPlanCapabilities = z.infer<typeof AssetPlanCapabilities>;

/** 每项资源的决策记录。⚠️ 缺省字段**省略**，不写 `null`（第三轮 Q11.1/2）。 */
export const AssetPlanEntry = z.object({
  id: z.string().min(1),
  route: z.enum(ASSET_PLAN_ROUTES),
  reason: z.object({
    code: z.enum(ASSET_PLAN_REASON_CODES),
    text: z.string().min(1).optional(),
  }).strict(),
  inputs: z.object({
    importRef: z.string().min(1).optional(),
    masterAsset: z.string().min(1).optional(),
  }).strict(),
  candidate: z.enum(ASSET_PLAN_ROUTES).optional(),
  participated: z.boolean(),
}).strict();
export type AssetPlanEntry = z.infer<typeof AssetPlanEntry>;

/** 规划级输入（recipe 级；不逐项复制）。 */
export const AssetPlanInputs = z.object({
  styleRef: z.string().min(1),
  referenceImage: z.string().min(1).optional(),
}).strict();

export const AssetPlan = z.object({
  format: z.literal(ASSET_PLAN_FORMAT),
  recipeId: z.string().min(1),
  recipeVersion: z.number().int().positive(),
  plannerVersion: z.string().min(1),
  capabilities: AssetPlanCapabilities,
  inputs: AssetPlanInputs,
  assets: z.array(AssetPlanEntry).min(1),
}).strict();
export type AssetPlan = z.infer<typeof AssetPlan>;

/** 与 `parseRecipe` 同形：结构合法才算数。 */
export function parseAssetPlan(input: unknown): { ok: true; value: AssetPlan } | { ok: false; errors: string[] } {
  const r = AssetPlan.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: formatIssues(r.error) };
}
