// `assetpack-master-ratios/v1` —— 母版那一发**请求什么 vs 回来什么**的读数（票 39）。
//
// ⚠️ **它是「观察」那一侧的东西**（R3）：不阻断、不打分。票 39 把它从**判据**降下来，
//   理由是它量的**不是设计，是上游的手气** —— 实测同一个 `2:3` 回来过三种画布
//   （832×1248 / 1184×864 / 1344×768），同一个 `1:1` 回来过两种 ⇒ `aspectRatio` 是**提示**，
//   不是契约。⇒ 按 R3 的准入条件（「精确可算 **+ 错了一定不是设计**」）它**不合格**。
//   ⚠️ **降的只是后果，量法一个字没改**：判「一致」仍是零容差的整数交叉相乘。
//
// ⚠️ **它跟着包走，但不在 manifest 里** —— 与 `ledger.json`（票 19/45）· `coverage.json`（票 50）
//   同一条理由：`AssetPackManifest` 是 `.strict()` 的，往里加一格会迫使 `assetpack/v2 → v3`，
//   而磁盘上那两份入库的 v2 fixture 包会**一起解析不过**。放包根则靠 `files[] = walk(packDir)`
//   **自动进清单**、自动被 `verify` 校验 checksum —— 契约零改动，等于白拿。
//
// ⚠️ **形状住在这里、量法住在 `@game-maker/assets`** —— 与账本 / 覆盖率同一个分工：
//   外壳（CLI / MCP）**只能依赖 contracts**，所以它要读得到这个形状；而量它要 PNG 解码器，
//   那是 `pack` 那一步的事。
import { z } from "zod";

export const MASTER_RATIOS_FORMAT = "assetpack-master-ratios/v1" as const;

/** 包根那份汇总的文件名（与 `ledger.json` / `coverage.json` 并列）。 */
export const MASTER_RATIOS_FILE = "master-ratios.json" as const;

/** 一个像素尺寸。⚠️ 两边**共用同一个形状**（`{w,h}`）：
 *  `requested` 直接就是 `authoring[].size` 那一格，`returned` 是解码出来的 `image.width/height`。 */
const Pixels = z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict();

/** **一张**母版那一发的读数。
 *
 *  ⚠️ **每一张都记，含一致的那些**（票 39 的 Q5）—— 只记不匹配的话，人**分不清**
 *    「这次全对」与「这次压根没量」，而「差多少」这个数也只有在有基准（匹配的那些）时才读得懂。 */
export const MasterRatio = z.object({
  /** 母版 id（`authoring[].id`）。 */
  master: z.string().min(1),
  /** 我们要求画多大：`authoring[].size`（canonical 画布）。 */
  requested: Pixels,
  /** 上游**真**回来了多大。 */
  returned: Pixels,
  /** `requested.w / requested.h`。⚠️ 这两个比例是**给人读的**（3 位小数），判「一致」不看它们。 */
  requestedRatio: z.number().positive(),
  returnedRatio: z.number().positive(),
  /** `(returnedRatio - requestedRatio) / requestedRatio` —— **带符号**，正 = 回来的更宽。 */
  ratioDelta: z.number(),
  /** **零容差**判定的结果（整数交叉相乘，见 `masterRatioReading`）。`true` = 那一次它听话了。
   *  ⚠️ **它不是 `ratioDelta === 0`** —— 那是浮点比较，这个是整数判定的**权威值**。 */
  match: z.boolean(),
}).strict();

export const MasterRatios = z.object({
  format: z.literal(MASTER_RATIOS_FORMAT),
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  /** ⚠️ **按 `authoring[]` 的顺序排**，不按回来的先后 —— 并发下回来是随机的
   *  （与 `pack` 里 `built[idx]` 同一条规矩）。 */
  masters: z.array(MasterRatio),
}).strict();

export type MasterRatio = z.infer<typeof MasterRatio>;
/** 量出来的那一半（还没有 id）—— `masterRatioReading` 的返回形状。 */
export type MasterRatioReading = Omit<MasterRatio, "master">;
export type MasterRatios = z.infer<typeof MasterRatios>;

export function parseMasterRatios(input: unknown): { ok: true; value: MasterRatios } | { ok: false; errors: string[] } {
  const r = MasterRatios.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}
