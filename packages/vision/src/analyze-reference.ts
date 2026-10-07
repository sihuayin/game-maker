// 票 08 的落点：**参考图 + 需求文本 → `VisualWorldSpec`**。整条 V2 链的**最前端**。
//
// 决定住 `../../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md`。
//
// ⚠️ **本包的 I/O 是自己写的**，没有复用 `packages/assets` 的 `callText` / `onceThrough` / `spentCall`
//   —— 那三个都住在 `assets`，而 `check-deps.mjs` 只许 `vision` 依赖 `contracts`（R11）。
//   这是**结构性**的：共享的 I/O 根本没有地方放（放 `assets` 则 `vision` 够不着，
//   放 `contracts` 则那一层不再「纯」）。所以下面有一份同形的 `spentCall`，
//   而**形状**那一半（`forcedTool` / `parseToolUse` / 失败闭集）确实是从 `contracts` 取来的。
//
// ⚠️ **为什么这一步要看图 + 需求文本两样**（票 08 的 R1-Q1）：`palette` 是[[绘制词汇]]，
//   **不是画面分布的摘要** —— 它的判据是「画不画得出这个世界里的东西」，
//   而**要画的东西有一部分压根不在参考图里**（`halt-dusk.png` 的 provenance 白纸黑字：
//   它「故意不包含牛/拖拉机/谷仓」，而 Destination 验收第 2 条要考的正是这个）。
//   一个只见过参考图的模型挑不出「画得出牛的那几个色」。
//   ⚠️ 喂的是**原始需求文本**、**不是** `GameIntentSpec` 的产物 ⇒ 两步仍然**并列**，不引入次序。
import fs from "node:fs";
import path from "node:path";
import {
  STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS, VisualWorldSpecSchema, forcedTool, parseToolUse,
  type CallFailure, type LedgerCall, type LedgerStep, type LedgerUsage, type StyleReference, type VisualWorldSpec,
} from "@game-maker/contracts";
import { buildVisualWorld } from "./build-visual-world.js";
import { TOOL_DESCRIPTION, TOOL_NAME, visionPrompt } from "./prompts.js";

/** 请求的模型名。⚠️ 与 `assets` 同源（票 24 的实况：代理**请求一个、回另一个**，`model` 与 `requestedModel` 是两个事实）。 */
const REQUESTED_MODEL = "deepseek-v4-pro";

/** 输出上限。⚠️ 票 08 的八发实测 **1742–2156 token**（内嵌 `style` 子树把票 27 的 1135–1660 顶上去了）。
 *  这是**上限不是分配**，给足不花钱；而**截断**会把一次本来会成功的调用变成 `truncated` 重采样。 */
const MAX_TOKENS = 16_000;

/** 媒体类型按**扩展名**判。⚠️ 我们**不解析图片内容**（票 08 的 R1-Q7）——
 *  `vision` 够不着 `assets` 的 `png.ts`，也没有必要：上游本来就会重编码（票 04 实测：送纯单色图 5 次零命中）。 */
const MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

/** 模型面向的 schema = 契约 **减掉**调用方注入的那一个键（票 08 的 R1-Q2）。
 *  ⚠️ `.omit()` 会**丢掉**顶层那条越界 `superRefine`（v4 实测）—— 那是**预期的**：
 *    gate 本来就拦不住模型（`toJSONSchema` 同样丢掉它），它拦的是 `buildVisualWorld` 装配出来的**成品**。 */
const ModelFacingSpec = VisualWorldSpecSchema.omit({ styleReferences: true });

export type AnalyzeReferenceInput = {
  /** 调用方给的参考图登记。第一阶段恰好 1 项（R18 的 `maxItems` 由**调用方**执行，不写进 schema）。 */
  styleReferences: StyleReference[];
  /** 原始需求文本（R1-Q1）。**必填** —— 人肉基线说「一定要给」。 */
  requirementText: string;
  /** 风格身份（R2-Q2：参考图 basename 的 slug，由 CLI 生成）。提示词递给模型照抄，这里**强制覆盖**。 */
  styleId: string;
  /**
   * `styleReferences[].path` **相对谁解析**（默认 `process.cwd()`）。
   *
   * ⚠️ 2026-10-07（票 15）加上它：那几条相对路径是**调用方给的**，而「相对谁」是个真问题 ——
   *   CLI 从哪儿跑就是哪；而 pipeline 里的 `createGame` 可能带着一个**别的**工作目录。
   *   ⚠️ 形状是仓库现成的规矩（R5）：**环境由壳读、core 只收结构体** ——
   *   与 `resolveImageTransport({env, cwd})` 同款，**不**让这一层去读全局状态。
   */
  cwd?: string;
  transport: { baseUrl: string; apiKey: string };
  /** 测试可注入（`review.ts` 同款用法）。 */
  fetchImpl?: typeof fetch;
  /** 一次上游调用的超时。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

export type AnalyzeReferenceResult = {
  /** 已注入 `styleReferences`、已覆盖 `style.id`、并**重新过了一次契约**的成品。 */
  spec: VisualWorldSpec;
  /** **一次调用 = 一格**（`attempts` 累加、`failures[]` 留原因）。⚠️ 没上路就**缺席**（不填占位值）。 */
  ledger?: LedgerCall[];
};

/**
 * 这一步失败**带着病因**。⚠️ **三发全败也要把账带出来** —— 那正是 `failures[]` 存在的理由
 * （票 27 的 Q4(ii)：只记「最后失败的那次」时，`empty-input` 那种「没被看见就过去了」的病因
 * **一次都不会出现**）。
 */
