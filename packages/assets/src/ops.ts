// core 的**公开操作面**（票 30）。CLI 与 MCP 都是它的薄壳 —— 两者渲染**同一份** `CommandResult`。
//
// R5 排除了「MCP 转调 CLI」，所以这里是唯一的实现处：core 返回结构体，两个壳各自渲染。
//
// ⚠️ **路径一律相对于调用方给的 `outRoot`**，不是绝对路径。
// 绝对路径把「产物在哪儿」与「这台机器上的哪里」绑死 —— 而票 24 已经为资源包避开了同一个错
// （包内一律相对路径）。MCP 把路径交给 agent 时，agent 自己知道根在哪。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  auditGameConfig, ConfigToolSchema, entityBox, FALLBACK_ANCHOR, forcedTool, GameDesignSpecSchema,
  parseAssetPack, parseGameConfig, parseLedger, parseRecipe, parseToolUse, PLATFORMER_V1,
  RecipeToolSchema, resolveRuntimeProfile, runtimeProfileRef, STRUCTURED_CALL_ATTEMPTS,
  summarizeCalls, VisualWorldSpecSchema,
  type AssetPackManifest, type CallFailure, type ConfigIssue, type LedgerCall, type LedgerStep,
  type LedgerUsage, type StructuredSchema, type StyleSpec,
} from "@game-maker/contracts";
import { createDrawListGenerator, GenerationError, stripFences, UPSTREAM_TIMEOUT_MS } from "./generate.js";
import { DEFAULT_CONCURRENCY } from "./pack.js";
import { backgroundCoverage } from "./coverage.js";
import { buildAssetPack, type FailureSite } from "./pack.js";
import { createDashScopeMcpGenerator, createGeminiGenerator, createOpenAIGenerator, ImageGenerationError, type ImageGenerator } from "./image-gen.js";
import { describeImageTransport, type ImageTransport } from "./image-config.js";
import { createProxyFetch } from "./http.js";
import { decodePNG } from "./png.js";
import { assetPlanPrompt, assetTask, CONFIG_TOOL_DESCRIPTION, CONFIG_TOOL_NAME, designBrief, drawListFewShot, drawListOpsSpec, paletteLine, PLAN_TOOL_DESCRIPTION, PLAN_TOOL_NAME, recipeShapeSpec, styleBrief, tdConfigPrompt } from "./prompt.js";

// ⚠️ **2026-09-29 搬到 `@game-maker/contracts`**（票 33）—— `site` 装配住在 `demo`，
//   而依赖图里 demo 只能依赖 contracts。这里**引入 + 原样再导出**，调用方一行都不用改。
import { CommandError, EXIT, DEFAULT_HUD_LINE_HEIGHT, auditScreenSpace, auditTdConfig, gameHudScreenItems, parseTdConfig, tdHudScreenItems, tdResolveConfig, type CommandResult, type TdConfig } from "@game-maker/contracts";
export { CommandError, EXIT, exitCodeOfError, type CommandResult } from "@game-maker/contracts";
export type Transport = { baseUrl: string; apiKey: string };
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

/**
 * **「已经花掉的」那一段** —— 两个壳（CLI 与 MCP）**共用这一处**。
 *
 * ⚠️ **别在两个壳里各写一遍**：它们的输出**必须一字不差**（人看 CLI、agent 看 MCP），
 *   而两份拷贝会漂 —— 2026-09-30 就给「`ms` 缺席」那句「还没回来」**同时往两份里贴过**，
 *   贴的时候还得记得两边都改（code-review 抓到的正是这个）。
 *
 * ⚠️ `ms` 缺席要印成**「还没回来」**，不许印 `0.0s`：那是**没测到**，不是「花了 0 秒」。
 */
export function formatSpentCalls(calls: readonly LedgerCall[]): string {
  const trips = calls.reduce((n, c) => n + c.attempts, 0);
  return `已经花掉的（${calls.length} 次调用 · ${trips} 次往返）：\n` +
    calls.map((c) => `  · ${c.step} ${c.target} · ${c.ms === undefined ? "**还没回来**" : (c.ms / 1000).toFixed(1) + "s"} · 往返 ${c.attempts}${c.model ? ` · ${c.model}` : ""}`).join("\n");
}

// ── plan-assets：设计 + 这个世界 → 资源清单（票 12）───────────────────────────
//
// ⚠️ **这一道是 `derive` 的接班人，不是它的兄弟**（票 12 的 Q1：(a) 合并 —— 票 09 / 10 / 11 三次
//   把这一问推给它）。两者产的是**同一种文件**，而这一道是它的**严格超集**：
//   旧的 `derive` 提示词**明确拒绝**决定策略（「所有资源的 source 都写 drawlist……
//   那一项由人后续自己填」），而 V2 要求 LLM 决定它（`00 §2.4`）。
//   ⇒ 于是**写入侧只有这一处**（`derivePackMode` 那条教训：两个入口各写一遍必然漂移）。
export type PlanAssetsOptions = {
  /** `game-design.json` —— 理解层的收尾产物（票 10）。 */
  designPath: string;
  /** `visual-world.json` —— 票 02 的产物。 */
  visualWorldPath: string;
  outRoot: string;
  transport?: Transport; fetchImpl?: typeof fetch;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

/** 上游自报的模型名与用量（与 `callText` 那条路同款 —— 它们是「花了什么」的事实，票 45）。 */
function spentOfTool(body: unknown): Spent {
  const j = body as {
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number };
  } | null;
  const u = j?.usage;
  return {
    ...(j?.model !== undefined ? { model: j.model } : {}),
    ...(u === undefined
      ? {}
      : {
          usage: {
            ...(u.input_tokens !== undefined ? { inputTokens: u.input_tokens } : {}),
            ...(u.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
            ...(u.reasoning_tokens !== undefined ? { reasoningTokens: u.reasoning_tokens } : {})
          }
        })
  };
}

/**
 * **一次往返**（**R16 那条协议**：强制工具调用）。⚠️ 它与上面 `onceThrough` 那条**旧协议**的路
 * **并列**，别把两者混起来：那条走 `callText` + 剥围栏 + `JSON.parse`，这条走 `parseToolUse`。
 *
 * ⚠️ **唯一的成功判据是入参过 Zod** —— `stop_reason === "tool_use"` **不是**（票 27 第 1 发实测：
 *   工具被调、`input = {}`、1135 token 打水漂）。
 */
async function onceThroughTool<T>(o: {
  transport: Transport; body: string; tool: string; schema: StructuredSchema<T>;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<Once<T>> {
  const doFetch = o.fetchImpl ?? fetch;
  const timeoutMs = o.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(`${o.transport.baseUrl}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": o.transport.apiKey, "anthropic-version": "2023-06-01" },
      body: o.body,
    });
  } catch (e) {
    const kind = ctl.signal.aborted ? ("timeout" as const) : ("http" as const);
    const msg = ctl.signal.aborted
      ? `上游 ${Math.round(timeoutMs / 1000)} 秒没回应，已中止（超时）`
      : (e as Error).message;
    return { kind: "upstream", failure: kind, error: new UpstreamCallError(kind, msg) };
  } finally { clearTimeout(timer); }

  if (!res.ok)
    return { kind: "upstream", failure: "http", error: new UpstreamCallError("http", `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`) };

  let body: unknown;
  try { body = await res.json(); }
  catch (e) { return { kind: "upstream", failure: "http", error: new UpstreamCallError("http", `上游回的不是 JSON：${(e as Error).message}`) }; }

  const spent = spentOfTool(body);
  const parsed = parseToolUse(body, o.tool, o.schema);
  // 形式的失败（没调工具 / 入参丢了 / 不合线形状）由 `parseToolUse` 分好类 —— 那一档才是重采样的理由。
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };
  return { kind: "ok", result: { ok: true, value: parsed.value } as const, spent };
}

/**
 * 规划一份资源清单。**两阶段的第一阶段**（票 28）—— 清单落盘，人过目，再 `pack`。
 *
 * ⚠️ 清单**绝不覆盖**：每次规划写一个新的 `v<N>`（与资源包同一条规矩）。
 * ⚠️ **它走 R16**（强制工具调用 + 入参过 Zod + `STRUCTURED_CALL_ATTEMPTS` 次重采样）——
 *   与 `derive` 当年那条「纯文本 + 剥围栏 + 2 次」的旧路**不是一回事**，别照抄旧的那份。
 * ⚠️ **入参过线形状不算数**：真正的判据是 `parseRecipe`（v3 那份契约）—— 依赖图 · 母版比例 ·
 *   九宫格中央区 · 路径字符都住在它里面（`recipe-tool.ts` 的文件头解释了这条分工）。
 */
export async function planAssets(opts: PlanAssetsOptions): Promise<CommandResult> {
  const readJson = (p: string, what: string): unknown => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { throw new CommandError("invalid", `${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  };
  const fmt = (e: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) =>
    e.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；");

  const d = GameDesignSpecSchema.safeParse(readJson(opts.designPath, "设计"));
  if (!d.success) throw new CommandError("invalid", `设计不过 schema：${fmt(d.error)}`);
  const w = VisualWorldSpecSchema.safeParse(readJson(opts.visualWorldPath, "这个世界"));
  if (!w.success) throw new CommandError("invalid", `这个世界不过 schema：${fmt(w.error)}`);
  // ⚠️ **查的是两个字段空不空，不是对象在不在** —— 这一条是从 `derive` 那里继承来的教训
  //   （它的账测试里记着）：只查对象的话，`{baseUrl:"", apiKey:""}` 会**照样发出去**，
  //   而 fetch 对空 baseUrl 抛的那一枪会被记成 `failure: "http"` ——
  //   **一个本地配置错被计成上游故障**，于是「上游今天稳不稳」这个数被自己的配置污染了。
  // ⚠️ 报错里**点名两个环境变量**：这一档以前是 `callText` 替它报的，而那条路现在不走了。
  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")
    throw new CommandError(
      "upstream",
      "规划资源清单需要文本上游：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但清单是文件 —— 人可以直接写一份，再 `pack`。");

  const design = d.data;
  const world = w.data;
  const refs = world.styleReferences;
  /** ⚠️ 风格与清单**住同一个目录** ⇒ `styleRef` 就是一个普通文件名（与 `derive` 当年的做法一字不差）。 */
  const STYLE_FILE = "stylespec.json";
  const REF_FILE = "reference.png";

  const body = JSON.stringify({
    // ⚠️ 与 `callText` 同源（票 24 的实况：代理**请求一个、回另一个**，`model` 与 `requestedModel` 是两个事实）。
    model: "deepseek-v4-pro", max_tokens: 16_000, thinking: { type: "disabled" },
    ...forcedTool(PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, RecipeToolSchema),
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: assetPlanPrompt({
          design, vws: world,
          echo: { styleRef: STYLE_FILE, styleId: world.style.id, ...(refs.length > 0 ? { referenceImage: REF_FILE } : {}) }
        })
      }]
    }]
  });

  // ⚠️ 账**只进回报，不落盘**（票 19：账跟着「包」走，而「清单」不是包 —— 清单可以是人直接写的）。
  const call = spentCall("plan-assets", "recipe");
  let checked: ReturnType<typeof parseRecipe> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThroughTool({
      transport: opts.transport, body, tool: PLAN_TOOL_NAME, schema: RecipeToolSchema,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
    }
    // ⚠️ 「没上路」那一档在**这条路上不该出现**（凭据上面已经查过）—— 留着这一句是为了让类型收窄
    //   说得出口，而它真出现时按「上游不可达」报（与 `derive` 当年同款）。
    if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
    if (once.kind === "bad") {
      call.trip({ failure: once.failure, spent: once.spent });
      lastError = once.detail;
      continue;
    }
    const truth = parseRecipe(once.result.value);
    if (!truth.ok) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = `清单不过契约：${truth.errors.slice(0, 4).join("；")}`;
      continue;
    }
    call.trip({ spent: once.spent });
    checked = truth;
    break;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));

  const dir = path.join(opts.outRoot, checked.value.id, "recipes");
  fs.mkdirSync(dir, { recursive: true });
  // ⚠️ 落盘的风格是**这个世界的 `style` 子树**（R6 说的那个「兼容载体」）—— 它原样就是一份
  //   `StyleSpec`，所以配方契约与 `pack` 都**一行不用改**。
  fs.writeFileSync(path.join(dir, STYLE_FILE), JSON.stringify(world.style, null, 2) + "\n");
  const out: Record<string, unknown> = { ...checked.value, styleRef: STYLE_FILE };
  if (refs.length > 0) {
    // ⚠️ 风格参考图**拷进配方目录**（与 stylespec 同款）：`referenceImage` 是**原图参与生图**的唯一入口
    //   （`03 §15` 要求原图必须参与），而世界那边的路径是**相对 `visual-world.json`** 的。
    const src = path.resolve(path.dirname(opts.visualWorldPath), refs[0]!.path);
    try { fs.copyFileSync(src, path.join(dir, REF_FILE)); }
    catch (e) { throw new CommandError("invalid", `世界指的那张风格参考图读不出来：${src} —— ${(e as Error).message}`); }
    out["referenceImage"] = REF_FILE;
  } else {
    delete out["referenceImage"]; // 世界没给参考图 ⇒ 不留模型瞎写的那个值
  }
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");

  const kinds: Record<string, number> = {};
  for (const a of checked.value.assets) kinds[a.spec.kind] = (kinds[a.spec.kind] ?? 0) + 1;
  return {
    command: "plan",
    summary: [`清单已落盘：${rel(opts.outRoot, file)}`, `${checked.value.assets.length} 个资源（${Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(" · ")}）`],
    data: { recipeId: checked.value.id, version, assetCount: checked.value.assets.length, kinds, ledger: asLedger(call.record()) },
    artifacts: [{ path: rel(opts.outRoot, file), kind: "asset-recipe" }]
  };
}

