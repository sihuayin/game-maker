import { describe, expect, it } from "vitest";
import { z as z4 } from "zod/v4";
import { geminiToolSpec, parseGeminiFunctionCall, geminiUsageOf } from "../src/index.js";

/** 一份像 V2 契约那样的 schema —— 嵌套对象、枚举、可选字段一个不少。 */
const Spec = z4.strictObject({
  schemaVersion: z4.string(),
  camera: z4.strictObject({ mode: z4.enum(["side", "top-down"]) }),
  confidence: z4.number().min(0).max(1),
});

/** 一份能过 `Spec` 的最小合法值。 */
const GOOD = { schemaVersion: "1", camera: { mode: "side" }, confidence: 0.8 };

/** Gemini `:generateContent` 的回应体形状 —— 只有 `candidates` / `finishReason` 是我们要的。 */
const body = (parts: unknown[], finishReason = "STOP") => ({ candidates: [{ content: { parts }, finishReason }] });
const funcCall = (args: unknown, name = "emit_spec") => ({ functionCall: { name, args } });

describe("geminiToolSpec", () => {
  it("产出 functionDeclarations + mode ANY 强制函数调用", () => {
    const spec = geminiToolSpec("emit_spec", "描述", Spec);
    expect(spec.tools).toHaveLength(1);
    const decl = (spec.tools[0] as { functionDeclarations: unknown[] }).functionDeclarations[0] as Record<string, unknown>;
    expect(decl.name).toBe("emit_spec");
    expect(decl.description).toBe("描述");
    expect(decl.parameters).toBeTruthy();
    expect(spec.toolConfig).toEqual({ functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["emit_spec"] } });
  });
});

describe("parseGeminiFunctionCall", () => {
  it("成功：args 过契约", () => {
    const r = parseGeminiFunctionCall(body([funcCall(GOOD)]), "emit_spec", Spec);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(GOOD);
  });

  it("schema：args 不过契约", () => {
    const r = parseGeminiFunctionCall(body([funcCall({ schemaVersion: "1" })]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("schema");
  });

  it("no-tool-use：没有 functionCall 块", () => {
    const r = parseGeminiFunctionCall(body([{ text: "hello" }]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("no-tool-use");
  });

  it("empty-input：args 是空对象", () => {
    const r = parseGeminiFunctionCall(body([funcCall({})]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("empty-input");
  });

  it("truncated：finishReason MAX_TOKENS 且没可用入参", () => {
    const r = parseGeminiFunctionCall(body([{ text: "hi" }], "MAX_TOKENS"), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("truncated");
  });

  it("名字不符的 functionCall 不算（no-tool-use）", () => {
    const r = parseGeminiFunctionCall(body([funcCall(GOOD, "other_tool")]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("no-tool-use");
  });
});

describe("geminiUsageOf", () => {
  it("解析 usageMetadata", () => {
    const r = geminiUsageOf({
      modelVersion: "gemini-3.1-flash",
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 3 },
    });
    expect(r).toEqual({ model: "gemini-3.1-flash", usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: 3 } });
  });

  it("拿不到就缺席", () => {
    expect(geminiUsageOf({})).toEqual({});
  });
});
