// `run-visual-world-attempts/v1` —— `analyze-reference` 那一圈里**每一发模型自己写下的入参 + 它换回来什么**
// （票 60「理解层第一步失败时，模型写的东西一个字都不留」）。
//
// ⚠️ **它为什么存在**：票 23 的第十次真跑死在**第一步**（`analyze-reference`，三发全 `schema`：
//   顶层 `palette` 被写成了数组），而失败现场里**只有 `intent.md`**（那是 fixture 拷进去的**输入**）。
//   ⇒ 「模型到底把 `palette` 写成了哪一种数组」**读不出来**，于是归因只能停在「猜」。
//   票 55 的 `design-attempts.json` **只管设计层** ⇒ 这一步当时**没有对应的容器**。
//
// ⚠️ **它与票 55 那份是「同病、住另一步」，但各自一份容器**（票 60 的 Q1b 裁定）：
//   · **不做通用容器** —— `DesignAttempts` 的 `outcome` 里那个 `rejected` 是**设计层专有**的
//     （R12 那一档：上游调用**成功**、只是**结论**被否）；这一步**没有对应物**
//     ⇒ 拿它套过来会**发明一个到不了的值**（R7 的门）。
//   · **不动 `run-design-attempts/v1`** —— 它已经落地且有人读，改它要么升版、要么让一个已发布的
//     format **语义变宽**。
//
// ⚠️ **format 带 `run-` 前缀、文件名不带** —— 这是全仓 15 个 `*_FORMAT` 量出来的惯例
//   （票 60 的 Q1b 要求「以仓库既有命名规范核对」）：
//     run 级诊断 sidecar：`run-ledger/v1` · `run-design-attempts/v1` · 本份
//     真产物（无前缀）：  `visual-world/v1` · `game-design/v1` · …
//   ⚠️ `visual-world/v1` **已经被真产物占了** —— 本份若不加前缀会跟它挤在同一个命名空间里。
//
// ⚠️ **它跟着 run 走、不进任何资源包** —— 与 `ledger.json` / `design-attempts.json` 同一条理由：
//   `AssetPackManifest` 是 `.strict()` 的，往里加一格会迫使 `assetpack` 升版。
//   ⇒ 一个 `run-*` 的 format 标签**不牵动升版**。
//
// ⚠️ **落点在失败现场**（`.failed-<ts>/`），不是包根、也不是 `run/v<N>/`（那里是成功语义）。
//
// ⚠️ **形状住这里、装填住在 `@game-maker/vision`**（与账本 / 覆盖率 / 设计入参同一个分工）：
//   外壳（CLI / MCP）**只能依赖 contracts** ⇒ 它要读得到这个形状；而那一摞是 `analyze-reference`
//   的**局部变量**，只有它拿得到。
//
// ⚠️ **谁读它**（R7：说不出读者就别加）：**失败现场的诊断者** —— 今天就是票 23 的下一次真跑
//   （它那两个读点：「模型把顶层 `palette` 写成了什么形状」「三发是不是同一种坏法」）；
//   外加 `packages/pipeline/tests/create-game.test.ts` 那一对判据。
//
// ⚠️ **用 v3 的 `zod`、不用 `zod/v4`**：那条 v4 的规矩只对**模型面向**的 V2 契约成立
//   （它们要被 `toolInputSchema` 喂进 `input_schema`），而这一份**不喂任何模型**。
import { z } from "zod";
import { LedgerUsage } from "./ledger.js";
import { CallFailure } from "./structured-call.js";

export const VISUAL_WORLD_ATTEMPTS_FORMAT = "run-visual-world-attempts/v1" as const;

/** 失败现场里那份的文件名。⚠️ 它落在**运行暂存目录的根**（与 `intent.md` / `design-attempts.json` 并列），
 *  靠失败时那一次 `rename` 进现场。⚠️ 文件名**不带** `run-` 前缀 —— 与 `design-attempts.json` /
 *  `master-ratios.json` 同款（惯例是「format 带、文件名不带」）。 */
export const VISUAL_WORLD_ATTEMPTS_FILE = "visual-world-attempts.json" as const;

/**
 * 一发的下场。⚠️ **它就是从 `parseToolUse` 的 `ToolUseFailure` 里切出来的那四个值** ——
 * 不另抄一份数组，免得「同一批名字」在两张表里各自漂移。
 *  ⚠️ **上游失败（`http` / `timeout`）不在这里**：它发生在**取到 body 之前**、压根没有模型入参
 *  ⇒ 形状里不给它留格子（它在**账**的 `failures[]` 里）。
 */