/**
 * 调一次文本上游（`derive` 用；生成走 `createDrawListGenerator`）。
 * ⚠️ 返回**不只是文本**：`usage` 与上游自报的模型名都要带出来（票 45）——
 *   它们是「花了什么」的事实，而这一层过去把它们直接丢了。
 */
/**
 * `callText` 失败**带着病因**（票 27 的 Q4(ii)，票 28 落地）。
 *
 * ⚠️ **为什么要一个类型而不是靠 message 认**：账上要写得出「**为什么**重来」，
 *   而按错误信息做字符串匹配去认病因，正是本仓库反复吃亏的那件事
 *   （票 06 量过：「那句好话站错了地方」也是同一种病）。
 *
 * ⚠️ 只有两档：`timeout`（我们自己中止的）与 `http`（**上游没给一个可用的应答** ——
 *   非 2xx、body 不是 JSON、连不上）。闭集里没有第三档，别现编。
 *
 * ⚠️ **「没配凭据」故意**不走这里 —— 那个错在**请求上路之前**就抛了（见下面 `callText` 的守卫），
 *   而账只记**真的发出去过**的往返（票 46）。它在 `onceThrough` 里落成 `"not-sent"`。
 */
export class UpstreamCallError extends Error {
  constructor(readonly failure: Extract<CallFailure, "http" | "timeout">, message: string) {
    super(message);
    this.name = "UpstreamCallError";
  }
}

