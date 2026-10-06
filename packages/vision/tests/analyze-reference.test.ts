// `analyzeReference` 的判据。全部用假 `fetch`（`review.ts` 的既有用法）—— **不发真请求、不花钱**。
//
// ⚠️ 最要紧的一条是**重采样是真在重采样**（R16）：入参不过 Zod 才算失败，
//   而 `attempts` 与 `failures[]` 要**说得清为什么重来** —— 那是票 27 的 Q4(ii) 立 `CALL_FAILURES` 的全部理由。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STRUCTURED_CALL_ATTEMPTS, UPSTREAM_TIMEOUT_MS } from "@game-maker/contracts";
import { AnalyzeReferenceError, TOOL_NAME, analyzeReference, type AnalyzeReferenceInput } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
/** ⚠️ 必须是**相对**路径 —— `StyleReferencePath` 就是那么定的（相对 `visual-world.json` 自身）。 */
const IMG_REL = "fixtures/reference/halt-dusk.png";
const REFS = [{ path: IMG_REL, role: "global" }];

const modelOut = (over: Record<string, unknown> = {}) => ({
  format: "visual-world/v1",
  styleIdentity: { keywords: ["像素", "低饱和"], description: "黄昏山间列车小站，三条横带各自一套光照" },
  camera: { mode: "side" },
  composition: { objectScale: "小" }, lighting: {}, character: {}, environment: { textureDensity: "低" },
  palette: { primary: ["palette:0"], secondary: [], accent: ["palette:1"], background: [], shadow: [], highlight: [] },
  materials: { wood: { appearance: "哑光", color: ["palette:0"] } },
  shapeLanguage: ["横平竖直"], constraints: ["不要抗锯齿"],
  style: {
    id: "模型自己编的", identity: ["扁平像素"], camera: {}, composition: {}, palette: ["#2e3b4e", "#4a6076"],
    lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.9,
  },
  ...over,
});

const reply = (input: unknown, stopReason = "tool_use") =>
  ({ content: [{ type: "tool_use", name: TOOL_NAME, input }], stop_reason: stopReason,
     model: "deepseek-flash", usage: { input_tokens: 1500, output_tokens: 1900 } });
const res = (body: unknown, status = 200): Response =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

/** 按顺序把预先排好的回应发出去，并把每次请求体记下来。 */
function stage(parts: (Response | (() => Promise<Response>))[]) {
  const seen: Record<string, any>[] = [];
  let n = 0;
  const f = (async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    const p = parts[Math.min(n, parts.length - 1)]!;
    n++;
    return typeof p === "function" ? await p() : p;
  }) as unknown as typeof fetch;
  return { f, seen, calls: () => n };
}

/**
 * ⚠️ **等一次「必须抛」的调用，并把抛出来的那个错误拿回来**。
 *
 * `.catch((e) => e as AnalyzeReferenceError)` 看着对，**类型上却留下一个联合**
 * （`AnalyzeReferenceResult | AnalyzeReferenceError`）—— 因为 `.catch` 只换掉**失败**那一支，「成功」那一支仍在类型里
 * ⇒ 下面每一处 `err.failure` / `err.message` 都是类型错（`tsc -p tsconfig.spec.json` 红的那些）。
 * ⚠️ 而那个联合里「成功」那一支**根本不该出现**：它出现就说明这一步**没抛**，是这张用例的失败。
 * ⇒ 改用 `.then(onFulfilled, onRejected)`：成功那一支**当场抛**（并把它拿到的值带上，好认），
 *   失败那一支断言成 `AnalyzeReferenceError` —— 每个调用点下面仍有字段断言兜底。
 * ⚠️ 一处小谎：**「普通 `Error`」那一处**（凭据没配）也走这个函数（它只要 `.message`），
 *   那一处下面有 `not.toBeInstanceOf` 兜着。
 */
const thrown = (p: Promise<unknown>): Promise<AnalyzeReferenceError> =>
  p.then(
    (ok) => { throw new Error(`这一步**应当抛**，但它成功了：${JSON.stringify(ok)?.slice(0, 160)}`); },
    (e: unknown) => e as AnalyzeReferenceError
  );

