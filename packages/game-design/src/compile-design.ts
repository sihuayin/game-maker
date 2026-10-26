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
  carryOnError, DESIGN_ATTEMPTS_FORMAT,
  GameDesignSpecSchema, GameIntentSpecSchema, PLATFORMER_V1, STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS,
  VisualWorldSpecSchema, buildTextRequest, parseTextResponse, resolveRuntimeProfile, runtimeProfileRef, textModelOf, textUsageOf,
  type CallFailure, type DesignAttempt, type DesignAttempts,
  type GameDesignSpec, type GameIntentSpec, type LedgerCall, type LedgerStep,
  type LedgerUsage, type RuntimeProfile, type RuntimeProfileRef, type TextTransport, type ToolUseFailure, type VisualWorldSpec,
} from "@game-maker/contracts";
import { buildDesign, type Rejection } from "./build-design.js";
import { DESIGN_TOOL_DESCRIPTION, DESIGN_TOOL_NAME, designPrompt } from "./prompts.js";

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
  transport: TextTransport;
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

/** ⚠️ 后两支多带一枚 `raw`（票 55）：**模型自己写下的那份入参**，原样。
 *  它不参与任何判断，只为了**活过失败**（挂到异常上 ⇒ 现场里的 `design-attempts.json`）。
 *  ⚠️ `bad` 的 `failure` 收成 `ToolUseFailure`（四个值 ⟺ `DESIGN_ATTEMPT_OUTCOMES` 的前四个），
 *  于是「这一发是什么下场」不需要一次转型。 */
type Trip =
  | { kind: "ok"; spec: GameDesignSpec; spent: Spent }
  | { kind: "bad"; failure: ToolUseFailure; detail: string; spent: Spent; raw?: unknown }
  | { kind: "rejected"; rejections: Rejection[]; detail: string; spent: Spent; raw: unknown }
  | { kind: "upstream"; failure: Extract<CallFailure, "http" | "timeout">; detail: string };

function spentOf(transport: TextTransport, body: unknown): Spent {
  const { model, usage } = textUsageOf(transport, body);
  return {
    requestedModel: textModelOf(transport),
    ...(model ? { model } : {}),
    ...(usage ? { usage } : {}),
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
  url: string; headers: Record<string, string>; body: string; timeoutMs: number; doFetch: typeof fetch;
  transport: TextTransport; intent: GameIntentSpec; vws: VisualWorldSpec; profile: RuntimeProfile;
}): Promise<Trip> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  let res: Response;
  try {
    res = await o.doFetch(o.url, { method: "POST", signal: ctl.signal, headers: o.headers, body: o.body });
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

  const spent = spentOf(o.transport, body);
  // ⚠️ **唯一算数的判据**：入参过 Zod。`stop_reason === "tool_use"` **不是**成功信号。
  const parsed = parseTextResponse({ transport: o.transport, body, toolName: DESIGN_TOOL_NAME, schema: GameDesignSpecSchema });
  if (!parsed.ok)
    return {
      kind: "bad", failure: parsed.failure, detail: parsed.detail, spent,
      // ⚠️ 票 55：**模型写下的那一份跟着走** —— 哪怕它不过契约（那一份原话正是被拒时唯一读得到的）。
      ...(parsed.raw === undefined ? {} : { raw: parsed.raw }),
    };

  // 注入三个照抄值 → 过契约（gate 在这里响）→ 跑 R12 的拒绝。
  const built = buildDesign({ fromModel: parsed.value, intent: o.intent, vws: o.vws, profile: o.profile });
  if (built.ok) return { kind: "ok", spec: built.spec, spent };
  if (built.kind === "schema")
    return { kind: "bad", failure: "schema", detail: `装配后不过契约：${built.detail}`, spent, raw: parsed.raw };
  return { kind: "rejected", rejections: built.rejections, detail: built.detail, spent, raw: parsed.raw };
}

/**
 * 这一圈的入参**要不要带走**、带走什么（票 55 的 Q5）。
 *
 * ⚠️ **判据不是「抛的是哪个类」**：`http` / `timeout` 抛在**第 2 发**时，第 1 发那份入参
 *   就在手上 —— 按错误类分流（「只有 R12 那一档才写」）会把它**连同现场一起丢掉**。
 *   判据是**这一圈有没有拿到过模型入参**：拿到过就带，一个都没拿到就什么都不带
 *   （`carryOnError` 的空场合 ⇒ 连键都不加，也就不会有「写一个什么都没有的容器」那一档）。
 * ⚠️ 「拿到过」= **至少一发有 `raw`**，而且是**按字节**算的：模型真写了一个 `{}` 也算拿到过
 *   （那是票 27 实测的那个形状，最值钱的一条证据）。真正「一个都没有」的只有 `no-tool-use`
 *   —— 那一档连块都不在，压根没有入参可言。
 */