async function callText(opts: Transport & { prompt: string; fetchImpl?: typeof fetch; timeoutMs?: number }):
Promise<{ text: string; usage?: LedgerUsage; servedModel?: string; stopReason?: string }> {
  // ⚠️ **没配凭据要在**这里**拦住**，不能让它落到 fetch 上去失败。
  //   两个壳（CLI 一处 + MCP 三处）永远传一个**定义了、但 `baseUrl` 可能是空串**的对象，
  //   所以 `ops` 里那些 `if (!opts.transport)` 恒不触发 —— 用户看到的是一个原始 fetch 报错，
  //   而不是这句话。（票 06 量到的：那句好话站错了地方。）
  if (opts.baseUrl === "" || opts.apiKey === "")
    throw new Error(
      "文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 资源清单与关卡配置都可以由人直接写一份。");

  const doFetch = opts.fetchImpl ?? fetch;
  // ⚠️ 超时**做成参数**：否则「上游不响应」这条路径在测试里就要真等 180 秒，而那等于测不了。
  const timeoutMs = opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(`${opts.baseUrl}/v1/messages`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 32_000, thinking: { type: "disabled" }, messages: [{ role: "user", content: opts.prompt }] }),
    });
  } catch (e) {
    // ⚠️ 中止与「连不上」是**两件事**，而 fetch 都抛 AbortError/TypeError —— 分开报，否则人查错方向
    if (ctl.signal.aborted) throw new UpstreamCallError("timeout", `上游 ${Math.round(timeoutMs / 1000)} 秒没回应，已中止（超时）`);
    throw new UpstreamCallError("http", e instanceof Error ? e.message : String(e));
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new UpstreamCallError("http", `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    model?: string; content?: { type: string; text?: string }[]; stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };
  const u = j.usage;
  return {
    text: (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
    ...(j.model ? { servedModel: j.model } : {}),
    // ⚠️ `stop_reason` 要交出来（票 28）：以前这一层只顾着取文本，于是**截断**
    //   在三个调用点上一律表现为「不是合法 JSON」—— 一个**假病因**，而它会把人引去查模型。
    ...(j.stop_reason ? { stopReason: j.stop_reason } : {}),
    ...(u ? { usage: {
      ...(u.input_tokens !== undefined ? { inputTokens: u.input_tokens } : {}),
      ...(u.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
      ...(u.completion_tokens_details?.reasoning_tokens !== undefined ? { reasoningTokens: u.completion_tokens_details.reasoning_tokens } : {}),
    } } : {}),
  };
}

/** 上游自报的、跟着这一笔走的东西。⚠️ 单独一个类型：它俩总是**成对**出现，不该在路上散成两个参数。 */
type Spent = Pick<LedgerCall, "model" | "usage">;

/**
 * 一次**往返**的结果。
 *
 * ⚠️ `"not-sent"` 是**故意**分开的一档：那是**我们这边**没把请求发出去（没配凭据），
 *   不是上游的错 —— 而账上**也不该有这一笔**（票 46：只记真的发出去的）。
 */
type Once<T> =
  | { kind: "ok"; result: { ok: true; value: T }; spent: Spent }
  | { kind: "bad"; failure: CallFailure; detail: string; spent: Spent }
  | { kind: "upstream"; failure: CallFailure; error: Error }
  | { kind: "not-sent"; error: Error };

/**
 * **发一趟、拿回来、解析** —— 文本那三处（`derive` / `compile-game` / `compile-td-game`）
 * 共用的那一段。⚠️ 以前它是**抄三遍**的，而三遍里各自对「失败」的处理还都不一样。
 *
 * ⚠️ **只管一次往返**：`attempts` 的累加与 `failures` 的追加是调用方的事（见 `spentCall`）——
 *   因为账的一格是**一次调用**，不是一次往返（`CONTEXT.md` 的「调用 / 往返」）。
 *
 * ⚠️ **失败是返回值，不是抛**（除了上游那一档）：调用方得先把这一趟记进账，再决定重采样还是收工。
 *   抛出去的话账就漏了 —— 而「花了钱是事实，失败不改变这个事实」（票 46）。
 */
async function onceThrough<T>(o: {
  transport: Transport; prompt: string; fetchImpl?: typeof fetch; timeoutMs?: number;
  /** 出 schema 问题时那句话里的主语：「推导出来的清单」/「编译出来的配置」/「编译出来的关卡」。 */
  what: string;
  parse: (input: unknown) => { ok: true; value: T } | { ok: false; errors: string[] };
}): Promise<Once<T>> {
  let r: Awaited<ReturnType<typeof callText>>;
  try {
    r = await callText({ ...o.transport, prompt: o.prompt,
      ...(o.fetchImpl !== undefined ? { fetchImpl: o.fetchImpl } : {}),
      ...(o.timeoutMs !== undefined ? { timeoutMs: o.timeoutMs } : {}) });
  } catch (e) {
    const err = e as Error;
    return e instanceof UpstreamCallError
      ? { kind: "upstream", failure: e.failure, error: err }
      : { kind: "not-sent", error: err };
  }
  // ⚠️ 上游自报的模型名与用量要带出来 —— 它们是「花了什么」的事实（票 45），而这一层以前把它们丢了。
  const spent: Spent = {
    ...(r.servedModel !== undefined ? { model: r.servedModel } : {}),
    ...(r.usage !== undefined ? { usage: r.usage } : {}),
  };
  // ⚠️ **截断只用来「解释失败」，不拿它推翻一次成功。** 先解析、再校验，两关都过了就是成功；
  //   只有没过时才回头看 `stop_reason`。反过来的话，一份**完整**的产出会因为 `stop_reason`
  //   被判失败、丢掉重来（多花一次钱），而被截断的产出又会被报成「模型吐了坏数据」（查错方向）。
  const truncated = r.stopReason === "max_tokens";
  let parsed: unknown;
  try { parsed = JSON.parse(stripFences(r.text)); }
  catch (e) {
    return truncated
      ? { kind: "bad", failure: "truncated", detail: "输出撞上了 max_tokens 被截断（不是模型吐了坏数据）", spent }
      : { kind: "bad", failure: "invalid-json", detail: `上游返回的不是合法 JSON：${(e as Error).message}`, spent };
  }
  const p = o.parse(parsed);
  if (!p.ok)
    return truncated
      ? { kind: "bad", failure: "truncated", spent,
          detail: `输出撞上了 max_tokens 被截断，而且也没过 schema：${p.errors.slice(0, 4).join("；")}` }
      : { kind: "bad", failure: "schema", spent,
          detail: `${o.what}不过 schema：${p.errors.slice(0, 4).join("；")}` };
  return { kind: "ok", result: p, spent };
}

/**
 * 一次**调用**的账：随往返累加，**最后一次性交出去**。
 *
 * ⚠️ **一格 = 一次调用，不是一次往返**（`CONTEXT.md` 的「调用 / 往返」：`attempts` 记的是
 *   「这一次调用里往返了几次」）。⇒ 重采样**不新开一格**，而是在同一格里把 `attempts` 加上去、
 *   把每次没成的原因追加进 `failures`。两个都留着，账才同时回答得了「重试烧了多少」
 *   **和**「每次为什么重来」—— 只留前者的旧账，把那四种病因混成了同一个分母。
 */
function spentCall(step: LedgerStep, target: string) {
  const t0 = Date.now();
  const failures: CallFailure[] = [];
  let trips = 0;
  let spent: Spent = {};
  return {
    trip(o: { failure?: CallFailure; spent?: Spent } = {}) {
      trips += 1;
      if (o.failure !== undefined) failures.push(o.failure);
      // ⚠️ 只有**成功**那一趟带 `spent`，而一趟调用里至多成功一次（成了就 break）
      //   ⇒ 后面失败的那些**盖不掉**它。
      if (o.spent !== undefined) spent = { ...spent, ...o.spent };
    },
    /** ⚠️ **一次都没发出去就返回 `null`** —— 账不记没上路的往返（票 46）。 */
    record(): LedgerCall | null {
      if (trips === 0) return null;
      return {
        step, target, upstream: "messages", ms: Date.now() - t0, attempts: trips,
        ...(failures.length === 0 ? {} : { failures }), ...spent,
      };
    },
  };
}

/** `data.ledger` 要的是数组 —— 一次都没发出去就是空数组（与 `pack` 那边的口径一致）。 */
const asLedger = (r: LedgerCall | null): LedgerCall[] => (r === null ? [] : [r]);
/** 把这一次调用的账装进 `CommandError`；没发出去就**不带**（票 46：只记真的发出去的）。 */
const ledgerCarrying = (r: LedgerCall | null): { ledger?: LedgerCall[] } => (r === null ? {} : { ledger: [r] });

function nextVersion(dir: string): number {
  if (!fs.existsSync(dir)) return 1;
  const vs = fs.readdirSync(dir).map((d) => /^v(\d+)\.json$/.exec(d)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1]));
  return vs.length === 0 ? 1 : Math.max(...vs) + 1;
}

// ── compile-game：需求 + 资源包 → game-config ────────────────────────────────
//
// 与 `derive → pack` 完全同构（票 09 裁决 2）：**一次 LLM 调用编译 → 先落盘成文件 →
// 人过目 → 再装配**。产物 B 的那条链从此**首尾闭合**：需求 → 配置 →（票 33）站点。
//
// ⚠️ **输入用的是「资源包的 manifest」而不是 `asset-recipe/v1` 配方。**
//   两者是同一个清单的两种状态，而 manifest 是**实现态**、也正是 config 必须解析通过的那一份。
//   用配方会让「模型看到的」与「校验依据的」成为两份 —— 那正是本仓库反复吃的亏。

/** 外壳视口。⚠️ 与票 32 裁决 1 的外壳常量同值；调用方可以显式传（CLI 传的就是外壳那一份）。 */
export const DEFAULT_VIEWPORT = { w: 480, h: 270 } as const;

/**
 * 给模型看的**形状骨架**。⚠️ **它必须是能过 schema 的** —— 导出它是为了让测试能直接断言这件事。
 *
 * 票 40 抓到过三条「**提示词教模型写一个会被自己拒收的形状**」（`tileable` 少一个轴、
 * 锚点没进提示词、帧数两份实现）。这里的等价风险是：教模型把 `at` 当左上角、
 * 或者把 HUD 摆到屏幕外。**示例错了，模型就会错，而且是以一种「看起来没问题」的方式错。**
 */
export const gameConfigExample = {
  format: "game-config/v1",
  world: { size: { w: 1440, h: 270 } },
  scene: { background: { asset: "<背景资源的 id>" } },
  player: {
    asset: "<玩家资源的 id>",
    anims: { idle: "<idle 动画名>", run: "<run 动画名>", jump: "<jump 动画名>" },
    at: { x: 40, y: 250 },
  },
  terrain: [{ x: 0, y: 250, w: 1440, h: 20 }],
  entities: [
    { id: "pickup-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "<可拾取资源的 id>" },
    { id: "block-1", kind: "solid", at: { x: 500, y: 250 }, asset: "<静态障碍资源的 id>" },
    { id: "mover", kind: "hazard", at: { x: 800, y: 250 }, asset: "<危险物资源的 id>", anim: "<动画名>",
      motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "<终点资源的 id>", anim: "<动画名>" },
  ],
  hud: {
    panel: { asset: "<ui 面板资源的 id>", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } },
    pip: { asset: "<ui 标记资源的 id>", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } },
  },
  objective: { kind: "collect-then-reach", gate: "gate" },
} as const;

/** 把资源包渲染成模型能读的一张清单：id / 种类 / 尺寸 / **锚点落点** / 动画名 / 背景层。 */
function resourceBrief(manifest: AssetPackManifest): string {
  const lines: string[] = [];
  for (const a of manifest.assets) {
    const anims = a.animations ?? [];
    const animText = anims.length === 0
      ? "（无动画，引用时不必给 anim）"
      : anims.map((x) => `${x.name}(${x.frames.length} 帧)`).join(" · ");
    lines.push(`- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · 锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · 动画：${animText}`);
    if (a.layers && a.layers.length > 0)
      lines.push(`    背景层（远→近）：${a.layers.map((l) => `${l.name}(parallax ${l.parallax}${l.tileable?.x ? " 可平铺" : ""})`).join(" · ")}`);
  }
  return lines.join("\n");
}

/** 把「锚点」翻译成人能照着摆的一句话 —— 这一条是模型最容易搞错的地方。 */
const anchorHint = (a: { x: number; y: number }): string =>
  a.y === 1 && a.x > 0 ? "底边中心（**站在地面线上的东西写 at.y = 地面线的 y**）"
    : a.y === 1 && a.x === 0 ? "左下角"
      : a.x === 0 && a.y === 0 ? "左上角"
        : `{x:${a.x}, y:${a.y}}（归一化锚点，\`at\` 是它落在的那个点）`;

export type CompileRuntimeOptions = {
  /** `run/v<N>/game-design.json` —— 理解层的收尾产物（票 10）。 */
  designPath: string;
  /** 资源包目录 —— 它**就是**模型要看的资源清单，也是校验的依据。 */
  packDir: string;
  outRoot: string;
  /**
   * 编**哪一关**。⚠️ 省略 = 设计层的第一关。
   *  ⚠️ `CONTEXT.md` 的 [[Game Config]] 钉着「**一个 game-config = 一个关卡**」，
   *  而「多个关卡怎么索引」**仍是地图上的雾** ⇒ 本票只编一关，**不假装支持多关**。
   */
  levelId?: string;
  transport?: Transport;
  fetchImpl?: typeof fetch;
  /** 外壳视口。默认 480×270（与票 32 的常量同值）。⚠️ **它是外壳的常量，不是数据** —— 由调用方传。 */
  viewport?: { w: number; h: number };
  /** 外壳画 HUD 文字的行高（票 09）。默认 [[DEFAULT_HUD_LINE_HEIGHT]] —— ⚠️ 外壳那一份由壳传进来。 */
  hudLineHeight?: number;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

/**
 * **`RuntimeProfile` ⇒ 出哪一种 config 形状**（票 14 的 Q2：(β) profile 被**读**，用途是**分派**）。
 *
 * ⚠️ **今天只有一行、恒等于常数 —— 那是预期的**（同票 05 给 `mechanics`/`capabilities` 那两个
 *   数组写的自白）：它是**给第二个成员留的位**。第二个成员落地那天，这张表才开始说话，
 *   而**拒绝**早在 `compile-design`（票 10）就发生了 —— 本步只管「哪一代 ⇒ 哪一种形状」。
 */
const CONFIG_SHAPES: Record<string, { format: string; artifactKind: string }> = {
  platformer: { format: "game-config/v1", artifactKind: "game-config" }
};

/**
 * 设计 + 这一代外壳 + 资源包 → 一份 game-config，落盘到 `<out>/<id>/game-configs/v<N>.json`。
 *
 * ⚠️ **它是 `compile-game` 的接班人**（票 14 的 Q1：(a) 取代）—— 旧的「需求 + 资源包」那道
 *   **没有了**：新链的 config 必须**从设计层长出来**（`levels[].layout`、每关的 `entities[]`、
 *   `world.structure` 都在设计层），而从需求硬猜正是 `compile-td-game` 那条
 *   「需求没说的，它们只能拿示例填」的老路。⚠️ 塔防那条**一个字不动**（R4）。
 *
 * ⚠️ **两类失败要分开**（票 14 的 Q5 裁定，人类原话：「后者不应该默认重采样，否则会把**确定性的
 *   编译/设计错误**伪装成**模型生成失败**」）：
 *     · **入参/结构不过**（线形状不过 · v3 契约不过）⇒ 那是**模型没生成好** ⇒ **重采样**，3 次用尽才抛；
 *     · **过得了契约、过不了业务校验**（引用族 · 自洽族 · 屏幕空间）⇒ 那是**确定性的编译错误** ⇒
 *       **不重采样、直接抛**，而且**不落盘**。
 *    ⚠️ 「不落盘」是**与旧行为相反**的一处：`compileGame` 当年 audit 不过也照落（理由是票 09 裁决 2
 *    「人过目」）—— 而 **R9 把人工点收成了唯一一个、且在清单处**，config 那里**已经没有读者**了
 *    ⇒ 「坏配置比没配置更坏」（旧代码自己的注释）这一条终于说了算。
 */
export async function compileRuntime(opts: CompileRuntimeOptions): Promise<CommandResult> {
  const readJson = (p: string, what: string): unknown => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { throw new CommandError("invalid", `${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  };
  const fmt = (e: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) =>
    e.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；");

  const d = GameDesignSpecSchema.safeParse(readJson(opts.designPath, "设计"));
  if (!d.success) throw new CommandError("invalid", `设计不过 schema：${fmt(d.error)}`);
  const design = d.data;

  // ── 哪一代外壳（票 14 的 Q2）────────────────────────────────────────────
  // ⚠️ 查不到 = **调用方的错**（选了一个不存在的代）—— 与票 10 的 `pickProfile` 同一条口径。
  const want = design.game.runtimeProfile;   // ⚠️ 从**设计层**读（不从入参）—— 开个入参就是给同一个事实第二个来源
  const profile = resolveRuntimeProfile(want);
  if (profile === undefined)
    throw new CommandError("invalid",
      `设计指着的那一代外壳不存在：\`${runtimeProfileRef(want)}\`（注册表里第一阶段只有 ` +
      `\`${runtimeProfileRef(PLATFORMER_V1)}\`）—— ⚠️ 拒绝**本该在** compile-design 那一步就发生（票 10）。`);
  const shape = CONFIG_SHAPES[profile.id];
  if (shape === undefined)
    throw new CommandError("invalid",
      `这一代外壳还没有对应的 config 形状：\`${runtimeProfileRef(profile)}\` —— ` +
      "⚠️ 加一个成员 = 往 `CONFIG_SHAPES` 加一行 + 一份新的 config 契约，**不是**改现有 config 的形状（票 05 Q3(b)）。");

  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：${mp.errors.slice(0, 4).join("；")}`);
  const manifest = mp.value;

  const levelId = opts.levelId ?? design.levels[0]?.id;
  const level = design.levels.find((l) => l.id === levelId);
  if (level === undefined)
    throw new CommandError("usage",
      `设计里没有这一关：\`${levelId ?? "（空）"}\`（现有：${design.levels.map((l) => l.id).join(" / ") || "无"}）`);

  // ⚠️ **查的是两个字段空不空，不是对象在不在** —— 生产里两个壳永远传一个「定义了、但 `baseUrl`
  //   可能是空串」的对象（票 06 量到的）⇒ 只查对象的话，`fetch("" + "/v1/messages")` 那一枪会被记成
  //   `failure: "http"`，**一个本地配置错被计成上游故障**。⚠️ 报错里点名那两个环境变量。
  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")
    throw new CommandError("upstream",
      "编译需要文本上游：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但配置是文件 —— 人可以直接写一份。");

  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const prompt = `你是游戏关卡设计师。把下面这一关的**设计**编译成一份 game-config（game-config/v1）——
那是**给外壳吃的菜谱**，你只填「哪里有、参数是多少」。

只调 ${CONFIG_TOOL_NAME} 工具，不要解释。

# 铁律（**每条都会被校验器检查，违反直接拒收**）

1. 顶层**只有**这八个键：format / world / scene / player / terrain / entities / hud / objective。多一个就拒。
2. \`format\` 恒为 \`"game-config/v1"\`。坐标一律**非负整数** —— \`x: 10.5\` 会静默糊掉像素网格，直接拒。
3. ⚠️ **\`at\` 是「资源锚点落在的那个点」，不是左上角。** 本包的锚点含义见下面每条清单。
   最要命的一条：**底边中心的资源（角色、道具、危险物），站在地面线上的写法是 \`at.y = 地面线的 y\`**，
   **不是** \`地面线 − 高\`。写成后者，整个世界的道具都会浮在半空。
4. \`world.size.h\` **必须等于视口高 ${vp.h}**（这个游戏单屏高，只横向滚动；视口是 ${vp.w}×${vp.h}）。
   \`world.size.w\` 自己定（横向滚多远）。
5. \`kind\` ∈ \`solid\` / \`pickup\` / \`hazard\` / \`goal\` / \`decor\`。
   **看得见的静态碰撞体（行李堆、台阶）写 \`solid\` 实体**；\`terrain\` 只放**看不见的**碰撞
   （地面线、关卡边界、隐形墙）。
6. \`objective\` **不带数量**：\`{"kind":"collect-then-reach","gate":"<某个 goal 实体的 id>"}\`。
   要捡几件由 \`kind:"pickup"\` 的实体条数**派生** —— 多写一个数就拒。
7. \`gate\` 必须指向一个**真的存在**且 \`kind:"goal"\` 的实体；实体 id **不得重复**；**至少要有 1 个 pickup**。
8. ⚠️ **\`hud\` 的坐标是屏幕空间（≤ ${vp.w}×${vp.h}），不是世界空间。**
   世界可以宽 1440，但屏幕只有 ${vp.w} 宽 —— HUD 写到 x > ${vp.w - 72} 就跑出屏幕了，直接拒。
9. \`anim\` 只在资源有**多个**动画时才需要，且必须是清单里**真实存在**的动画名。
   ⚠️ **只许用下面清单里的 id 与动画名** —— 清单里没有的一律拒收。

# 你在给哪一代外壳编
\`${runtimeProfileRef(profile)}\` —— 它**只实现了上面那套行为原语**，别写它做不了的东西（写了也跑不动）。

# 这一关的设计（GameDesignSpec）
⚠️ **照它摆**：\`world.structure\` 说的是**空间怎么分层**（几条横带、前景中景背景），
而这一关的 \`layout\` 说的是**从哪儿走到哪儿、路上有什么** —— 别自己发明一套布局。
${designBrief(design)}

# 资源包清单（**只许用这里面的东西**）
${resourceBrief(manifest)}

# 锚点的意思（照这个摆）
${[...new Set(manifest.assets.map((a) => `${a.kind}：${anchorHint(a.anchor)}`))].join(" · ")}

# 形状（**逐字照抄这个骨架**；\`<…>\` 是占位符，换成清单里真实的 id 与动画名）
${JSON.stringify(gameConfigExample, null, 2)}

⚠️ 骨架里的**位置只是示意**（都摆在地面线上）—— 按这一关的设计把东西铺开，并让它真的可通关：
玩家能跳的高度是有限的，台阶别高过它。`;

  // ⚠️ **账**：一格 = 一次调用（`STRUCTURED_CALL_ATTEMPTS` 次往返都记在里面）。
  const call = spentCall("compile-runtime", "game-config");
  let checked: ReturnType<typeof parseGameConfig> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThroughTool({
      transport: opts.transport, body: JSON.stringify({
        // ⚠️ 与 `callText` 同源（票 24 的实况：代理**请求一个、回另一个**）。
        model: "deepseek-v4-pro", max_tokens: 16_000, thinking: { type: "disabled" },
        ...forcedTool(CONFIG_TOOL_NAME, CONFIG_TOOL_DESCRIPTION, ConfigToolSchema),
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
      }),
      tool: CONFIG_TOOL_NAME, schema: ConfigToolSchema,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {})
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
    }
    if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
    if (once.kind === "bad") { call.trip({ failure: once.failure, spent: once.spent }); lastError = once.detail; continue; }
    // ⚠️ **线形状过了不算数**：真正的判据是 v3 那份契约（实体 id 不重复那条 refine 住在它里面）。
    const truth = parseGameConfig(once.result.value);
    if (!truth.ok) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = `配置不过契约：${truth.errors.slice(0, 4).join("；")}`;
      continue;
    }
    call.trip({ spent: once.spent });
    checked = truth;
    break;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));

  const config = checked.value;

  // ── ⚠️ **业务校验：确定性失败，不重采样、不落盘**（票 14 的 Q5 裁定）────────────
  //
  // ⚠️ 这里跑的是 `site` 要跑的同一批校验（**减去第四族** —— 几何族要世界描述与视口常量，
  //   而它们住 `demo`；见 `ops.ts` 里塔防那一段的注释）。**同一份实现，不抄第二份**。
  const issues: ConfigIssue[] = [
    ...auditGameConfig(config, manifest),
    ...auditScreenSpace(vp, gameHudScreenItems(config, manifest,
      { lineHeight: opts.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT }))
  ];
  const hard = issues.filter((i) => i.severity === "error");
  if (hard.length > 0)
    throw new CommandError("invalid",
      `编译出来的配置**过不了校验**（${hard.length} 条硬失败）：\n` +
      hard.slice(0, 6).map((i) => `  · ${i.where}: ${i.message}`).join("\n") +
      "\n⚠️ **这不是模型没生成好** —— 一份过得了契约、过不了业务校验的配置，说明是**这份设计配这个包**" +
      "做不出合法的关卡（引用解不到 / 东西摆在世界外 / HUD 跑出屏幕）⇒ **不重采样、也不落盘**：" +
      "重抽一次改不了这些事实，而落一份坏配置比不落更坏。\n" +
      "   要去的地方：设计层或资源清单（不是再抽一次）。",
      ledgerCarrying(call.record()));

  const dir = path.join(opts.outRoot, manifest.id, "game-configs");
  fs.mkdirSync(dir, { recursive: true });
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  const pickups = config.entities.filter((e) => e.kind === "pickup").length;
  return {
    command: "compile-runtime",
    summary: [
      `配置已落盘：${rel(opts.outRoot, file)}（v${version}）`,
      `${config.entities.length} 个实体 · ${pickups} 个拾取物 · 世界 ${config.world.size.w}×${config.world.size.h}` +
        ` · 这一关 \`${level.id}\` · 外壳 \`${runtimeProfileRef(profile)}\``,
      `✅ 校验全过${issues.length ? `（${issues.length} 条警告）` : ""} —— 下一步：game-maker site ${rel(opts.outRoot, opts.packDir)} --config ${rel(opts.outRoot, file)}`,
      ...issues.map((i) => `⚠️ ${i.where}: ${i.message}`)
    ],
    data: {
      gameId: manifest.id, levelId: level.id, version, configPath: rel(opts.outRoot, file),
      entityCount: config.entities.length, pickupCount: pickups,
      worldSize: config.world.size, issues: issues.map((i) => `⚠️ ${i.where}: ${i.message}`),
      ok: true, ledger: asLedger(call.record())
    },
    artifacts: [{ path: rel(opts.outRoot, file), kind: shape.artifactKind }]
  };
}

