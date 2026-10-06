// 票 31 的落点：**这份设计 + 这个世界 → `CharacterDNA`**。理解层的**第五发**调用。
//
// 决定住 `../../../.scratch/game-maker-v2/issues/31-character-dna-gen.md`。
//
// ⚠️ **本包的 I/O 是自己写的**（同 `analyze-intent` / `compile-design`：`check-deps.mjs` 只许本包依赖
//   `contracts`，共享的 I/O 没有地方放）。
//
// ⚠️ **输入是两样，不是三样**：`GameDesignSpec`（个体：那几条实体的行为）+ `VisualWorldSpec`（类：
//   这个世界角色共有的画法）。⚠️ **没有 `GameIntentSpec`** —— 票 04 的 Q4 就是那么裁的，
//   而这一发也确实用不上它：意图说的是「用户要什么」，到这一步早已被设计层吸收
//   （票 10 的 R12 已经把「做丢了」拒过一遍了）。
//
// ⚠️ **它产的是**一族**记录**（`character-dna.json` 单文件装全部角色，票 04 Q3）——
//   所以这一发**一次调用产 N 条**（票 31 的 Q2 选了 (β)）。三条理由：
//   ① 契约上就是单文件；② 「每个角色实体**恰好**一条」这条构造性 gate 在**一次调用里天然成立**
//   （分开调要自己记账）；③ N 很小（一个玩家 + 几个敌人/NPC），输出远在 `max_tokens` 之内。
//   ⚠️ 账的**一格仍然 = 一次调用**（`CONTEXT.md` 的词条），N 条记录不改这件事。
import {
  CharacterDNAFileSchema, GameDesignSpecSchema, STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS, VisualWorldSpecSchema,
  forcedTool, parseToolUse,
  type CallFailure, type CharacterDNAFile, type GameDesignSpec, type LedgerCall, type LedgerStep,
  type LedgerUsage, type VisualWorldSpec
} from "@game-maker/contracts";
import { buildCharacterDna } from "./build-character-dna.js";
import { CHARACTER_DNA_TOOL_DESCRIPTION, CHARACTER_DNA_TOOL_NAME, characterDnaPrompt } from "./prompts.js";

/** 请求的模型名。⚠️ 与前四发同源（票 24 的实况：代理**请求一个、回另一个**）。 */
const REQUESTED_MODEL = "deepseek-v4-pro";

/** 输出上限。⚠️ 一族一次，比 `compile-design` 小得多（每个角色 100~200 token 量级）——
 *  但**上限不是分配**，留够余量比省这一个数划算（票 27 实测过截断的代价：那一发烧掉 1135 token）。 */
const MAX_TOKENS = 16_000;

/** 账里的 `target` = **产物名**（与 `"game-intent"` / `"game-design"` / `"recipe"` 同款）。 */
const LEDGER_TARGET = "character-dna";

