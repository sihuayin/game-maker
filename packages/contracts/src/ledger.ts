// `assetpack-ledger/v1` —— 一个资源包**花了什么**的事实记录（票 19 定形状，票 45 落地）。
//
// ⚠️ **它跟着包走，但不在 manifest 里**：manifest 是包的**自描述**（引擎要读它才能用），
//   ledger 是包的**收据**（做这东西花了什么）—— 引擎**不需要**知道。
//   所以它是包根的 **sidecar `ledger.json`**，而**不是** manifest 的一个字段：
//   往 `provenance` 里加键会迫使 `assetpack/v2` 升版，而升版会让磁盘上所有 v2 包解析不过。
//   ⚠️ 而且 `pack.ts` 的 `files[]` 是 `walk(packDir)` **穷举** ——
//   sidecar 放包根会**自动进 `files[]`**、自动被 `verify` 校验 checksum。**契约零改动，等于白拿。**
//
// ⚠️ **只记事实，不折算成钱**（票 19 Q7）：代理不转发定价、各家上游计价单位还不同
//   （token vs 按张），而 **token 与张数是充分统计量** —— 钱是它们的纯函数，随时能算。
//
// ⚠️ **它是「观察」那一侧的东西**（票 39 立的界）：不阻断、不打分，只是把花了什么记下来。
import { z } from "zod";
import { CallFailure } from "./structured-call.js";

export const LEDGER_FORMAT = "assetpack-ledger/v1" as const;

/** 一次运行里有哪几类调用。**封闭判别联合** —— 加一类就是加一个枚举值。 */
export const LedgerStep = z.enum([
  "derive",
  "drawlist",
  "image",
  // ⚠️ 与 `derive` 同一条规矩：**它是一次上游调用，就得记**（票 06 的 Q4）。
  "compile-td-game",
  // ⚠️ **2026-10-01 补上**（票 28）：`compile-game` 一直**不在这个枚举里** ——
  //   而这就是它「不交账」的**真正原因**，不是谁忘了写一行。一次上游调用没地方记，
  //   于是横版那条链上**唯一**会调上游的 `compile-*` 在账上是隐形的。
  //   加值的代价是零：`byStep` 是 `z.record`（缺键不算错），磁盘上已有的账照常通过。
  "compile-game",
]);

/**
 * 上游自报的用量。⚠️ **上游没给就整个键缺席 —— 不许填 0 冒充「测到了 0」**
 * （票 19：那等于把一个不知道的事说成知道的）。
 */
export const LedgerUsage = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).strict();

/**
 * 一次**调用**的账。
 * ⚠️ **一格 = 一次调用，不是一次往返** —— `attempts` 才是往返（`CONTEXT.md`「调用 / 往返」）。
 *   重采样时**不新开一格**，而是在同一格里累加 `attempts`、把每次没成的原因追加进 `failures`。
 */
export const LedgerCall = z.object({
  step: LedgerStep,
  /** 这一步作用在谁身上：资源 id（生图还会带上 `<id>.<动画|层名>`），或 `recipe` / `game-config` / `td-config`。 */
  target: z.string().min(1),
  /**
   * 上游**自报**的模型名。
   * ⚠️ **拿不到就缺席，不许编一个** —— `dashscope-mcp` 协议根本没有 `model` 参数
   * （票 34：模型由服务端定）；而**上游没应答时更无从谈起**（失败的那一笔）。
   * ⚠️ 它与 `requestedModel` **是两个事实**，别混：票 01 实测过代理**请求一个、回另一个**
   *      （请求 `deepseek-v4-pro`，响应里写的是 `deepseek-flash`）。
   */
  model: z.string().min(1).optional(),
  /** 我们**请求**的那个模型名。与 `model` 并列，**不互相顶替**。 */
  requestedModel: z.string().min(1).optional(),
  /** 走的是哪条路：文本是 `messages` / `chat-completions`，生图是协议名。 */
  upstream: z.string().min(1).optional(),
  /** 生图请求的尺寸（上游要的就是 `宽*高` 这种字符串）。 */
  requestedSize: z.string().min(1).optional(),
  /** 上游回的 request_id —— 出问题时拿它去对账。 */
  requestId: z.string().min(1).optional(),
  /** 上游给图的那个临时 URL 的**主机名**（只记主机，不记带签名的完整 URL）。 */
  sourceHost: z.string().min(1).optional(),
  /**
   * 这一次调用花了多久（毫秒）。⚠️ **与 `run.wallClockMs` 不可相加**（见下）。
   *
   * ⚠️ **可选：缺席 = 这笔「发出去了、还没回来」**（2026-09-30 · 票 05）。
   *   失败那一刻账上要记**真实发出去了几笔**，而不是「回来了几笔」——
   *   真跑里 GPT 那一次一笔都没回来，于是账上空的、CLI 连那一行都不印，而钱确实花了。
   *   ⚠️ **不许写 0 冒充「测到了 0」**（票 19 Q4）—— 拿不到就是拿不到。
   */
  ms: z.number().int().nonnegative().optional(),
  /**
   * 这一次**调用**里往返了几次 HTTP。
   * ⚠️ 有界重试吸收的是**抖动**，不是降级（票 14 §7）——
   * 重试烧掉的额度要能单独看见，否则失败的归因是错的。
   */
  attempts: z.number().int().positive(),
  /**
   * **这场调用里，没能用上的那些往返各自的原因**，按发生顺序。⚠️ **闭集**，见 `CallFailure`。
   *
   * ⚠️ **一个数组，不是一格** —— 因为账的一格是**一次调用**（`CONTEXT.md` 的「调用 / 往返」：
   *   `attempts` 记的是这一次调用里往返了几次）。一格只留得下**最后一次**病因时，
   *   「发了 3 次、前两次被截断、第三次坏 schema」与「一次就坏 schema」在账上**一模一样**。
   *   ⚠️ 最典型的一档恰恰是**没被看见就过去了**的那种：上游把入参丢了（`empty-input`）、
   *   重采样救回来了 —— 只记「最后失败的那次」时它**一次都不会出现**。
   *
   * ⚠️ **缺席 == 一次都没失败**（首发就成），与 `usage` 一条心：不许拿占位值冒充「测到了」。
   */
  failures: z.array(CallFailure).min(1).optional(),
  usage: LedgerUsage.optional(),
}).strict();