const input = (over: Partial<AnalyzeReferenceInput> = {}): AnalyzeReferenceInput => ({
  styleReferences: REFS, requirementText: "做一个末班车小站的横版过关", styleId: "halt-dusk",
  transport: { baseUrl: "http://upstream.test", apiKey: "k" }, ...over,
});

describe("发出去的那一发", () => {
  it("图是**原字节 base64 直传**、媒体类型按扩展名（R1-Q7）", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeReference(input({ fetchImpl: s.f }));
    const content = s.seen[0]!["messages"][0].content;
    expect(content[0].type).toBe("image");
    expect(content[0].source.type).toBe("base64");
    expect(content[0].source.media_type).toBe("image/png");
    expect(content[0].source.data).toBe(readFileSync(ROOT + IMG_REL).toString("base64"));
    expect(content[1].text).toContain("末班车小站");
  });

  it("⚠️ **不向模型要 `styleReferences`** —— 它由调用方注入（R1-Q2）", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeReference(input({ fetchImpl: s.f }));
    const schema = s.seen[0]!["tools"][0].input_schema;
    expect(schema.properties).not.toHaveProperty("styleReferences");
    expect(schema.required).not.toContain("styleReferences");
    expect(schema.additionalProperties).toBe(false);
  });

  it("强制工具调用、关 thinking、`max_tokens` 给足（R16 / R2-Q3）", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeReference(input({ fetchImpl: s.f }));
    const b = s.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(b.tools[0].name).toBe(TOOL_NAME);
    expect(b.tools[0].description).toContain("不是数组");        // R2-Q5 的那三件事在里面
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000);
  });
});

describe("成功那一趟", () => {
  it("装配好的成品 + 一格账（首发就成 ⇒ **没有** `failures`）", async () => {
    const s = stage([res(reply(modelOut()))]);
    const r = await analyzeReference(input({ fetchImpl: s.f }));
    expect(r.spec.styleReferences).toEqual(REFS);
    expect(r.spec.style.id).toBe("halt-dusk");
    expect(r.ledger).toHaveLength(1);
    const call = r.ledger![0]!;
    expect(call.step).toBe("analyze-reference");
    expect(call.target).toBe("halt-dusk");
    expect(call.upstream).toBe("messages");
    expect(call.attempts).toBe(1);
    expect(call.failures).toBeUndefined();                       // ⚠️ 缺席 == 一次都没失败
    expect(call.model).toBe("deepseek-flash");                   // 上游自报
    expect(call.requestedModel).toBe("deepseek-v4-pro");         // 我们请求的 —— 两个事实并列
    expect(call.usage).toEqual({ inputTokens: 1500, outputTokens: 1900 });
  });
});