// ── 塔防关卡编译（施工单第 1 条）──────────────────────────────────────────────

/**
 * 给模型看的**塔防关卡骨架**。
 *
 * ⚠️ **它必须是能过 `parseTdConfig` 的** —— 导出它是为了让测试能直接断言这件事
 *   （与 `gameConfigExample` 同一条规矩：**示例错了，模型就会以「看起来没问题」的方式错**）。
 * ⚠️ 资源 id 一律写**占位符**，否则示例会把某一关的 id 焊进提示词。
 * ⚠️ 而它里面那张 **18 行 × 32 字符的地图是这一段最值钱的部分** ——
 *   逐字给出「一行多长、五个字符怎么摆、走道怎么连成一条」，比任何文字描述都准。
 * ⚠️ **它里面没有 `path` 那一块**（票 12）：路径由工具从地图派生，模型不写它。
 *   这也正是这个骨架必须**照实**的原因 —— 示例里留一块不该写的东西，模型就会照写。
 * ⚠️ 而那张地图的走道**必须自己就是一条单线**（票 12 的「走道不许分叉」）——
 *   示例错了，模型就会以「看起来没问题」的方式错（票 40 的教训）。第 5 行原本
 *   在最左端还留了五个走道格，于是 `(6,4)` 成了一个 T 字口 ⇒ **已收回去**。
 *   （⚠️ 它是**行格式的演示**，不是一张可以拿来用的地图 —— 提示词里明说了这条。）
 */