const CallCount = z.object({
  calls: z.number().int().nonnegative(),
  /** 往返总数。⚠️ `> calls` 就是「重试过」的证据（`CONTEXT.md`「调用 / 往返」那条纪律的落点）。 */
  attempts: z.number().int().nonnegative(),
}).strict();

export const Ledger = z.object({
  format: z.literal(LEDGER_FORMAT),
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  run: z.object({
    /**
     * ⚠️ **人等了多久** —— 与 `calls[].ms` 之**和**是两个不相加的量。
     * 串行时它们恰好相等；**一旦生成并行（票 47）就不再相等**，
     * 而**差正是并行的收益**。只记一个会让这件事变成无法回答的问题。
     */
    wallClockMs: z.number().int().nonnegative(),
    // ⚠️ **只记发生过的步**（`z.record` 不要求键齐全）——
    //   加一个 `LedgerStep` 值时，**磁盘上已有的账照常通过**（缺的键不算错），
    //   而新账也不会因为「多了一个键」被自己的 schema 拒。加值不再需要动格式版本。
    byStep: z.record(LedgerStep, CallCount),
  }).strict(),
  /**
   * ⚠️ **顺序不是契约**：它是**入账序**，而**生图那一路**的入账发生在**发出**那一刻
   *   （票 05）—— 并发下那就是「开始的先后」；**文本那一路照旧在调用回来之后**记（生成器自己
   *   就在那一步交账，而且它失败也会交一笔）。两条混在一起时，别指望任何「自然的」顺序。
   *   要按步找就**按 `step` 找**，别按下标。
   */
  calls: z.array(LedgerCall),
}).strict();

export type Ledger = z.infer<typeof Ledger>;
export type LedgerCall = z.infer<typeof LedgerCall>;
export type LedgerUsage = z.infer<typeof LedgerUsage>;
export type LedgerStep = z.infer<typeof LedgerStep>;

export function parseLedger(input: unknown): { ok: true; value: Ledger } | { ok: false; errors: string[] } {
  const r = Ledger.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`),
  };
}

/**
 * 从一次运行的调用明细里汇总出 `run.byStep`（写入侧与读取侧**共用这一处**）。
 * ⚠️ 别在别处再算一遍 —— 票 24 的 `derivePackMode` 是同一个教训。
 */
export function summarizeCalls(calls: readonly LedgerCall[]) {
  // ⚠️ **只记发生过的步** —— 与 schema 的 `partialRecord` 一条心。
  //   零调用的步不写出来，而不是写一个 `{calls: 0}`：后者会让「这个包跑过生图吗」
  //   这个问题的答案取决于**枚举里有没有那个值**，而不是取决于这一趟真发生了什么。
  const out: Partial<Record<z.infer<typeof LedgerStep>, { calls: number; attempts: number }>> = {};
  for (const c of calls) {
    const e = (out[c.step] ??= { calls: 0, attempts: 0 });
    e.calls += 1; e.attempts += c.attempts;
  }
  return out;
}
