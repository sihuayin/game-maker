// 票 10 的落点：**意图 + 这个世界 → `GameDesignSpec`**。理解层的**收尾那一发**。
//
// 决定住 `../../../.scratch/game-maker-v2/issues/10-design-compiler.md`。
//
// ⚠️ **本包的 I/O 是自己写的**（同 `analyze-intent.ts` / `vision`：`check-deps.mjs` 只许本包依赖
//   `contracts`，共享的 I/O 没有地方放）。
//
// ⚠️ **它比理解层前两发多一个输入：`RuntimeProfile`**（票 10 的 Q3a）。三条理由：
//   ① 它要填 `game.runtimeProfile` 的 `{id, version}` —— 那是**引用**，不许模型编；
//   ② 它要 `game.genre` / `game.camera` 的取值（票 05 Q7：「`genre` 的值就是 `id`」）；
//   ③ R12 要「**在生图之前、且免费**」地拒绝，而**本步是唯一同时看得见意图、VWS 与 profile 的那一步**
//      —— 票 14 的输入里**既没有意图也没有 VWS**，所以「用户要的东西做丢了」与「参考图的视角做不出来」
//      这两件事，除了这里**没人管得了**。
//
// ⚠️ **拒绝 ≠ 失败**（Q3c）：`buildDesign` 说 `rejected` 时，那一发上游调用是**成功**的
//   （账照记、`failures[]` 不留痕），只是这份设计**做不出来**。所以调用方**不重采样** ——
//   重抽同一份意图，抽一百次也还是做不出来。
import {
  GameDesignSpecSchema, GameIntentSpecSchema, PLATFORMER_V1, STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS,
  VisualWorldSpecSchema, forcedTool, parseToolUse, resolveRuntimeProfile, runtimeProfileRef,
  type CallFailure, type GameDesignSpec, type GameIntentSpec, type LedgerCall, type LedgerStep,
  type LedgerUsage, type RuntimeProfile, type RuntimeProfileRef, type VisualWorldSpec,
} from "@game-maker/contracts";
import { buildDesign, type Rejection } from "./build-design.js";
import { DESIGN_TOOL_DESCRIPTION, DESIGN_TOOL_NAME, designPrompt } from "./prompts.js";

/** 请求的模型名。⚠️ 与前三发同源（票 24 的实况：代理**请求一个、回另一个**）。 */
const REQUESTED_MODEL = "deepseek-v4-pro";

/** 输出上限。⚠️ 本产物是这四发里**最大**的（四桶 + 关卡 + 机制），但 16_000 是**上限不是分配**。 */
const MAX_TOKENS = 16_000;

/** 账里的 `target` = **产物名**（与 `"game-intent"` / `"game-config"` / `"recipe"` 同款）。 */
const LEDGER_TARGET = "game-design";

