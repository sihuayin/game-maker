// `run-design-attempts/v1` —— `compile-design` 那一圈里**每一发模型自己写下的入参**（票 55
// 「被拒的设计一个字都不落盘」）。
//
// ⚠️ **它为什么存在**：`create-game.ts` 只在 `compileDesign` 返回 `ok` 之后才写 `game-design.json`
//   ⇒ 被拒的那一刻，模型那份设计**只活在内存里，随进程消失**。票 23 的第八次真跑正是死在这里，
//   而它点名的两个验收读点（「模型把 `player.id` 改成了什么」·「第一发撞的是哪一条 schema」）
//   **一个都读不出来** ⇒ 归因从**铁证**掉到**强相关**（n=1 的对比）。
//   本容器把那一圈的原话留在**失败现场**里，于是下一次死的时候，归因是**读出来的**。
//
// ⚠️ **它不是契约产物，所以不叫 `game-design.json`**（票 55 的 Q3）：
//   · 「三发全没过 schema」那一档**没有**一份「被拒的设计」—— 只有三份**从没合格过**的原始输出；
//   · 而 R12 那一档**是**一份完全合法的 `GameDesignSpec`（`kind:"rejected"` 只在 `safeParse`
//     **成功之后**才可能返回）—— 但它那一份的正位是 `run/v<N>/game-design.json`，
//     同一份事实**不许落两处**。
//   ⇒ 一个名字装住这两档：**原始入参，不是设计**。
//
// ⚠️ **它跟着 run 走、不进任何资源包** —— 与 `ledger.json` / `coverage.json` / `master-ratios.json`
//   同一条理由：`AssetPackManifest` 是 `.strict()` 的，往里加一格会迫使 `assetpack` 升版。
//   ⇒ 给它一个 `run-*` 的 format 标签**不牵动升版**。⚠️ 与那三份**不同的是落点**：
//   它进的是**失败现场**（`.failed-<ts>/`），不是包根、也不是 `run/v<N>/`（那里是成功语义）。
//
// ⚠️ **形状住在这里、装填住在 `@game-maker/game-design`**（与账本 / 覆盖率 / 母版比例同一个分工）：
//   外壳（CLI / MCP）**只能依赖 contracts** ⇒ 它要读得到这个形状；而这一摞东西是那一圈的
//   **局部变量**，只有 `compile-design` 拿得到。
//
// ⚠️ **谁读它**（R7：说不出读者就别加）：失败现场的诊断者 —— 今天就是票 23 的下一次真跑；
//   外加 `packages/pipeline/tests/create-game.test.ts` 那一对判据
//   （阳性：读得回来 · 阴性：成功路径一个字节不变）。
//
// ⚠️ **用 v3 的 `zod`、不用 `zod/v4`**：那条 v4 的规矩只对**模型面向**的 V2 契约成立
//   （它们要被 `toolInputSchema` 喂进 `input_schema`），而这一份**不喂任何模型**。
import { z } from "zod";

export const DESIGN_ATTEMPTS_FORMAT = "run-design-attempts/v1" as const;

/** 失败现场里那份的文件名。⚠️ 它落在**运行暂存目录的根**（与 `intent.md` / `game-intent.json` 并列），
 *  靠失败时那一次 `rename` 进现场 —— 与 `master-ratios.json` 的「sidecar」同一个待遇，不同落点。 */
export const DESIGN_ATTEMPTS_FILE = "design-attempts.json" as const;

/** 一发的下场。⚠️ 前四个与 `parseToolUse` 的 `ToolUseFailure` **同名**（它们本来就是同一件事），
 *  第五个 `rejected` 是 R12 那一档 —— **它严格来说不是失败**：那一发上游调用是**成功**的，
 *  账上因此没有 `failures` 痕迹（见 `compile-design.ts` 的「拒绝 ≠ 失败」）。
 *  ⚠️ **上游失败（`http` / `timeout`）不在这里**：它发生在**取到 body 之前**，压根没有模型入参 ——
 *  形状里不给它留格子，它在**账**的 `failures[]` 里（本票一个字没动账）。 */
