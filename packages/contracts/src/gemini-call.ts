// Gemini 文本上游的**形状层**（fpvs-v1-p0 票 07）。
//
// `structured-call.ts` 里的 `forcedTool` / `parseToolUse` 是 **Anthropic 的 `tool_use`** 形状；
// 这里是 **Gemini function calling**（`functionDeclarations` / `functionCall`）的对家。
//
// ⚠️ 与 `structured-call.ts` 同一条纪律：这里**不做 I/O**（没有 fetch / 重试 / fs），
//   只做「形状」—— 把契约转成请求片段、把响应抠出 functionCall 的 args 并过 Zod。
//   I/O（fetch / 超时 / 重试 / 落账）各包自理，按协议分支。
//
// ⚠️ Gemini 的 `parameters` 直接复用 `toolInputSchema`（zod/v4 → JSON Schema）。
//   二者都是「描述让模型填的东西」，形状同源；真正的兼容性（Gemini 对某些 JSON Schema
//   关键字的态度）归付费探针去验，不是这里的静态判定。

import { z as z4 } from "zod/v4";
import { formatIssues } from "./zod-issues.js";
import { forcedTool, parseToolUse, toolInputSchema, type StructuredSchema, type ToolUseFailure, type ToolUseOutcome } from "./structured-call.js";
import type { LedgerUsage } from "./ledger.js";

/** 文本上游说的哪种话。默认 `anthropic`（存量调用不带 protocol 时不改行为）。 */
export type TextProtocol = "anthropic" | "gemini";

/** 文本上游的 transport —— 比旧 `{ baseUrl, apiKey }` 多了可选的 `protocol` / `model` / `proxy`。 */
export type TextTransport = {
  protocol?: TextProtocol;
  baseUrl: string;
  apiKey: string;
  model?: string;
  /** HTTP 代理（如 `http://127.0.0.1:7890`）。gemini 直连 Google 在境内要它；由 shell 层建代理 fetch。 */
  proxy?: string;
};

export function textProtocolOf(t: TextTransport): TextProtocol {
  return t.protocol ?? "anthropic";
}

/** 模型名的**唯一默认落点**：gemini 缺省 `gemini-3.5-flash`，anthropic 缺省 `deepseek-v4-pro`。 */
export function textModelOf(t: TextTransport): string {
  return t.model ?? (textProtocolOf(t) === "gemini" ? "gemini-3.5-flash" : "deepseek-v4-pro");
}

const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

const describe = (u: unknown): string =>
  u === null ? "null" : Array.isArray(u) ? `数组(${u.length})` : typeof u;

// ⚠️ 与 `structured-call.ts` 的 `fail` 同形 —— 「false 那一臂」不引用 T，所以能塞进任何 `ToolUseOutcome<T>`。
const fail = (failure: ToolUseFailure, detail: string, raw?: unknown): { ok: false; failure: ToolUseFailure; detail: string; raw?: unknown } =>
  ({ ok: false, failure, detail, ...(raw === undefined ? {} : { raw }) });

/**
 * 把 zod/v4 的 JSON Schema 转成 Gemini 认的形状（function calling 的 `parameters` 是**极简** OpenAPI 子集）。
 * 实测（fpvs-v1-p0 探针）gemini 400 逐字拒过：`const`（`z.literal` 产）、`additionalProperties`（`z.strictObject`/`z.record` 产）、
 * `propertyNames`（`z.record` 产）、`exclusiveMinimum`/`exclusiveMaximum`（`z.number().positive()` 等产）。
 * 处置：`const` → `enum` 单值；`exclusiveMinimum/Maximum` → `minimum/Maximum`（含等号，稍松）；
 * `additionalProperties` / `propertyNames` 直接剥掉 —— 精确约束都由我们自己的 `safeParse` 强制，**不靠模型**。
 */
function geminiParameters(schema: z4.ZodType): Record<string, unknown> {
  const js = toolInputSchema(schema);
  const convert = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(convert);
    if (typeof node !== "object" || node === null) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "const") out["enum"] = [v];
      else if (k === "exclusiveMinimum") out["minimum"] = v;
      else if (k === "exclusiveMaximum") out["maximum"] = v;
      else if (k !== "additionalProperties" && k !== "propertyNames") out[k] = convert(v);
    }
    return out;
  };
  return convert(js) as Record<string, unknown>;
}

/**
 * 一次强制函数调用的 `tools` + `toolConfig`（Gemini function calling 形状）。
 * 镜像 Anthropic 的 `forcedTool`：`tool_choice: {type:"tool", name}` → `mode: "ANY"` + `allowedFunctionNames`。
 */