export type CompileDesignInput = {
  /** 已解析的意图（`analyze-intent` 的产物，或从 `run/v<N>/game-intent.json` 读回来的）。 */
  intent: GameIntentSpec;
  /** 已解析的这个世界（`analyze-reference` 的产物）。 */
  vws: VisualWorldSpec;
  /** 哪一代外壳。**省略 ⇒ 注册表里那一个**（第一阶段只有一个成员，`02 §4.2`）。 */
  runtimeProfile?: RuntimeProfileRef;
  transport: { baseUrl: string; apiKey: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type CompileDesignResult = {
  /** 过完契约（含 gate）、过完 R12 的成品。 */
  spec: GameDesignSpec;
  /** **一次调用 = 一格**。⚠️ 没上路就缺席；**被拒绝时它照样在**（那一发是成功的）。 */
  ledger?: LedgerCall[];
};

/** 「模型没干好」那一档 ⇒ CLI 映射成 `EXIT.invalid`(4)。 */
export class CompileDesignError extends Error {
  constructor(readonly failure: CallFailure, message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "CompileDesignError";
  }
}

/**
 * 「**这份设计做不出来**」那一档（R12）。
 * ⚠️ **与 `CompileDesignError` 分开是故意的**：那条路是「模型吐错了 ⇒ 重采样」，
 *   这条路是「**一条结论** ⇒ 立刻停」。⚠️ 它的账里**不会有** `failures` ——
 *   那一发上游调用成功了。CLI 也映射成 `EXIT.invalid`(4)，但文案走的是 `rejections`。
 */
export class DesignRejectedError extends Error {
  constructor(readonly rejections: Rejection[], message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "DesignRejectedError";
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
  | { kind: "ok"; spec: GameDesignSpec; spent: Spent }
  | { kind: "bad"; failure: CallFailure; detail: string; spent: Spent }
  | { kind: "rejected"; rejections: Rejection[]; detail: string; spent: Spent }
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

// ── 出发前的三处「免费」拦停（都在**第一个请求上路之前** ⇒ 不记账）────────────────
// ⚠️ 值钱的地方是同一条：**别让调用方的错去烧三次重采样**。

function assertConfigured(t: { baseUrl: string; apiKey: string }): void {
  if (t.baseUrl === "" || t.apiKey === "")
    throw new Error(
      "文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 一份 `game-design.json` 也可以由人直接写。");
}

/** ⚠️ 重过一次**上游契约**：调用方递来的可能是**从磁盘读回来的** `game-intent.json` / `visual-world.json`，
 *  而两份契约都带着自己的 gate（「同时管从磁盘上读回来的」那句自白）—— 手改过的文件在这里就该响。 */
function assertUpstream(intent: GameIntentSpec, vws: VisualWorldSpec): { intent: GameIntentSpec; vws: VisualWorldSpec } {
  const i = GameIntentSpecSchema.safeParse(intent);
  if (!i.success)
    throw new Error("调用方给的 `GameIntentSpec` 不过它自己的契约 —— ⚠️ 这是（或是一份手改过的）" +
      `上游产物，不是模型这一次吐的：${i.error.issues.slice(0, 4).map((x) => `${x.path.join(".")}: ${x.message}`).join("；")}`);
  const v = VisualWorldSpecSchema.safeParse(vws);
  if (!v.success)
    throw new Error("调用方给的 `VisualWorldSpec` 不过它自己的契约 —— 同上：" +
      v.error.issues.slice(0, 4).map((x) => `${x.path.join(".")}: ${x.message}`).join("；"));
  return { intent: i.data, vws: v.data };
}

/** ⚠️ 查不到 = **调用方的错**（选了一个不存在的代），不是设计的错 ⇒ 普通 `Error`、不记账、不重采样。 */
function pickProfile(ref: RuntimeProfileRef | undefined): RuntimeProfile {
  const want: RuntimeProfileRef = ref ?? { id: PLATFORMER_V1.id, version: PLATFORMER_V1.version };
  const profile = resolveRuntimeProfile(want);
  if (profile === undefined)
    throw new Error(`没有这一代外壳：\`${runtimeProfileRef(want)}\` —— 注册表里有 ` +
      `（第一阶段只有 \`${runtimeProfileRef(PLATFORMER_V1)}\`）。⚠️ R12 的拒绝要**说得出是哪一代的能力**，` +
      "所以这里不猜，直接当作调用方的问题。");
  return profile;
}

/** 一次往返。**只做一次** —— 重采样在调用方那层（R16 的固定次数）。 */
async function onceThrough(o: {
  baseUrl: string; apiKey: string; body: string; timeoutMs: number; doFetch: typeof fetch;
  intent: GameIntentSpec; vws: VisualWorldSpec; profile: RuntimeProfile;
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
  const parsed = parseToolUse(body, DESIGN_TOOL_NAME, GameDesignSpecSchema);
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };

  // 注入三个照抄值 → 过契约（gate 在这里响）→ 跑 R12 的拒绝。
  const built = buildDesign({ fromModel: parsed.value, intent: o.intent, vws: o.vws, profile: o.profile });
  if (built.ok) return { kind: "ok", spec: built.spec, spent };
  if (built.kind === "schema") return { kind: "bad", failure: "schema", detail: `装配后不过契约：${built.detail}`, spent };
  return { kind: "rejected", rejections: built.rejections, detail: built.detail, spent };
}

/**
 * 把意图 + 这个世界做成一份设计。
 *
 * ⚠️ **传输层的失败不重采样**（`http` / `timeout`）—— 与前三发一致。
 * ⚠️ **R12 的拒绝也不重采样**（Q3c）—— 它是结论，不是抽签。
 * ⚠️ 只有「入参不过 Zod / 装配后不过契约」这一档才重采样（R16）。
 */
export async function compileDesign(input: CompileDesignInput): Promise<CompileDesignResult> {
  assertConfigured(input.transport);
  const { intent, vws } = assertUpstream(input.intent, input.vws);
  const profile = pickProfile(input.runtimeProfile);

  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const body = JSON.stringify({
    model: REQUESTED_MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
    ...forcedTool(DESIGN_TOOL_NAME, DESIGN_TOOL_DESCRIPTION, GameDesignSpecSchema),
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: designPrompt({
          intent, vws,
          echo: {
            runtimeProfile: runtimeProfileRef(profile),
            genre: profile.id,
            camera: vws.camera.mode,
            ...(intent.title === undefined ? {} : { gameTitleHint: intent.title }),
          },
        }),
      }],
    }],
  });

  const call = spentCall("compile-design", LEDGER_TARGET);
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      baseUrl: input.transport.baseUrl, apiKey: input.transport.apiKey, body, timeoutMs, doFetch,
      intent, vws, profile,
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      const ledger = call.record();
      throw new CompileDesignError(once.failure, once.detail, ledger ? [ledger] : undefined);
    }
    if (once.kind === "rejected") {
      // ⚠️ **这一发成功了**：`trip` 只带 `spent`，**不带 failure** —— 账上因此没有失败痕迹。
      call.trip({ spent: once.spent });
      const ledger = call.record();
      throw new DesignRejectedError(
        once.rejections,
        `这份设计做不出来（R12）。${once.rejections.length} 条理由：\n` +
          once.rejections.map((r) => `  · [${r.reason}] ${r.detail}`).join("\n"),
        ledger ? [ledger] : undefined,
      );
    }
    if (once.kind === "ok") {
      call.trip({ spent: once.spent });
      const ledger = call.record();
      return { spec: once.spec, ...(ledger ? { ledger: [ledger] } : {}) };
    }
    call.trip({ failure: once.failure, spent: once.spent });
    lastFailure = once.failure;
    lastDetail = once.detail;
  }

  const ledger = call.record();
  throw new CompileDesignError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 GameDesignSpec（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  );
}