export const tdConfigExample = {
  format: "td-config/v1",
  world: { size: { w: 480, h: 270 } },
  arena: {
    cell: 15,
    walkChar: ":",
    tiles: {
      "#": { asset: "<墙砖的 id>" }, ".": { asset: "<地面砖的 id>" },
      "=": { asset: "<货架砖的 id>" }, ":": { asset: "<走道砖的 id>" },
      "+": { asset: "<卷帘门的 id>" },
    },
    rows: [
      "################################",
      "################################",
      "#..............................#",
      "#..==========================..#",
      "#.....:::::::::::::::::::::::::+",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:.======================.#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#::::::........................#",
      "#..............................#",
      "#..............................#",
      "#..==========================..#",
      "#..............................#",
      "#..............................#",
    ],
  },
  scene: { slot: { asset: "<插槽的 id>" }, slotActive: { asset: "<高亮框的 id>" } },
  // ⚠️ **没有 `path` 这一块** —— 路径由工具从你画的地图**派生**（票 12），你不用写它。
  core: { asset: "<柜台的 id>" },
  slots: [
    { id: "s1", at: { x: 187, y: 112 } }, { id: "s2", at: { x: 277, y: 112 } },
    { id: "s3", at: { x: 157, y: 202 } }, { id: "s4", at: { x: 262, y: 202 } },
  ],
  towers: [
    { id: "<机关 id>", name: "<显示名>", asset: "<机关的 id>", attack: "single", targeting: "first",
      cost: 40, upgradeCost: 60,
      levels: [{ range: 56, damage: 5, fireMs: 480 }, { range: 68, damage: 9, fireMs: 380 }],
      projectile: { asset: "<抛射物的 id>", speed: 220 } },
    { id: "<范围机关的 id>", name: "<显示名>", asset: "<范围机关的 id>", attack: "aoe", targeting: "first",
      cost: 60, upgradeCost: 90,
      levels: [
        { range: 40, damage: 3, fireMs: 900, slow: { factor: 0.6, ms: 1200 } },
        { range: 52, damage: 5, fireMs: 800, slow: { factor: 0.45, ms: 1600 } },
      ],
      fx: { asset: "<放电特效的 id>", anim: "<动画名>" } },
  ],
  enemies: [
    { id: "<敌人 id>", name: "<显示名>", asset: "<敌人的 id>", anim: "<动画名>",
      hp: 20, speed: 40, bounty: 6, armor: 0, leakCost: 1 },
  ],
  waves: [
    { groups: [{ enemy: "<敌人 id>", count: 6, gapMs: 800, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 8, gapMs: 700, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 10, gapMs: 700, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 12, gapMs: 600, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 14, gapMs: 600, delayMs: 0 }] },
  ],
  economy: { startScrap: 120, lives: 20, waveBonus: 35 },
  hud: {
    panel: { asset: "<顶栏的 id>", at: { x: 0, y: 0 }, size: { w: 480, h: 30 } },
    readout: { at: { x: 22, y: 5 }, step: { x: 0, y: 10 } },
    icons: {
      scrap: { asset: "<废料图标的 id>", at: { x: 8, y: 6 } },
      life: { asset: "<声望图标的 id>", at: { x: 8, y: 16 } },
    },
    buttons: { asset: "<按钮底板的 id>", at: { x: 300, y: 4 }, size: { w: 44, h: 22 }, step: { x: 48, y: 0 } },
    start: { asset: "<按钮底板的 id>", at: { x: 444, y: 4 }, size: { w: 28, h: 22 } },
  },
} as const;