export function geminiToolSpec(toolName: string, description: string, schema: z4.ZodType):
{ tools: Record<string, unknown>[]; toolConfig: Record<string, unknown> } {
  return {
    tools: [{ functionDeclarations: [{ name: toolName, description, parameters: geminiParameters(schema) }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [toolName] } },
  };
}

/**
 * 从一次 `:generateContent` 的**已解析 body** 里取出 functionCall 的 args，**并过 Zod**。
 * 镜像 `parseToolUse` 的判据：**唯一算数的 = 入参过 schema**；`finishReason === "MAX_TOKENS"`
 * 只用来「解释失败」，不许拿它推翻一次成功。
 */
export function parseGeminiFunctionCall<T>(body: unknown, toolName: string, schema: StructuredSchema<T>): ToolUseOutcome<T> {
  if (!isRecord(body)) return fail("no-tool-use", `响应不是一个对象（拿到 ${describe(body)}）`);

  const candidates = Array.isArray(body["candidates"]) ? body["candidates"] : [];
  const truncated = candidates.some((c) => isRecord(c) && c["finishReason"] === "MAX_TOKENS");
  const why = (fallback: string) =>
    truncated ? `${fallback}（⚠️ 而 finishReason 是 MAX_TOKENS —— 更像是被截断的）` : fallback;

  let args: unknown;
  let found = false;
  const seen: string[] = [];
  outer: for (const c of candidates) {
    if (!isRecord(c)) continue;
    const content = c["content"];
    const parts = isRecord(content) && Array.isArray(content["parts"]) ? content["parts"] : [];
    for (const p of parts) {
      if (!isRecord(p)) continue;
      const fc = p["functionCall"];
      if (isRecord(fc)) {
        seen.push(`functionCall(${String(fc["name"] ?? "?")})`);
        if (fc["name"] === toolName) { args = fc["args"]; found = true; break outer; }
      } else {
        seen.push(String(p["type"] ?? "?"));
      }
    }
  }

  if (isRecord(args) && Object.keys(args).length > 0) {
    const r = schema.safeParse(args);
    if (r.success) return { ok: true, value: r.data, raw: args };
    return fail(truncated ? "truncated" : "schema",
      why(`工具入参不过契约：${formatIssues(r.error).slice(0, 4).join("；")}`), args);
  }

  if (truncated)
    return fail("truncated", "输出撞上 maxOutputTokens 被截断，而且没留下可用的入参（加大 maxOutputTokens 再来）", args);

  if (!found)
    return fail("no-tool-use",
      `响应里没有名为 "${toolName}" 的 functionCall 块（拿到的块：${seen.join(", ") || "（空）"}）。` +
      "⚠️ 这一档八成是上游不认 tools / toolConfig，不是模型写错了。");

  // ⚠️ `empty-input` 与 `parseToolUse` 同宽：不只是「空对象」，而是「这一趟没交出任何可用的入参」。
  return fail("empty-input",
    `函数被调了，但入参是空的或用不了（拿到 ${describe(args)}）。`, args);
}

/**
 * 从 Gemini 的 `usageMetadata` 里取账。拿不到就缺席，不许编一个 0 冒充「测到了」。
 * ⚠️ 只做「形状」这一半 —— 拼进 `LedgerCall` 的是各调用点自己的 `spentOf` 那套。
 */
export function geminiUsageOf(body: unknown): { usage?: LedgerUsage; model?: string } {
  const j = body as {
    modelVersion?: string;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  } | null;
  const u = j?.usageMetadata;
  const usage: LedgerUsage = {
    ...(u?.promptTokenCount !== undefined ? { inputTokens: u.promptTokenCount } : {}),
    ...(u?.candidatesTokenCount !== undefined ? { outputTokens: u.candidatesTokenCount } : {}),
    ...(u?.thoughtsTokenCount !== undefined ? { reasoningTokens: u.thoughtsTokenCount } : {}),
  };
  return {
    ...(j?.modelVersion ? { model: j.modelVersion } : {}),
    ...(Object.keys(usage).length > 0 ? { usage } : {}),
  };
}

// ── 请求 / 响应 / 账 的**统一入口**（按 protocol 分派）──────────────────────────
//
// ⚠️ 各包的 I/O（fetch / 超时 / 重试 / 落账）仍是**各包自理**，但「这一次上游调用长什么样」
//   是**形状**，可以统一。调用点只做一次分支（`buildTextRequest` / `parseTextResponse` / `textUsageOf`），
//   不用在 6 个文件里各抄一遍 gemini 与 anthropic 两套形状。

export type TextRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

/** 多模态（vision 步）要带的图 —— 中性形状，协议各自映射成自己的块。 */
export type TextImagePart = { mediaType: string; base64: string };

/**
 * 从 transport 造一次**强制工具调用**的请求。Anthropic 走 `/v1/messages`，gemini 走 `:generateContent`。
 * ⚠️ 只认「强制工具调用」这一种形态 —— 纯 JSON 文本那一路（drawlist）不走这里，见 `assets/generate.ts`。
 * ⚠️ `images` 只给多模态步（vision）用；纯文本步不传。
 */
export function buildTextRequest(opts: {
  transport: TextTransport;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: z4.ZodType;
  maxTokens: number;
  images?: readonly TextImagePart[];
}): TextRequest {
  const protocol = textProtocolOf(opts.transport);
  const model = textModelOf(opts.transport);
  const baseUrl = opts.transport.baseUrl.replace(/\/+$/, "");
  const images = opts.images ?? [];
  if (protocol === "gemini") {
    return {
      url: `${baseUrl}/models/${model}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": opts.transport.apiKey },
      body: JSON.stringify({
        ...geminiToolSpec(opts.toolName, opts.toolDescription, opts.schema),
        contents: [{
          role: "user",
          parts: [
            ...images.map((im) => ({ inline_data: { mime_type: im.mediaType, data: im.base64 } })),
            { text: opts.prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: opts.maxTokens },
      }),
    };
  }
  return {
    url: `${baseUrl}/v1/messages`,
    headers: { "content-type": "application/json", "x-api-key": opts.transport.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: opts.maxTokens, thinking: { type: "disabled" },
      ...forcedTool(opts.toolName, opts.toolDescription, opts.schema),
      messages: [{
        role: "user",
        content: [
          ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.base64 } })),
          { type: "text", text: opts.prompt },
        ],
      }],
    }),
  };
}

/** 按协议从已解析 body 里抠出工具入参并过 Zod。 */
export function parseTextResponse<T>(opts: {
  transport: TextTransport;
  body: unknown;
  toolName: string;
  schema: StructuredSchema<T>;
}): ToolUseOutcome<T> {
  return textProtocolOf(opts.transport) === "gemini"
    ? parseGeminiFunctionCall(opts.body, opts.toolName, opts.schema)
    : parseToolUse(opts.body, opts.toolName, opts.schema);
}

/** 按协议取账（usage + 上游报的 model）。拿不到就缺席。 */
export function textUsageOf(transport: TextTransport, body: unknown): { usage?: LedgerUsage; model?: string } {
  return textProtocolOf(transport) === "gemini" ? geminiUsageOf(body) : anthropicUsageOf(body);
}

function anthropicUsageOf(body: unknown): { usage?: LedgerUsage; model?: string } {
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
  return { ...(j?.model ? { model: j.model } : {}), ...(Object.keys(usage).length > 0 ? { usage } : {}) };
}

// ── 纯文本（非强制工具）一路：drawlist / derive / td-game ──────────────────
// ⚠️ 与「强制工具调用」分开：这一路**没有 tool / tool_choice**，就是「发一段 prompt、收一段 JSON 文本」。
//   gemini 用 `generationConfig.responseMimeType: "application/json"` 逼出干净 JSON（无围栏、无 thinking），
//   正好省掉 anthropic 那一路关 thinking 后的「剥围栏」步骤。

export function buildPlainTextRequest(opts: { transport: TextTransport; prompt: string; maxTokens: number }): TextRequest {
  const protocol = textProtocolOf(opts.transport);
  const model = textModelOf(opts.transport);
  const baseUrl = opts.transport.baseUrl.replace(/\/+$/, "");
  if (protocol === "gemini") {
    return {
      url: `${baseUrl}/models/${model}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": opts.transport.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: { maxOutputTokens: opts.maxTokens, responseMimeType: "application/json" },
      }),
    };
  }
  return {
    url: `${baseUrl}/v1/messages`,
    headers: { "content-type": "application/json", "x-api-key": opts.transport.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: opts.maxTokens, thinking: { type: "disabled" },
      messages: [{ role: "user", content: opts.prompt }],
    }),
  };
}