export class AnalyzeReferenceError extends Error {
  constructor(readonly failure: CallFailure, message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "AnalyzeReferenceError";
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
      // ⚠️ 只有**成功**那一趟带 `spent`，而一趟调用里至多成功一次（成了就 return）
      //   ⇒ 后面失败的那些**盖不掉**它。
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
  | { kind: "ok"; value: VisualWorldSpec; spent: Spent }
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

// ── 出发前的三处「免费」拦停 ─────────────────────────────────────────────────
// ⚠️ 都在**第一个请求上路之前**，所以它们**不记进账**（账只记真的发出去过的往返）。
//   而它们值钱的地方是同一条：**别让调用方的错去烧三次重采样**。

function assertConfigured(t: { baseUrl: string; apiKey: string }): void {
  if (t.baseUrl === "" || t.apiKey === "")
    throw new Error(
      "视觉上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 一份 `visual-world.json` 也可以由人直接写。");
}

function assertStyleReferences(refs: StyleReference[]): StyleReference[] {
  const r = VisualWorldSpecSchema.shape.styleReferences.safeParse(refs);
  if (!r.success) throw new Error("styleReferences 不合法（这是**调用方**给的那一份，不是模型吐的）：" +
    r.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；"));
  if (r.data.length === 0) throw new Error("styleReferences 是空的 —— 这一步没有图可看。第一阶段恰好要 1 张（R18）。");
  if (r.data.length > 1)
    throw new Error(`第一阶段只支持 1 张参考图，给了 ${r.data.length} 张 —— ⚠️ 多图的权重融合与冲突解决**没有任何实测**（R18），实现延后到[票 26]。`);
  return r.data;
}

function assertRequirement(text: string): string {
  const t = text.trim();
  if (t === "")
    throw new Error("requirementText 是空的 —— ⚠️ 色板的判据是「能不能画出这个世界里的东西」，" +
      "而**要画的东西有一部分压根不在参考图里**（R1-Q1）。没有需求文本，这一步挑出来的色板画不出那些东西。");
  return t;
}

function imageBlocks(refs: StyleReference[], cwd: string): Record<string, unknown>[] {
  return refs.map((r) => {
    const ext = path.extname(r.path).toLowerCase();
    const media = MEDIA_TYPES[ext];
    if (media === undefined)
      throw new Error(`参考图 ${r.path} 的扩展名 "${ext}" 不在白名单里（${Object.keys(MEDIA_TYPES).join(" / ")}）` +
        " —— 我们**按扩展名**判媒体类型，不解析图片内容（R1-Q7）。");
    let bytes: Buffer;
    try { bytes = fs.readFileSync(path.resolve(cwd, r.path)); }
    catch (e) { throw new Error(`参考图读不出来：${r.path} —— ${(e as Error).message}`); }
    return { type: "image", source: { type: "base64", media_type: media, data: bytes.toString("base64") } };
  });
}

/** 一次往返。**只做一次** —— 重采样在调用方那层（R16 的固定次数）。 */
async function onceThrough(o: {
  baseUrl: string; apiKey: string; body: string; timeoutMs: number; doFetch: typeof fetch;
  styleReferences: StyleReference[]; styleId: string;
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
  // ⚠️ **唯一算数的判据**：入参过 Zod。`stop_reason === "tool_use"` **不是**成功信号（票 27 第 1 发：`input = {}`）。
  const parsed = parseToolUse(body, TOOL_NAME, ModelFacingSpec);
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };

  // 注入两件调用方才知道的东西，并**重新过一次契约** —— 越界 gate 正是在这里响。
  const built = buildVisualWorld({ fromModel: parsed.value, styleReferences: o.styleReferences, styleId: o.styleId });
  if (!built.ok) return { kind: "bad", failure: "schema", detail: `装配后不过契约：${built.detail}`, spent };
  return { kind: "ok", value: built.spec, spent };
}

/**
 * 看一张参考图 + 一段需求文本，产出这个世界的 `VisualWorldSpec`。
 *
 * ⚠️ **传输层的失败不重采样**（`http` / `timeout`）—— 与 `assets` 那条链一致：
 *   R16 的重采样是给**入参不过 Zod** 那种失败用的，不是给「上游挂了」用的。
 *   把两者混在一个分母里，正是票 27 的 Q4(ii) 立 `CALL_FAILURES` 要治的病。
 */
export async function analyzeReference(input: AnalyzeReferenceInput): Promise<AnalyzeReferenceResult> {
  assertConfigured(input.transport);
  const styleReferences = assertStyleReferences(input.styleReferences);
  /** ⚠️ 参考图那几条相对路径**相对谁** —— 调用方给（见 `AnalyzeReferenceInput.cwd`）。 */
  const cwd = input.cwd ?? process.cwd();
  const requirementText = assertRequirement(input.requirementText);

  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const body = JSON.stringify({
    model: REQUESTED_MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
    ...forcedTool(TOOL_NAME, TOOL_DESCRIPTION, ModelFacingSpec),
    messages: [{
      role: "user",
      content: [...imageBlocks(styleReferences, cwd), { type: "text", text: visionPrompt({ requirementText, styleId: input.styleId }) }],
    }],
  });

  const call = spentCall("analyze-reference", input.styleId);
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      baseUrl: input.transport.baseUrl, apiKey: input.transport.apiKey, body, timeoutMs, doFetch,
      styleReferences, styleId: input.styleId,
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      const ledger = call.record();
      throw new AnalyzeReferenceError(once.failure, once.detail, ledger ? [ledger] : undefined);
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
  throw new AnalyzeReferenceError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 VisualWorldSpec（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  );
}