/**
 * 资源包清单 —— `resourceBrief` 的塔防版。
 *
 * ⚠️ 带上 `role`（模型靠它认出「**哪个是砖**」）、**锚点**与**尺寸**。
 *   ⚠️ 锚点那一项是补上的：第一版只写了 kind/size/role/animation，把锚点**悄悄丢了** ——
 *   而那正是「两份实现必然漂」的样子（横版那份是带锚点的）。
 *   塔防这边尤其不能丢：**砖的锚点必须正中**（票 07），而模型得看得到它才能照做。
 */
function tdResourceBrief(m: AssetPackManifest): string {
  return m.assets.map((a) => {
    const anim = a.animations?.length ? `动画：${a.animations.map((x) => `${x.name}(${x.frames.length} 帧)`).join(" · ")}` : "（无动画）";
    const layers = a.layers?.length ? ` · 背景层（远→近）：${a.layers.map((l) => l.name).join(" → ")}` : "";
    return `- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · 锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · ${a.role} · ${anim}${layers}`;
  }).join("\n");
}

export type CompileTdGameOptions = {
  requirementPath: string;
  /** 资源包目录 —— 它**就是**模型要看的资源清单，也是校验的依据。 */
  packDir: string;
  outRoot: string;
  transport?: Transport;
  fetchImpl?: typeof fetch;
  /** 外壳视口。默认 480×270。 */
  viewport?: { w: number; h: number };
  /** 外壳画 HUD 文字的行高（票 09）。默认 [[DEFAULT_HUD_LINE_HEIGHT]]。 */
  hudLineHeight?: number;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]]。 */
  timeoutMs?: number;
  /**
   * 最多试几次。默认 **3**（不是 2 —— **校验不过也重采样**，而真跑量下来一次就过的概率只有 ~1/4）。
   * ⚠️ 每一次都是**一笔上游调用**，调小它就是省钱。
   */
  attempts?: number;
};

/**
 * 需求 + 资源包 → 一份 td-config，落盘到 `<out>/<id>/td-configs/v<N>.json`。
 *
 * ⚠️ **它跑的是「三族（契约层）+ 屏幕空间」**，与 `compileGame` 同一个口径 ——
 *   **几何族与「这一关通不通」跑不了**：那两族要的是世界描述与模拟器，而它们住在 `demo`
 *   （`assets → contracts` 是依赖图上写死的）。⇒ 那两族落在 `site`（票 11 定的）。
 *
 * ⚠️ **不过校验也照常落盘**（票 06/09 那条裁决）：**「人过目」的前提是他看得到哪儿不对**；
 *   不落盘他连看的东西都没有。退出码仍由回报里的 `ok` 决定。
 */
export async function compileTdGame(opts: CompileTdGameOptions): Promise<CommandResult> {
  const requirement = fs.readFileSync(opts.requirementPath, "utf8");
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：${mp.errors.slice(0, 4).join("；")}`);
  const manifest = mp.value;
  if (!opts.transport) throw new CommandError("upstream", "编译需要文本上游；它现在不可达（配置是文件，人可以直接写一份）");

  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const prompt = tdConfigPrompt(requirement, tdResourceBrief(manifest), tdConfigExample);

  // ⚠️ **校验（三族 + 屏幕空间）**抽成一个内部函数 —— 循环里要用它决定**要不要重采样**。
  const auditOf = (c: TdConfig): string[] => {
    const out: string[] = [];
    for (const i of auditTdConfig(c, manifest))
      out.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);
    for (const i of auditScreenSpace(vp, tdHudScreenItems(c, manifest, { lineHeight: opts.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT })))
      out.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);
    return out;
  };

  // ⚠️ **重采样，不是修复循环**（不把错误喂回去 —— R2 把「自我修复闭环」整体判过出局）。
  //   而它要重采样的**不只有 schema 失败**：真跑量下来（20 次上游调用），模型一次就产出
  //   可用关卡的只有 **~1/4**，失败几乎全在「路径坐标 vs 地图上画成走道的格」那一族
  //   （那一族已由 `fromMap` 删掉；数字见 `docs/td-requirement.md` 与票 12）。
  //   ⇒ **硬失败也重采样**。⚠️ 每一次都是**一笔上游调用**，所以次数是参数（默认 3）。
  //
  //
  // ⚠️ **一格 = 一次调用**（`CONTEXT.md` 的「调用 / 往返」）。这里**以前每一轮把那唯一一格
  //   覆盖写**、只把往返次数堆在 `attempts` 上 —— 于是账上只留得下**最后一次**为什么失败，
  //   而「发了 3 次、前两次被截断、第三次坏 schema」与「一次就坏 schema」长得一模一样。
  //   现在由 `spentCall` 累加：`attempts` 照旧（重试烧了多少），`failures` 把每次的原因留下。
  const attempts = opts.attempts ?? 3;
  let picked: TdConfig | null = null;      // 过了校验的那一份
  let fallback: TdConfig | null = null;    // 最后一份过了 schema 的（校验可能不过）
  let issues: string[] = [];
  let lastError = "";
  const call = spentCall("compile-td-game", "td-config");
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const once = await onceThrough({
        transport: opts.transport, prompt, what: "编译出来的关卡", parse: parseTdConfig,
        ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      });
      call.trip(once.kind === "ok" ? { spent: once.spent }
        : once.kind === "not-sent" ? {}
        : once.kind === "upstream" ? { failure: once.failure }
        : { failure: once.failure, spent: once.spent });
      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
      if (once.kind === "upstream") throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
      // ⚠️ **`bad` 记的是「这一趟上游没交出可用的东西」**；而下面「过不了校验」是**这一份关卡**
      //   的问题、不是上游的问题 —— 那一趟的 `failures` 上**不留东西**。要分开，
      //   否则「上游不稳」会被「模型设计得差」冒充成同一个数（这正是票 27 要病因的原因）。
      if (once.kind === "bad") { lastError = once.detail; continue; }
      const p = once.result;
      // ⚠️ **补全**：模型**不写** `path.points`（票 12）—— 从它画的那张地图**派生**出来填上。
      //   于是产物里路径还在、下游一无所知，而「路径与地图对不上」那一族失败**结构上不可能**。
      //   ⚠️ `fromMap` 才是那句「结构上不可能」的**全部**分量：它**不看模型写没写**、一律派生。
      //   只写一句「请不要写 path」是不够的（票 12 量过：「把话说硬」上限很低）——
      //   模型真写了、而这份代码又尊重它，那一族失败就原封不动地回来了。
      const resolved = tdResolveConfig(p.value, { fromMap: true });
      // ⚠️ **派生不出来也是「坏关卡」的一种，照常落盘**（与校验不过**同一条**裁决 —— 票 06/09：
      //   人过目的前提是他看得到哪儿不对）。落盘的是**没有 `path` 的那一份** ——
      //   它就是模型交出来的原文（而它**过得了 schema**），`site` 会在那里再说一遍同一句话。
      //   ⚠️ 原来这里写的是 `continue` ⇒ 三次重采样全撞上它时**抛异常、一个字节都不落** ——
      //   于是**模型的产出连同一笔已经花掉的调用一起丢了**，而它的失败其实说得清。
      const got = resolved.ok
        ? auditOf(resolved.value)
        : [`❌ arena: 从场地派生不出路径：${resolved.error}`];
      fallback = resolved.ok ? resolved.value : p.value;
      issues = got;
      if (resolved.ok && !got.some((i) => i.startsWith("❌"))) { picked = resolved.value; break; }
      lastError = `编译出来的关卡过不了校验（${got.filter((i) => i.startsWith("❌")).length} 条）：` +
        got.find((i) => i.startsWith("❌"))!.replace(/^❌ /, "");
    }
  } catch (e) {
    // ⚠️ **失败时已经花掉的那几笔跟着异常一起走**（票 46 的纪律）—— 包没产出来，它们没有别的家。
    // ⚠️ `onceThrough` 自己产出的 `CommandError` 已经带着账了，**原样放行**，别再包一层。
    if (e instanceof CommandError) throw e;
    throw new CommandError("upstream", (e as Error).message, ledgerCarrying(call.record()));
  }
  // ⚠️ **一次都没过 schema** —— 那才是真的没东西可落盘。
  if (!fallback) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));
  // ⚠️ **不过校验也照常落盘**（票 06/09 那条裁决）：**人过目的前提是他看得到哪儿不对**。
  //   重采样全失败了也一样 —— 落**最后那一份**，并把问题报出来。
  const config = picked ?? fallback;

  const dir = path.join(opts.outRoot, manifest.id, "td-configs");
  fs.mkdirSync(dir, { recursive: true });
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  const bad = issues.filter((i) => i.startsWith("❌"));
  return {
    command: "compile-td-game",
    summary: [
      `关卡已落盘：${rel(opts.outRoot, file)}（v${version}）`,
      `${config.waves.length} 波 · ${config.towers.length} 种机关 · ${config.enemies.length} 种敌人 · ${config.slots.length} 个插槽`,
      ...(bad.length === 0
        ? ["✅ 校验全过（三族 + 屏幕空间）—— 下一步：game-maker site …（几何族与「这一关通不通」判在那一步）"]
        : [`❌ **这份关卡过不了校验**（${bad.length} 条）—— 改完再 \`site\`：`, ...bad.map((b) => `  ${b}`)]),
    ],
    data: {
      gameId: manifest.id, version, configPath: rel(opts.outRoot, file),
      waveCount: config.waves.length, towerCount: config.towers.length,
      slotCount: config.slots.length, issues, ok: bad.length === 0,
      ledger: asLedger(call.record()),
    },
    artifacts: [{ path: rel(opts.outRoot, file), kind: "td-config" }],
  };
}

