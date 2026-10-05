// 票 09 的落点：**需求文本 → `GameIntentSpec`**。理解层的第二发调用（第一发是 `vision` 的 `analyze-reference`）。
//
// 决定住 `../../../.scratch/game-maker-v2/issues/09-intent-analyzer.md`。
//
// ⚠️ **本包的 I/O 是自己写的**，没有复用 `packages/assets` 的 `callText` / `onceThrough` / `spentCall`
//   —— 那三个都住在 `assets`，而 `check-deps.mjs` 只许 `game-design` 依赖 `contracts`（R11）。
//   这是**结构性**的，不是省事（同 `vision/analyze-reference.ts` 的文件头）。
//   所以下面有一份同形的 `spentCall`，而**形状**那一半（`forcedTool` / `parseToolUse` / 失败闭集）
//   确实是从 `contracts` 取来的。
//
// ⚠️ **与 `vision` 那一步的两个区别**（票 09 第 1 轮 Q6）：
//   ① **没有装配步** —— `vision` 要 `build-visual-world.ts`，因为它得把「调用方才知道」的两样
//      （`styleReferences` 的路径、`style.id`）注回去，再**装配后重校验**才能让越界 gate 响。
//      本契约**没有一个这样的字段** ⇒ 过完 Zod 的产物**就是**成品，没有第二个文件。
//   ② **`.omit()` 一个键都没用** ⇒ 顶层那条结构性空值 gate 一直跟着模型面向的 schema 走。
//      但模型**仍然看不见它**（`toJSONSchema` 静默丢 `superRefine`）⇒ 规矩写在 `TOOL_DESCRIPTION` 里。
//
// ⚠️ **不写任何文件**（票 08 的裁决 15 同款）：本函数**只返回值**。
//   `run/v<N>/game-intent.json` 由 pipeline（票 15）落盘；`run/v<N>/intent.md` 存的是
//   **调用方手里那段原文的字节**，而本函数连原文都不回传 —— 它就在调用方手上。
import {
  STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS, GameIntentSpecSchema, forcedTool, parseToolUse,
  type CallFailure, type GameIntentSpec, type LedgerCall, type LedgerStep, type LedgerUsage,
} from "@game-maker/contracts";
import { TOOL_DESCRIPTION, TOOL_NAME, intentPrompt } from "./prompts.js";

/** 请求的模型名。⚠️ 与 `assets` / `vision` 同源（票 24 的实况：代理**请求一个、回另一个**）。 */
const REQUESTED_MODEL = "deepseek-v4-pro";

/** 输出上限。⚠️ 与票 08 同档（16_000）：本产物比 VWS 小得多（票 09 探针实测 991–1159 token），
 *  而这是**上限不是分配**，给足不花钱；**截断**则会把一次本来会成功的调用变成 `truncated` 重采样。 */
const MAX_TOKENS = 16_000;

/** 账里的 `target` = **产物名**，不是 id。
 *  ⚠️ 与 `vision` 的 `target: styleId` **故意不同**：那一步的产物挂在**某一张参考图**上（R18 之后会有多张），
 *  而这一步每次运行**只有一份**意图 —— 所以照 `derive` 的 `"recipe"`、`compile-game` 的 `"game-config"`
 *  那条惯例写**产物名**（票 09 第 1 轮 Q6）。 */
const LEDGER_TARGET = "game-intent";

export type AnalyzeIntentInput = {
  /** 原始需求文本。⚠️ **必填**（票 09 第 1 轮 Q4）：调用的那一层负责「收文本还是收文件」的判别，
   *  这里只吃**已经拿到手的那串文本**。落盘由票 15 逐字节复制 `run/v<N>/intent.md`，
   *  ⚠️ **别在这里 trim 它的落盘形态** —— 提示词那边的 `trim()` 是另一件事（见 `prompts.ts`）。 */
  requirementText: string;
  transport: { baseUrl: string; apiKey: string };
  /** 测试可注入（`review.ts` 同款用法）。 */
  fetchImpl?: typeof fetch;
  /** 一次上游调用的超时。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

export type AnalyzeIntentResult = {
  /** 过完契约（**含顶层那条结构性空值 gate**）的成品。 */
  spec: GameIntentSpec;
  /** **一次调用 = 一格**（`attempts` 累加、`failures[]` 留原因）。⚠️ 没上路就**缺席**（不填占位值）。 */
  ledger?: LedgerCall[];
};