export type CompileCharacterDnaInput = {
  /** 已解析的设计（`compile-design` 的产物，或从 `run/v<N>/game-design.json` 读回来的）。 */
  design: GameDesignSpec;
  /** 已解析的这个世界（`analyze-reference` 的产物）。 */
  vws: VisualWorldSpec;
  transport: { baseUrl: string; apiKey: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type CompileCharacterDnaResult = {
  /** 过完契约（含空值 gate）与两条检查的成品。**落盘归票 15**（本步只返回值）。 */
  file: CharacterDNAFile;
  /** **一次调用 = 一格**。⚠️ 没上路就缺席。 */
  ledger?: LedgerCall[];
};

/** 「模型没干好」那一档 ⇒ CLI 映射成 `EXIT.invalid`(4)。
 *  ⚠️ **本步只有这一档错**：DNA 那一侧没有 R12 那种「拒绝」（拒绝面在票 10 与票 15）。 */
export class CompileCharacterDnaError extends Error {
  constructor(readonly failure: CallFailure, message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "CompileCharacterDnaError";
  }
}

// ── 账（与 `compile-design.ts` 的 `spentCall` 同形 —— 见文件头「I/O 各包自理」）─────────
type Spent = { usage?: LedgerUsage; model?: string; requestedModel?: string; upstream?: string };

function spentCall(step: LedgerStep, target: string) {
  const t0 = Date.now();
  const failures: CallFailure[] = [];
  let trips = 0;
  let spent: Spent = {};
  return {
    trip(o: { failure?: CallFailure; spent?: Spent } = {}) {
      trips += 1;
      if (o.failure !== undefined) failures.push(o.failure);
      if (o.spent !== undefined) spent = { ...spent, ...o.spent };
    },
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
  | { kind: "ok"; file: CharacterDNAFile; spent: Spent }
  | { kind: "bad"; failure: CallFailure; detail: string; spent: Spent }
  | { kind: "upstream"; failure: Extract<CallFailure, "http" | "timeout">; detail: string };

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
    ...(Object.keys(usage).length > 0 ? { usage } : {}),
  };
}

// ── 出发前的两处「免费」拦停（都在**第一个请求上路之前** ⇒ 不记账）────────────────
// ⚠️ 值钱的地方是同一条：**别让调用方的错去烧三次重采样**。

function assertConfigured(t: { baseUrl: string; apiKey: string }): void {
  if (t.baseUrl === "" || t.apiKey === "")
    throw new Error(
      "文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 一份 `character-dna.json` 也可以由人直接写。");
}

/** ⚠️ 重过一次**上游契约**：调用方递来的可能是**从磁盘读回来的** `game-design.json` /
 *  `visual-world.json`，而两份契约都带着自己的 gate（「同时管从磁盘上读回来的」那句自白）——
 *  手改过的文件在这里就该响，而不是等模型白吐一遍再判。 */
function assertUpstream(design: GameDesignSpec, vws: VisualWorldSpec): { design: GameDesignSpec; vws: VisualWorldSpec } {
  const d = GameDesignSpecSchema.safeParse(design);
  if (!d.success)
    throw new Error("调用方给的 `GameDesignSpec` 不过它自己的契约 —— ⚠️ 这是（或是一份手改过的）" +
      `上游产物，不是模型这一次吐的：${d.error.issues.slice(0, 4).map((x) => `${x.path.join(".")}: ${x.message}`).join("；")}`);
  const v = VisualWorldSpecSchema.safeParse(vws);
  if (!v.success)
    throw new Error("调用方给的 `VisualWorldSpec` 不过它自己的契约 —— 同上：" +
      v.error.issues.slice(0, 4).map((x) => `${x.path.join(".")}: ${x.message}`).join("；"));
  return { design: d.data, vws: v.data };
}

/** 一次往返。**只做一次** —— 重采样在调用方那层（R16 的固定次数）。 */
async function onceThrough(o: {
  baseUrl: string; apiKey: string; body: string; timeoutMs: number; doFetch: typeof fetch;
  design: GameDesignSpec; vws: VisualWorldSpec;
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
  // ⚠️ **唯一算数的判据**：入参过 Zod。`stop_reason === "tool_use"` **不是**成功信号。
  const parsed = parseToolUse(body, CHARACTER_DNA_TOOL_NAME, CharacterDNAFileSchema);
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };

  // 重过契约（gate 在这里响）→ 跑两条检查（集合 gate + 守门人）。
  const built = buildCharacterDna({ fromModel: parsed.value, design: o.design, vws: o.vws });
  if (built.ok) return { kind: "ok", file: built.file, spent };
  return { kind: "bad", failure: "schema", detail: built.detail, spent };
}

/**
 * 把这份设计 + 这个世界做成一份角色基因。
 *
 * ⚠️ **传输层的失败不重采样**（`http` / `timeout`）—— 与前后几发一致。
 * ⚠️ **只有「入参不过 Zod / 装配后不过契约或两条检查」这一档才重采样**（R16）。
 */
export async function compileCharacterDna(input: CompileCharacterDnaInput): Promise<CompileCharacterDnaResult> {
  assertConfigured(input.transport);
  const { design, vws } = assertUpstream(input.design, input.vws);

  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const body = JSON.stringify({
    model: REQUESTED_MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
    ...forcedTool(CHARACTER_DNA_TOOL_NAME, CHARACTER_DNA_TOOL_DESCRIPTION, CharacterDNAFileSchema),
    messages: [{ role: "user", content: [{ type: "text", text: characterDnaPrompt({ design, vws }) }] }],
  });

  const call = spentCall("character-dna", LEDGER_TARGET);
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      baseUrl: input.transport.baseUrl, apiKey: input.transport.apiKey, body, timeoutMs, doFetch, design, vws,
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      const ledger = call.record();
      throw new CompileCharacterDnaError(once.failure, once.detail, ledger ? [ledger] : undefined);
    }
    if (once.kind === "ok") {
      call.trip({ spent: once.spent });
      const ledger = call.record();
      return { file: once.file, ...(ledger ? { ledger: [ledger] } : {}) };
    }
    call.trip({ failure: once.failure, spent: once.spent });
    lastFailure = once.failure;
    lastDetail = once.detail;
  }

  const ledger = call.record();
  throw new CompileCharacterDnaError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 CharacterDNA（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  );
}