// ── pack：清单 → 资源包 ─────────────────────────────────────────────────────
export type PackOptions = {
  recipePath: string; outRoot: string; transport: Transport;
  /** 生图上游。清单里有 `kind:"image"` 的资源时必填 —— 缺了就是**用法错**（2），不是上游错。 */
  imageTransport?: ImageTransport;
  fetchImpl?: typeof fetch;
  onProgress?: (done: number, total: number, assetId: string) => void;
  /**
   * 并发上限（票 47）。**按上游分别定** —— 限流是上游的属性。
   * 不给就用 `DEFAULT_CONCURRENCY`；设 1 就是旧的串行行为。
   */
  concurrency?: { text?: number; image?: number };
};

/**
 * 按 `protocol` 造出生图端口。**只有实测跑通过的那种才实现** ——
 * 剩下的显式抛「没实现」，而不是猜一个形状发出去（krill 那种「长得像 OpenAI 但什么都不实现」
 * 的中转真实存在，猜形状的代价是花着钱拿到一个 200/0 字节）。
 */
function imageGeneratorFor(t: ImageTransport, fetchImpl?: typeof fetch): ImageGenerator {
  // ⚠️ 有代理就必须自己走 —— Node 原生 fetch **不认 HTTPS_PROXY**（实测），
  // 而 api.openai.com / Google 这类上游在境内直连不通。不接这一句的后果是
  // 一个不含任何线索的「fetch failed」。
  const doFetch = fetchImpl ?? (t.proxy ? createProxyFetch({ proxy: t.proxy }) : undefined);
  const common = { baseUrl: t.baseUrl, apiKey: t.apiKey, ...(doFetch ? { fetchImpl: doFetch } : {}) };
  switch (t.protocol) {
    case "dashscope-mcp": return createDashScopeMcpGenerator(common);
    case "gemini": return createGeminiGenerator({ ...common, ...(t.model ? { model: t.model } : {}) });
    // ⚠️ `minimax` 仍然没写。它不是 "openai 换个 baseUrl" —— Minimax 的
    // `/v1/image_generation` 是另一个形状（`image_urls`、`aspect_ratio`、回的是 url）。
    // 没实测过就不猜。
    case "openai": return createOpenAIGenerator({ ...common, ...(t.model ? { model: t.model } : {}) });
    case "minimax":
      throw new CommandError("usage", `生图协议 "${t.protocol}" 的客户端**还没写**（已有的是 dashscope-mcp / gemini / openai）。不要猜形状 —— 猜错了就是花着钱拿到一个空回应。`);
  }
}

export async function packAssets(opts: PackOptions): Promise<CommandResult> {
  const recipe = JSON.parse(fs.readFileSync(opts.recipePath, "utf8"));
  const r = parseRecipe(recipe);
  if (!r.ok) throw new CommandError("invalid", `清单不过 schema：${r.errors.slice(0, 4).join("；")}`);
  const styleAbs = path.resolve(path.dirname(opts.recipePath), r.value.styleRef);
  const style = JSON.parse(fs.readFileSync(styleAbs, "utf8")) as StyleSpec;

  const needsImage = r.value.assets.some((a) => a.source.kind === "image");
  if (needsImage && !opts.imageTransport)
    throw new CommandError("usage",
      `这份清单里有 source.kind="image" 的资源，但**没配生图凭据** —— ` +
      `写 game-maker.local.json（已 gitignore）或设 GAME_MAKER_IMAGE_* 环境变量。`);

  // ⚠️ 这个数组是**调用方与构建器共用**的：文本那一路由生成器直接记进来
  //   （`createDrawListGenerator({ onCall })`），生图那一路由 `buildAssetPack` 追加。
  //   ⚠️ 而它在这里**就存在了**，所以中途失败时已经花掉的那几笔还在 —— 那是票 46 的地基。
  const ledger: LedgerCall[] = [];
  let res;
  try {
    res = await buildAssetPack({
      recipe: r.value, style, outDir: opts.outRoot,
      // `source.ref` 相对**配方文件**解析（契约 `InputPath` 定的规则，与 `styleRef` 一致）
      recipeDir: path.dirname(path.resolve(opts.recipePath)),
      generate: createDrawListGenerator({
        baseUrl: opts.transport.baseUrl, apiKey: opts.transport.apiKey,
        onCall: (c) => ledger.push(c),
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      }),
      ledger,
      ...(opts.imageTransport
        ? { generateImage: imageGeneratorFor(opts.imageTransport, opts.fetchImpl) }
        : {}),
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      ...(opts.concurrency ? { concurrency: opts.concurrency } : {}),
    });
  } catch (e) {
    // ⚠️ 生成失败**就是**「上游不可达」（3），不是「失败」（1）。
    // 拆掉降级链之前这条分支不会发生 —— 上游死活都被兜底吸收，pack 永远成功。
    // ⚠️ **失败时账没有别的地方可去**（票 46）：包没产出来，所以没有 `ledger.json` 可写。
    //   而**已经花掉的那几笔是事实** —— 它们跟着异常走，两个壳各自渲染。
    //   ⚠️ 这个数组在 `buildAssetPack` **调用之前**就存在了，所以它活过了这次抛出；
    //   而票 47 的「失败即止」保证它只含**真的发出去过**的调用（没发的不算）。
    // ⚠️ **失败现场**（票 01）：`buildAssetPack` 已经把工作目录改名留下了，
    //   路径挂在异常上 —— 与账**同一处**搬进 `CommandError`（两个壳各自渲染）。
    const failureDir = (e as FailureSite).failureDir;
    const carried = {
      ...(ledger.length > 0 ? { ledger } : {}),
      ...(failureDir !== undefined ? { failureDir } : {}),
    };
    if (e instanceof GenerationError || e instanceof ImageGenerationError)
      throw new CommandError("upstream", e.message, carried);
    if (e instanceof CommandError) throw new CommandError(e.kind, e.message, carried);
    throw e;
  }
  const m = res.manifest;
  return {
    command: "pack",
    summary: [`资源包：${rel(opts.outRoot, res.packDir)}（v${m.version}）`,
      `${m.assets.length} 个资源 · ${m.atlases.length} 张图集 · ${m.files.length} 个文件`,
      `来源：${m.provenance.mode}`,
      // ⚠️ **墙钟与调用耗时之和是两个数**（票 19）—— 串行时恰好相等，并行之后就不再相等。
      //   两个都报出来，差就是并行的收益。
      (() => {
        const s = summarizeCalls(ledger);
        const calls = ledger.length;
        if (calls === 0) return "账：无调用";
        // ⚠️ `?? 0` 在这里是**跳过**（`ms` 缺席 = 还没回来），不是「把没测到的当 0」
        const ms = ledger.reduce((n, c) => n + (c.ms ?? 0), 0);
        const trips = ledger.reduce((n, c) => n + c.attempts, 0);
        const wall = res.ledger ? `墙钟 ${(res.ledger.run.wallClockMs / 1000).toFixed(1)}s · ` : "";
        return `账：${calls} 次调用 · ${trips} 次往返（${trips > calls ? "**有重试**" : "无重试"}）· ` +
          `${wall}调用耗时合计 ${(ms / 1000).toFixed(1)}s · 见包内 ledger.json`;
      })(),
      ...(res.imageCalls.length > 0
        ? [`生图：${res.imageCalls.length} 次调用 · ${res.imageCalls.map((c) => c.assetId).join(" ")}`]
        : [])],
    data: {
      packId: m.id, version: m.version,
      ...(res.imageCalls.length > 0
        ? { imageCalls: res.imageCalls, imageUpstream: describeImageTransport(opts.imageTransport) }
        : {}),
      ledgerCalls: ledger, ledgerRun: summarizeCalls(ledger),
      assetCount: m.assets.length, fileCount: m.files.length,
      provenanceMode: m.provenance.mode, paletteCoverage: m.palette.coverage,
    },
    artifacts: [{ path: rel(opts.outRoot, res.packDir), kind: "asset-pack" }],
  };
}

// ── verify：校验一个已有资源包 ───────────────────────────────────────────────
export type VerifyOptions = { packDir: string; outRoot?: string };