/**
 * 这一步失败**带着病因**。⚠️ **三发全败也要把账带出来**（票 27 的 Q4(ii)）——
 * 只记「最后失败的那次」时，`empty-input` 那种「没被看见就过去了」的病因**一次都不会出现**。
 * ⚠️ **退出码映射**（票 09 第 1 轮 Q6 写死在这张票里，由 CLI 实现）：
 *   `schema` / `no-tool-use` / `empty-input` / `truncated` ⇒ `EXIT.invalid`（4）；
 *   `http` / `timeout` ⇒ `EXIT.upstream`（3）。
 */
export class AnalyzeIntentError extends Error {
  constructor(readonly failure: CallFailure, message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "AnalyzeIntentError";
  }
}

// ── 账（与 `assets/ops.ts` 的 `spentCall` 同形 —— 见文件头「I/O 各包自理」）─────────
type Spent = { usage?: LedgerUsage; model?: string; requestedModel?: string; upstream?: string };

function spentCall(step: LedgerStep, target: string) {
  const t0 = Date.now();
  const failures: CallFailure[] = [];
  let trips = 0;
  let spent: Spent = {};
  return {
    trip(o: { failure?: CallFailure; spent?: Spent } = {}) {
      trips += 1;
      // ⚠️ **传输层的失败也进 `failures[]`**（票 09 第 1 轮 Q3，照 `analyze-reference.ts` 的**代码**）：
      //   `failures` 的定义是「**每一次没成的往返**的原因」，而一次 HTTP 500 就是一次没成的往返 ——
      //   丢掉它，账上会写着 `attempts: 1` 却**不说为什么**（那正是票 28 修过的 `compile-game` 那个病）。
      if (o.failure !== undefined) failures.push(o.failure);
      // ⚠️ 只有**成功**那一趟带 `spent`，而一趟调用里至多成功一次 ⇒ 失败的那些**盖不掉**它。
      if (o.spent !== undefined) spent = { ...spent, ...o.spent };
    },
    /** ⚠️ **一次都没发出去就返回 `null`** —— 账不记没上路的往返。 */
    record(): LedgerCall | null {
      if (trips === 0) return null;
      return {
        step, target, upstream: "messages", ms: Date.now() - t0, attempts: trips,
        ...(failures.length === 0 ? {} : { failures }), ...spent,
      };
    },
  };
}

type Trip =
  | { kind: "ok"; value: GameIntentSpec; spent: Spent }
  | { kind: "bad"; failure: CallFailure; detail: string; spent: Spent }
  | { kind: "upstream"; failure: Extract<CallFailure, "http" | "timeout">; detail: string };

