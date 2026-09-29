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

export const LEDGER_FORMAT = "assetpack-ledger/v1" as const;

/** 一次运行里有哪几类调用。**封闭判别联合** —— 加一类就是加一个枚举值。 */
export const LedgerStep = z.enum(["derive", "drawlist", "image"]);

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

/** 一次调用的账。 */
export const LedgerCall = z.object({
  step: LedgerStep,
  /** 这一步作用在谁身上：资源 id（生图还会带上 `<id>.<动画|层名>`），或 `recipe` / `game-config`。 */
  target: z.string().min(1),
  /**
   * 上游**实际**服务的模型名。
   * ⚠️ **拿不到就缺席，不许编一个** —— `dashscope-mcp` 协议根本没有 `model` 参数
   * （票 34：模型由服务端定），而代理解析出来的模型名也可能与请求的那个不同（票 01 实测过）。
   */
  model: z.string().min(1).optional(),
  /** 走的是哪条路：文本是 `messages` / `chat-completions`，生图是协议名。 */
  upstream: z.string().min(1).optional(),
  /** 生图请求的尺寸（上游要的就是 `宽*高` 这种字符串）。 */
  requestedSize: z.string().min(1).optional(),
  /** 上游回的 request_id —— 出问题时拿它去对账。 */
  requestId: z.string().min(1).optional(),
  /** 上游给图的那个临时 URL 的**主机名**（只记主机，不记带签名的完整 URL）。 */
  sourceHost: z.string().min(1).optional(),
  /** 这一次调用花了多久（毫秒）。⚠️ **与 `run.wallClockMs` 不可相加**（见下）。 */
  ms: z.number().int().nonnegative(),
  /**
   * 这一次**调用**里往返了几次 HTTP。
   * ⚠️ 有界重试吸收的是**抖动**，不是降级（票 14 §7）——
   * 重试烧掉的额度要能单独看见，否则失败的归因是错的。
   */
  attempts: z.number().int().positive(),
  usage: LedgerUsage.optional(),
}).strict();

const CallCount = z.object({
  calls: z.number().int().nonnegative(),
  /** 往返总数。⚠️ `> calls` 就是「重试过」的证据。 */
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
    byStep: z.object({ derive: CallCount, drawlist: CallCount, image: CallCount }).strict(),
  }).strict(),
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
  const empty = () => ({ calls: 0, attempts: 0 });
  const out = { derive: empty(), drawlist: empty(), image: empty() };
  for (const c of calls) { out[c.step].calls += 1; out[c.step].attempts += c.attempts; }
  return out;
}