function carriedAttempts(attempts: DesignAttempt[]): { designAttempts?: DesignAttempts } {
  return attempts.some((a) => a.raw !== undefined)
    ? { designAttempts: { format: DESIGN_ATTEMPTS_FORMAT, attempts } }
    : {};
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
  const req = buildTextRequest({
    transport: input.transport,
    prompt: designPrompt({
      intent, vws,
      echo: {
        runtimeProfile: runtimeProfileRef(profile),
        genre: profile.id,
        camera: vws.camera.mode,
        ...(intent.title === undefined ? {} : { gameTitleHint: intent.title }),
      },
    }),
    toolName: DESIGN_TOOL_NAME, toolDescription: DESIGN_TOOL_DESCRIPTION, schema: GameDesignSpecSchema, maxTokens: MAX_TOKENS,
  });

  const call = spentCall("compile-design", LEDGER_TARGET);
  // ⚠️ **票 55**：这一圈里模型写下的入参 —— 只有它会被带到失败现场去。
  //   ⚠️ **「重采样之后成功」那一跑留不下来**，这是**有意的取舍**（票 55 的第一轮推论，写在明处）：
  //   只有**抛出来**才有写入点（阴性判据要求「成功路径一个字节不变」），而成功的那一跑本来就走过去了。
  const attempts: DesignAttempt[] = [];
  /** 挂上这一圈再抛 —— **抛点只有这一个**，免得三处各写一遍挂载（`carryOnError` 没东西可带时是空操作）。
   *  ⚠️ 写成**函数声明**（不是 `const` 箭头）：只有这种形状，TS 才认它「永不返回」
   *  ⇒ 上面那三个 `if` 之后的收窄与「函数有终」才成立。 */
  function raise(e: unknown): never {
    carryOnError(e, carriedAttempts(attempts));
    throw e;
  }
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      url: req.url, headers: req.headers, body: req.body, timeoutMs, doFetch,
      transport: input.transport, intent, vws, profile,
    });
    if (once.kind === "upstream") {
      // ⚠️ **上游失败不记进 `attempts`**：它发生在取到 body 之前，压根没有模型入参
      //   （`DESIGN_ATTEMPT_OUTCOMES` 里没有它那一格）—— 它在**账**的 `failures[]` 里。
      call.trip({ failure: once.failure });
      const ledger = call.record();
      raise(new CompileDesignError(once.failure, once.detail, ledger ? [ledger] : undefined));
    }
    if (once.kind === "rejected") {
      attempts.push({ attempt, outcome: "rejected", detail: once.detail, rejections: once.rejections, raw: once.raw });
      // ⚠️ **这一发成功了**：`trip` 只带 `spent`，**不带 failure** —— 账上因此没有失败痕迹。
      call.trip({ spent: once.spent });
      // ⚠️ **R12 的两类**（recipe-config-gap-v1 票 07 暴露）：`intent-*`（机制/实体在设计层漏写）是
      //   **采样失误** —— 机制/实体都在封闭枚举里、只是模型这一发漏了，重采样可能补上 ⇒ 与 schema 失败同档、重试；
      //   `*-unsupported` / `mechanic-experimental`（外壳真做不了）是**确定性** —— 重采样无用 ⇒ 立即抛。
      const resampleable = once.rejections.every(
        (r) => r.reason === "intent-mechanic-missing" || r.reason === "intent-entity-missing",
      );
      if (resampleable && attempt < STRUCTURED_CALL_ATTEMPTS) continue;
      const ledger = call.record();
      raise(new DesignRejectedError(
        once.rejections,
        `这份设计做不出来（R12）。${once.rejections.length} 条理由：\n` +
          once.rejections.map((r) => `  · [${r.reason}] ${r.detail}`).join("\n"),
        ledger ? [ledger] : undefined,
      ));
    }
    if (once.kind === "ok") {
      call.trip({ spent: once.spent });
      const ledger = call.record();
      return { spec: once.spec, ...(ledger ? { ledger: [ledger] } : {}) };
    }
    attempts.push({
      attempt, outcome: once.failure, detail: once.detail,
      ...(once.raw === undefined ? {} : { raw: once.raw }),
    });
    call.trip({ failure: once.failure, spent: once.spent });
    lastFailure = once.failure;
    lastDetail = once.detail;
  }

  const ledger = call.record();
  raise(new CompileDesignError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 GameDesignSpec（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  ));
}