export const DESIGN_ATTEMPT_OUTCOMES = ["truncated", "no-tool-use", "empty-input", "schema", "rejected"] as const;
export const DesignAttemptOutcome = z.enum(DESIGN_ATTEMPT_OUTCOMES);
export type DesignAttemptOutcome = z.infer<typeof DesignAttemptOutcome>;

/** 一条拒因。⚠️ **`reason` 是开集字符串**：那套取值（`camera-unsupported` / `intent-mechanic-missing` …）
 *  的家在 `@game-maker/game-design` 的 `REJECT_REASONS`，而 `contracts` **够不着它**（R11）
 *  ⇒ 这里只保证「有一条、两格都非空」，取值的意思归那边。
 *  ⚠️ **权威那一份是 `rejections[]`，`detail` 是给人读的一行话** —— 与 `master-ratios.json` 里
 *  「`match` 是零容差判定的权威值 / `ratioDelta` 是给人读的」同一条分工。 */
const Rejection = z.object({ reason: z.string().min(1), detail: z.string().min(1) }).strict();

/** **一发**往返的交待。 */
export const DesignAttempt = z.object({
  /** 第几发（**1 起**，与账里的 `attempts` 同一套编号）。
   *  ⚠️ **可能不连号**：上游失败那一发不在这里（它没有入参，见 `DESIGN_ATTEMPT_OUTCOMES`）——
   *  缺号 = 那一发死在取到 body 之前，而账上的 `attempts` / `failures[]` 说得清是怎么回事。 */
  attempt: z.number().int().positive(),
  outcome: DesignAttemptOutcome,
  /** 人话摘要（`parseToolUse` 的 `detail`，或 R12 那一句）。 */
  detail: z.string().min(1),
  /** **模型自己写下的那份入参，原样**（解析、校验、契约转换**之前**的那几个字节）。
   *  ⚠️ **可以缺席**：没有那个 `tool_use` 块时**根本拿不到**（`no-tool-use`）。
   *  ⚠️ 而缺席**就是缺席** —— 不许写一个 `{}` 冒充「模型写了个空对象」
   *  （同 `LedgerCall.ms` 那条「**不许写 0 冒充「测到了 0」**」）。
   *  ⚠️ 反过来，`{}` 若**真是**模型写的（票 27 实测的那一发：`stop_reason=tool_use`、`input={}`、
   *  上游烧了 1135 个 token）就**原样存 `{}`** —— 那是这个容器里最值钱的一条证据。 */
  raw: z.unknown().optional(),
  /** 只有当 `outcome === "rejected"` 时在。⚠️ 与抛出去那个 `DesignRejectedError` 里**同一个数组**
   *  （复用同一份事实，不另抄一遍）。 */
  rejections: z.array(Rejection).min(1).optional(),
}).strict();

export const DesignAttempts = z.object({
  format: z.literal(DESIGN_ATTEMPTS_FORMAT),
  /** ⚠️ **按 `attempt` 升序**（写的那一侧就按往返顺序推，与 `MasterRatios.masters` 同款）。
   *  ⚠️ **至少一条**：这份文件的**写与不写**是一条判据 —— 「这一圈有没有拿到过模型入参」，
   *  一条都没拿到就**不写这个文件**（票 55 的 Q5）⇒ 一份**空容器在结构上不存在**。 */
  attempts: z.array(DesignAttempt).min(1),
}).strict();

export type DesignAttempt = z.infer<typeof DesignAttempt>;
export type DesignAttempts = z.infer<typeof DesignAttempts>;

export function parseDesignAttempts(input: unknown): { ok: true; value: DesignAttempts } | { ok: false; errors: string[] } {
  const r = DesignAttempts.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}