describe("重采样（R16）", () => {
  it("第一发不合契约、第二发好 ⇒ 账上 `attempts=2` 且说得出**为什么重来**", async () => {
    const s = stage([
      res(reply({ format: "visual-world/v1" })),                  // 缺一堆必填
      res(reply(modelOut())),
    ]);
    const r = await analyzeReference(input({ fetchImpl: s.f }));
    expect(s.calls()).toBe(2);
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("⚠️ 上游把入参丢了（`empty-input`）也要**留在账上** —— 只记最后一次时它一次都不会出现", async () => {
    const s = stage([res(reply({})), res(reply({})), res(reply(modelOut()))]);
    const r = await analyzeReference({ ...input({ fetchImpl: s.f }) });
    expect(r.ledger![0]!.failures).toEqual(["empty-input", "empty-input"]);
    expect(r.ledger![0]!.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
  });

  it("⚠️ **越界也在这一步重采样**（gate 的落点）—— 模型自相矛盾不该静默通过", async () => {
    const outOfRange = modelOut({ palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: ["palette:7"] } });
    const s = stage([res(reply(outOfRange)), res(reply(modelOut()))]);
    const r = await analyzeReference(input({ fetchImpl: s.f }));
    expect(s.calls()).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
    expect(r.spec.palette.highlight).toEqual([]);
  });

  it("`stop_reason` 是 `tool_use` 但**没有工具块** ⇒ `no-tool-use`（代理不认 tools 那一档）", async () => {
    const s = stage([res({ content: [{ type: "text", text: "我说了算" }], stop_reason: "tool_use" })]);
    await expect(analyzeReference(input({ fetchImpl: s.f }))).rejects.toThrow(/no-tool-use|重采样/);
  });

  it("三发全败 ⇒ 抛错，且**账跟着错一起出来**", async () => {
    const s = stage([res(reply({}))]);
    const err = await thrown(analyzeReference(input({ fetchImpl: s.f })));
    expect(err).toBeInstanceOf(AnalyzeReferenceError);
    expect(err.failure).toBe("empty-input");
    expect(err.ledger).toHaveLength(1);
    expect(err.ledger![0]!.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(err.ledger![0]!.failures).toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    expect(err.message).toContain(`重采样 ${STRUCTURED_CALL_ATTEMPTS} 次`);
  });
});

describe("传输层的失败 **不重采样**（与 assets 那条链一致）", () => {
  it("HTTP 500 ⇒ 立刻抛，账上只有一趟", async () => {
    const s = stage([res({ error: "boom" }, 500)]);
    const err = await thrown(analyzeReference(input({ fetchImpl: s.f })));
    expect(err.failure).toBe("http");
    expect(s.calls()).toBe(1);
    expect(err.ledger![0]!.attempts).toBe(1);
  });

  it("超时 ⇒ `timeout`（并**分开报**，别让人去查代理）", async () => {
    const hang = (() => new Promise<Response>((_res, rej) => {
      setTimeout(() => rej(new Error("aborted")), 50);
    })) as () => Promise<Response>;
    const s = stage([hang]);
    const err = await thrown(analyzeReference(input({ fetchImpl: s.f, timeoutMs: 10 })));
    expect(err).toBeInstanceOf(AnalyzeReferenceError);
    expect(err.failure).toBe("timeout");
    expect(err.message).toContain("已中止");
  });
});

describe("出发前的三处免费拦停（都**不**记账 —— 账只记真的发出去过的往返）", () => {
  it("没配凭据 ⇒ 普通 Error，**不是** `AnalyzeReferenceError`", async () => {
    const err = await thrown(analyzeReference(input({ transport: { baseUrl: "", apiKey: "" } })));
    expect(err).not.toBeInstanceOf(AnalyzeReferenceError);
    expect(err.message).toContain("ANTHROPIC_BASE_URL");
  });

  it("需求文本为空 ⇒ 抛（没有它，色板画不出参考图里没有的东西）", async () => {
    await expect(analyzeReference(input({ requirementText: "   " }))).rejects.toThrow(/requirementText/);
  });

  it("两张参考图 ⇒ 抛（R18：多图实现延后到票 26）", async () => {
    await expect(analyzeReference(input({ styleReferences: [REFS[0]!, { path: "b.png", role: "global" }] })))
      .rejects.toThrow(/票 26/);
  });

  it("路径不合 `StyleReferencePath`（比如绝对路径）⇒ 抛 —— 它是**调用方**给错了", async () => {
    await expect(analyzeReference(input({ styleReferences: [{ path: "/abs/x.png", role: "global" }] })))
      .rejects.toThrow(/styleReferences 不合法/);
  });

  it("扩展名不在白名单 ⇒ 抛（我们**不解析图片内容**）", async () => {
    await expect(analyzeReference(input({ styleReferences: [{ path: "fixtures/reference/halt-dusk.bmp", role: "global" }] })))
      .rejects.toThrow(/白名单/);
  });

  it("默认超时来自 `contracts`（`vision` 够不着 `assets`，所以那个数搬了家）", async () => {
    expect(UPSTREAM_TIMEOUT_MS).toBe(180_000);
  });
});