export const VisualWorldAttemptOutcome = CallFailure.extract([
  "truncated",
  "no-tool-use",
  "empty-input",
  "schema",
]);
export type VisualWorldAttemptOutcome = z.infer<typeof VisualWorldAttemptOutcome>;

/**
 * **这一发换回来什么** —— 人裁 Q1c 要的那份「响应摘要」，判 H2 用的那一格。
 *
 * ⚠️ **为什么是摘要、不是整份响应体**：票 55 的 Q6(r1) 明令「**不落请求体 / 响应体 / headers**」，
 *   而人裁这一轮的原话是「保存逐次**原始响应**，区分每次实际返回的内容」——
 *   两句同时成立的读法是：**存足以区分「这一发到底交出了什么」的那几个事实，不搬整份 body**。
 *   🎯 票 59 那个最锋利的证据（三发空各自烧了 4430 / 3198 / 3512 个**输出 token**
 *   ⇒「一个 `{}` 不可能值三千多」）**正是从 `usage` 读出来的**。
 *
 * ⚠️ **故意没有「有没有 `tool_use` 块」这一格**：它**由 `outcome` 决定**（`no-tool-use` = 没有；
 *   `empty-input` / `schema` = 有），唯一含糊的是 `truncated` —— 而那一档的 `stop_reason`
 *   **按定义就是** `max_tokens`（见 `parseToolUse`）⇒ 那一格是**可派生的副本**，不进契约（R7）。
 */
export const VisualWorldResponseSummary = z.object({
  /** 上游自己写的 `stop_reason`。⚠️ **拿不到就缺席，不许编一个** ——
   *  它是「被截断」与「上游不认 tools」两种死因的分水岭（见 `parseToolUse` 的顺序纪律）。 */
  stopReason: z.string().min(1).optional(),
  /** 上游自报的用量。⚠️ **与账同一份形状、同一条规矩**：上游没给就**整个键缺席** ——
   *  不许填 0 冒充「测到了 0」（`LedgerUsage` 头一句就是这条）。 */
  usage: LedgerUsage.optional(),
}).strict();

/** **一发**往返的交待。 */
export const VisualWorldAttempt = z.object({
  /** 第几发（**1 起**，与账里的 `attempts` 同一套编号）。
   *  ⚠️ **可能不连号**：上游失败那一发不在这里（它没有入参，见 `VisualWorldAttemptOutcome`）——
   *  缺号 = 那一发死在取到 body 之前，而账上的 `attempts` / `failures[]` 说得清是怎么回事。 */
  attempt: z.number().int().positive(),
  outcome: VisualWorldAttemptOutcome,
  /** 人话摘要（`parseToolUse` 的 `detail`，原样）。 */
  detail: z.string().min(1),
  /** **模型自己写下的那份入参，原样**（解析、校验、契约转换**之前**的那几个字节）。
   *  ⚠️ **可以缺席**：没有那个 `tool_use` 块时**根本拿不到**（`no-tool-use`）。
   *  ⚠️ 而缺席**就是缺席** —— 不许写一个 `{}` 冒充「模型写了个空对象」
   *  （同 `LedgerCall.ms` 那条「**不许写 0 冒充「测到了 0」**」）。
   *  ⚠️ 反过来，`{}` 若**真是**模型写的（票 27 实测的那一发）就**原样存 `{}`** —— 那是这里最值钱的一条证据。 */
  raw: z.unknown().optional(),
  /** 「这一发换回来什么」。⚠️ **在**：四个 outcome 都发生在**取到 body 之后** ⇒ 摘要总有得写
   *  （哪怕只是「`stop_reason` 拿到了、用量没给」）。 */
  response: VisualWorldResponseSummary,
}).strict();

export const VisualWorldAttempts = z.object({
  format: z.literal(VISUAL_WORLD_ATTEMPTS_FORMAT),
  /** ⚠️ **按 `attempt` 升序**（写的那一侧就按往返顺序推，与 `DesignAttempts.attempts` 同款）。
   *  ⚠️ **至少一条**：这份文件的**写与不写**是一条判据 —— 「这一圈有没有拿到过模型入参」，
   *  一条都没拿到就**不写这个文件**（票 60 的 Q2）⇒ 一份**空容器在结构上不存在**。 */
  attempts: z.array(VisualWorldAttempt).min(1),
}).strict();

export type VisualWorldResponseSummary = z.infer<typeof VisualWorldResponseSummary>;
export type VisualWorldAttempt = z.infer<typeof VisualWorldAttempt>;
export type VisualWorldAttempts = z.infer<typeof VisualWorldAttempts>;

export function parseVisualWorldAttempts(input: unknown):
{ ok: true; value: VisualWorldAttempts } | { ok: false; errors: string[] } {
  const r = VisualWorldAttempts.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}