/** 纯文本回应：拼出文本 + 上游自报的 model / stop 信号。gemini 与 anthropic 两条路都吃。 */
export function parsePlainText(transport: TextTransport, body: unknown): {
  text: string; model?: string; stopReason?: string; usage?: LedgerUsage;
} {
  const { model, usage } = textUsageOf(transport, body);
  if (textProtocolOf(transport) === "gemini") {
    const j = body as { candidates?: { content?: { parts?: unknown[] }; finishReason?: string }[] } | null;
    const parts = (j?.candidates ?? []).flatMap((c) => (Array.isArray(c.content?.parts) ? c.content.parts : []));
    const text = parts
      .filter((p): p is { text: string } => isRecord(p) && typeof p["text"] === "string")
      .map((p) => p.text).join("");
    const fr = (j?.candidates ?? []).find((c) => typeof c.finishReason === "string")?.finishReason;
    return { text, ...(model ? { model } : {}), ...(fr ? { stopReason: fr } : {}), ...(usage ? { usage } : {}) };
  }
  const j = body as { content?: { type?: string; text?: string }[]; stop_reason?: string } | null;
  const blocks = Array.isArray(j?.content) ? j.content : [];
  return {
    text: blocks.filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
    ...(model ? { model } : {}),
    ...(j?.stop_reason ? { stopReason: j.stop_reason } : {}),
    ...(usage ? { usage } : {}),
  };
}