/** 上游自己报的那两样 —— **拿不到就缺席，不许编一个**。 */
function spentOf(body: unknown): Spent {
  const j = body as {
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  } | null;
  const u = j?.usage;
  const usage: LedgerUsage = {
    ...(u?.input_tokens !== undefined ? { inputTokens: u.input_tokens } : {}),
    ...(u?.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
    ...(u?.completion_tokens_details?.reasoning_tokens !== undefined
      ? { reasoningTokens: u.completion_tokens_details.reasoning_tokens } : {}),
  };
  return {
    requestedModel: REQUESTED_MODEL,
    ...(j?.model ? { model: j.model } : {}),
    // ⚠️ 上游没给就**整个键缺席** —— 不许填 0 冒充「测到了 0」。
    ...(Object.keys(usage).length > 0 ? { usage } : {}),
  };
}

// ── 出发前的两处「免费」拦停 ─────────────────────────────────────────────────
// ⚠️ 都在**第一个请求上路之前**，所以它们**不记进账**（账只记真的发出去过的往返）。
//   而它们值钱的地方是同一条：**别让调用方的错去烧三次重采样**。

function assertConfigured(t: { baseUrl: string; apiKey: string }): void {
  if (t.baseUrl === "" || t.apiKey === "")
    throw new Error(
      "文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 一份 `game-intent.json` 也可以由人直接写。");
}

function assertRequirement(text: string): string {
  const t = text.trim();
  if (t === "")
    throw new Error("requirementText 是空的 —— 这一步**没有别的输入**：它要读的就是这段需求。" +
      "⚠️ 而「空」在这里连 `ambiguity[]` 都救不了 —— 一个字的输入读不出 16 个字段。");
  return t;
}

/** 一次往返。**只做一次** —— 重采样在调用方那层（R16 的固定次数）。 */
async function onceThrough(o: {
  baseUrl: string; apiKey: string; body: string; timeoutMs: number; doFetch: typeof fetch;
}): Promise<Trip> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  let res: Response;
  try {
    res = await o.doFetch(`${o.baseUrl}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": o.apiKey, "anthropic-version": "2023-06-01" },
      body: o.body,
    });
  } catch (e) {
    // ⚠️ 中止与「连不上」是**两件事**，而 fetch 都抛 AbortError/TypeError —— 分开报，否则人查错方向。
    if (ctl.signal.aborted)
      return { kind: "upstream", failure: "timeout", detail: `上游 ${Math.round(o.timeoutMs / 1000)} 秒没回应，已中止（超时）` };
    return { kind: "upstream", failure: "http", detail: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(timer); }

  if (!res.ok)
    return { kind: "upstream", failure: "http", detail: `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}` };

  let body: unknown;
  try { body = await res.json(); }
  catch (e) { return { kind: "upstream", failure: "http", detail: `上游回的不是 JSON：${(e as Error).message}` }; }

  const spent = spentOf(body);
  // ⚠️ **唯一算数的判据**：入参过 Zod（**含顶层那条 gate**）。`stop_reason === "tool_use"` **不是**成功信号
  //   —— 票 27 第 1 发与票 09 的探针各实测过一次：工具被调、`input = {}`、上千 token 打水漂。
  const parsed = parseToolUse(body, TOOL_NAME, GameIntentSpecSchema);
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };
  return { kind: "ok", value: parsed.value, spent };
}

/**
 * 把一段需求文本读成 `GameIntentSpec`。
 *
 * ⚠️ **传输层的失败不重采样**（`http` / `timeout`）—— 与 `vision` / `assets` 两条链一致：
 *   R16 的重采样是给**入参不过 Zod** 那种失败用的，不是给「上游挂了」用的。
 *   把两者混在一个分母里，正是票 27 的 Q4(ii) 立 `CALL_FAILURES` 要治的病。
 *
 * ⚠️ **重采样是重抽同一个分布** —— 对「输入本身触发的系统性失败」它救不了
 *   （票 09 探针：一句话输入两发全灭于 `empty-input`，而那是**代理把入参丢了**）。
 *   账上会诚实写出 `attempts: 3, failures: [empty-input ×3]`，但用户只看到失败 ⇒
 *   那一类失败的对策在**提示词骨架**（`prompts.ts`），不在这里。
 */
export async function analyzeIntent(input: AnalyzeIntentInput): Promise<AnalyzeIntentResult> {
  assertConfigured(input.transport);
  const requirementText = assertRequirement(input.requirementText);

  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const body = JSON.stringify({
    model: REQUESTED_MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
    ...forcedTool(TOOL_NAME, TOOL_DESCRIPTION, GameIntentSpecSchema),
    messages: [{ role: "user", content: [{ type: "text", text: intentPrompt({ requirementText }) }] }],
  });

  const call = spentCall("analyze-intent", LEDGER_TARGET);
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      baseUrl: input.transport.baseUrl, apiKey: input.transport.apiKey, body, timeoutMs, doFetch,
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      const ledger = call.record();
      throw new AnalyzeIntentError(once.failure, once.detail, ledger ? [ledger] : undefined);
    }
    if (once.kind === "ok") {
      call.trip({ spent: once.spent });
      const ledger = call.record();
      return { spec: once.value, ...(ledger ? { ledger: [ledger] } : {}) };
    }
    call.trip({ failure: once.failure, spent: once.spent });
    lastFailure = once.failure;
    lastDetail = once.detail;
  }

  const ledger = call.record();
  throw new AnalyzeIntentError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 GameIntentSpec（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  );
}