/** 校验一个包：schema + **逐文件 checksum** + spec↔产物对账。 */
export function verifyPack(opts: VerifyOptions): CommandResult {
  const root = opts.outRoot ?? path.dirname(path.resolve(opts.packDir));
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const parsed = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!parsed.ok) throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  const m = parsed.value;

  const problems: string[] = [];
  // ⚠️ checksum 存在的意义**就是**能被校验 —— 只存着不校验，它等于没有（票 18）。
  for (const f of m.files) {
    const abs = path.join(opts.packDir, f.path);
    if (!fs.existsSync(abs)) { problems.push(`缺文件：${f.path}`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.length !== f.bytes) problems.push(`大小不符：${f.path}（记 ${f.bytes}，实际 ${buf.length}）`);
    const sum = "sha256:" + createHash("sha256").update(buf).digest("hex");
    if (sum !== f.checksum) problems.push(`checksum 不符：${f.path}`);
  }
  // ⚠️ **账（包里如果有）也要过 schema** —— 它已经在 `files[]` 里，所以上面那段已经验过
  //   「没被改过」；但 checksum **只证明它没被改**，不证明它**是一份合法的账**。
  //   ⚠️ **没有不算错** —— 磁盘上已有的包（票 40 那份）不带它，必须照常通过。
  const ledgerPath = path.join(opts.packDir, "ledger.json");
  const hasLedger = fs.existsSync(ledgerPath);
  let ledgerRun: ReturnType<typeof summarizeCalls> | null = null;
  if (hasLedger) {
    const l = parseLedger(JSON.parse(fs.readFileSync(ledgerPath, "utf8")));
    if (!l.ok) problems.push(...l.errors.map((e) => `ledger.json 不过 schema：${e}`));
    else if (l.value.packId !== m.id || l.value.packVersion !== m.version)
      problems.push(`账与包对不上：ledger.json 说自己是 "${l.value.packId}" v${l.value.packVersion}，而 manifest 是 "${m.id}" v${m.version}`);
    else ledgerRun = l.value.run.byStep;
  }

  const onDisk = walk(opts.packDir).filter((p) => p !== "manifest.json").sort();
  const declared = m.files.map((f) => f.path);
  for (const p of onDisk) if (!declared.includes(p)) problems.push(`files[] 没记录的文件：${p}`);

  // ⚠️ **校验不过是失败**（退出码 4），不是某种「可用的降级产物」。
  if (problems.length > 0) throw new CommandError("invalid", `校验不过（${problems.length} 处）：${problems.slice(0, 6).join("；")}`);

  return {
    command: "verify",
    summary: [`✅ ${rel(root, opts.packDir)} 通过：${m.files.length} 个文件的 checksum 全部对得上`,
      `来源：${m.provenance.mode}`,
      ...(ledgerRun
        ? [`账：${Object.values(ledgerRun).reduce((n, v) => n + (v?.calls ?? 0), 0)} 次调用被记在包内 ledger.json 里`]
        : ["账：这个包没有 ledger.json（**不是错** —— 票 45 之前产的包都没有）"])],
    data: { packId: m.id, version: m.version, ok: true, problems: [], provenanceMode: m.provenance.mode },
    artifacts: [],
  };
}

const walk = (dir: string, base = ""): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));

// ── inspect：包里有什么 ─────────────────────────────────────────────────────
/**
 * 交付态到底把色板用成了什么样 —— **确定性、可扫**（票 15 发现，票 39 定它是**观察**）。
 *
 * ⚠️ **它是观察，不是判据**（票 39）。读法定了「`palette` 是**绘制词汇**」之后，
 *   「某个色没人用」「重音色占比低」都**不是缺陷** —— 词汇表里的词不必每句都用上，
 *   而一个黄昏世界的最暗色占大头可能正是对的。所以这里**只报数**，不打分、不阻断。
 *   ⚠️ 这也是为什么它不该留在 `out/`（gitignore）里当一次性脚本 —— 人眼判
 *   「像不像同一个视觉世界」时，手上多这组数比没有强。
 */
function paletteUsage(packDir: string, m: AssetPackManifest) {
  const hex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  const perColor = m.palette.values.map((c) => ({ color: c, pixels: 0, assets: [] as string[] }));
  const atlasCache = new Map<string, ReturnType<typeof decodePNG>>();
  const perAsset: { id: string; usedColors: number; opacityPixels: number; top: { color: string; share: number }[] }[] = [];

  for (const a of m.assets) {
    const atlas = m.atlases.find((x) => x.id === a.atlasId);
    if (!atlas) continue;
    const aj = JSON.parse(fs.readFileSync(path.join(packDir, atlas.meta), "utf8")) as
      { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
    let img = atlasCache.get(atlas.id);
    if (!img) { img = decodePNG(fs.readFileSync(path.join(packDir, atlas.image))); atlasCache.set(atlas.id, img); }
    const count = new Array(m.palette.values.length).fill(0);
    let opaque = 0;
    for (const f of a.frames) {
      const fr = aj.frames[f.name];
      if (!fr) continue;
      for (let y = 0; y < fr.frame.h; y++) for (let x = 0; x < fr.frame.w; x++) {
        const o = ((fr.frame.y + y) * img.width + fr.frame.x + x) * 4;
        if (img.data[o + 3] === 0) continue;
        opaque++;
        const i = m.palette.values.indexOf(hex(img.data[o]!, img.data[o + 1]!, img.data[o + 2]!));
        if (i >= 0) { count[i]++; perColor[i]!.pixels++; }
      }
    }
    const used = count.filter((c) => c > 0).length;
    for (const [i, c] of count.entries()) if (c > 0) perColor[i]!.assets.push(a.id);
    perAsset.push({
      id: a.id, usedColors: used, opacityPixels: opaque,
      top: count.map((c, i) => ({ color: m.palette.values[i]!, share: opaque === 0 ? 0 : c / opaque }))
        .sort((x, y) => y.share - x.share).slice(0, 3).filter((x) => x.share > 0),
    });
  }
  const total = perColor.reduce((n, c) => n + c.pixels, 0);
  return {
    perAsset,
    perColor: perColor.map((c) => ({ color: c.color, assets: c.assets.length, share: total === 0 ? 0 : c.pixels / total })),
    totalPixels: total,
  };
}

export function inspectPack(opts: { packDir: string; outRoot?: string }): CommandResult {
  const root = opts.outRoot ?? path.dirname(path.resolve(opts.packDir));
  const parsed = parseAssetPack(JSON.parse(fs.readFileSync(path.join(opts.packDir, "manifest.json"), "utf8")));
  if (!parsed.ok) throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  const m = parsed.value;
  // ⚠️ 扫交付态图集要**解 PNG** —— 这是 `inspect` 唯一的重活，而它是诊断命令，值。
  const usage = paletteUsage(opts.packDir, m);
  const byId = new Map(usage.perAsset.map((u) => [u.id, u]));

  const lines = [`${m.id} v${m.version} · ${m.provenance.mode}`, `${m.assets.length} 个资源 · ${m.atlases.length} 张图集`];
  for (const a of m.assets) {
    const anim = a.animations?.length ? ` · 动画 ${a.animations.map((x) => `${x.name}(${x.frames.length})`).join(" ")}` : "";
    const u = byId.get(a.id);
    const uses = u ? ` · 用色 ${u.usedColors}/${m.palette.values.length}` : "";
    lines.push(`  ${a.id} · ${a.kind} · ${a.size.w}×${a.size.h} · ${a.origin}/${a.paletteBinding} · ${a.frames.length} 帧${anim}${uses}`);
  }
  // ⚠️ 这一块是**观察**不是判据（票 39）—— 不打分、不阻断，只是把人眼判「像不像同一个世界」时要看的事实摆出来
  // 每一层背景画得有多满（票 50）—— ⚠️ 这个量**是判据**（层覆盖），但它**判在 QA 那边**
  //   （票 06 Q12）：这里是**诊断命令**，只报数、**不判**。**同一个 helper**，不另算一份。
  const bg = backgroundCoverage(opts.packDir, m);
  if (bg.length > 0) {
    lines.push(`背景层：整帧有多少像素是真画了东西的（**只报数** —— 层覆盖是一条判据，判决在 QA 那边）：`);
    for (const c of bg)
      lines.push(`  ${c.frame.padEnd(24)} ${c.w}×${c.h}  ${(100 * c.ratio).toFixed(1)}%`);
  }
  lines.push(`色板 ${m.palette.values.length} 色 · 交付态实际用到的像素分布（**观察，不是判据**）：`);
  for (const c of usage.perColor)
    lines.push(`  ${c.color} · ${c.assets}/${m.assets.length} 个资源用到 · 占全部不透明像素 ${(100 * c.share).toFixed(1)}%`);

  return {
    command: "inspect", summary: lines,
    data: {
      packId: m.id, version: m.version, provenanceMode: m.provenance.mode,
      assets: m.assets.map((a) => ({ id: a.id, kind: a.kind, size: a.size, origin: a.origin,
        paletteBinding: a.paletteBinding, frames: a.frames.length,
        animations: (a.animations ?? []).map((x) => ({ name: x.name, frames: x.frames.length, fps: x.fps ?? null, loop: x.loop })) })),
      paletteUsage: usage, layerCoverage: backgroundCoverage(opts.packDir, m),
    },
    artifacts: [{ path: rel(root, opts.packDir), kind: "asset-pack" }],
  };
}

export type { AssetPackManifest };
export { createDrawListGenerator, assetTask, drawListFewShot, drawListOpsSpec, paletteLine };
