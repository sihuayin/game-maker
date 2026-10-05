// `analyzeIntent` 的判据。全部用假 `fetch`（`vision` / `review.ts` 的既有用法）—— **不发真请求、不花钱**。
//
// ⚠️ 最要紧的两条：① **重采样是真在重采样**（R16：入参过 Zod 才算成功，`attempts` 与 `failures[]` 要说得清）；
//   ② **模型面向的 schema 就是契约本身**（票 09 第 1 轮 Q6：没有装配步、没有 `.omit()`）
//   —— 所以顶层那条结构性空值 gate 在这一层是**活的**。
import { describe, expect, it } from "vitest";
import { STRUCTURED_CALL_ATTEMPTS } from "@game-maker/contracts";
import { AnalyzeIntentError, TOOL_NAME, analyzeIntent, type AnalyzeIntentInput } from "../src/index.js";

/** 模型吐的成品。⚠️ 它必须**过得了那份完全契约**（含顶层 gate），否则下面测的不是那条规矩。 */
const modelOut = (over: Record<string, unknown> = {}) => ({
  format: "game-intent/v1",
  title: "拾荒者",
  genre: "platformer",
  targetExperience: "孤独但一直向上",
  coreLoop: ["探索废墟", "收集零件"],
  player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [{ id: "m-jump", name: "跳跃" }, { id: "m-double-jump", name: "二段跳" }],
  entities: [{ id: "e-drone", type: "enemy", role: "沿固定路线巡逻的无人机" }],
  winConditions: ["抵达终点"],
  loseConditions: [],
  ambiguity: ["camera：需求没提，暂按横版默认"],
  ...over,
});

const reply = (input: unknown, stopReason = "tool_use") =>
  ({ content: [{ type: "tool_use", name: TOOL_NAME, input }], stop_reason: stopReason,
     model: "deepseek-flash", usage: { input_tokens: 838, output_tokens: 991 } });
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

const input = (over: Partial<AnalyzeIntentInput> = {}): AnalyzeIntentInput => ({
  requirementText: "做一个废土横版寻宝游戏",
  transport: { baseUrl: "http://upstream.test", apiKey: "k" }, ...over,
});

describe("发出去的那一发", () => {
  it("内容**只有一段文本**（这一步没有图），且需求原文进了提示词", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeIntent(input({ fetchImpl: s.f }));
    const content = s.seen[0]!["messages"][0].content;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("做一个废土横版寻宝游戏");
  });

  it("⚠️ 模型面向的 schema **就是契约本身**：16 键、封口、且**没有** `resources`（Q5 的验收眼）", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeIntent(input({ fetchImpl: s.f }));
    const schema = s.seen[0]!["tools"][0].input_schema;
    expect(Object.keys(schema.properties)).toHaveLength(16);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).not.toContain("title");        // 可空
    expect(schema.properties).not.toHaveProperty("resources"); // 票 09 的 Q5 —— 它已经出局
  });

  it("强制工具调用、关 thinking、`max_tokens` 与 08 同档；说明里带着 schema 说不清的那几条", async () => {
    const s = stage([res(reply(modelOut()))]);
    await analyzeIntent(input({ fetchImpl: s.f }));
    const b = s.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(b.tools[0].name).toBe(TOOL_NAME);
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000);
    expect(b.tools[0].description).toContain("自由文本");    // mechanics 不许按外壳能力筛
  });
});

describe("成功那一趟", () => {
  it("过 Zod 的产物**就是成品**（没有装配步）+ 一格账（首发就成 ⇒ **没有** `failures`）", async () => {
    const s = stage([res(reply(modelOut()))]);
    const r = await analyzeIntent(input({ fetchImpl: s.f }));
    expect(r.spec.genre).toBe("platformer");
    expect(r.spec.mechanics.map((m) => m.name)).toEqual(["跳跃", "二段跳"]);
    expect(r.ledger).toHaveLength(1);
    const call = r.ledger![0]!;
    expect(call.step).toBe("analyze-intent");
    expect(call.target).toBe("game-intent");                 // ⚠️ 产物名，不是 id（与 vision 的 styleId 不同）
    expect(call.upstream).toBe("messages");
    expect(call.attempts).toBe(1);
    expect(call.failures).toBeUndefined();                   // ⚠️ 缺席 == 一次都没失败
    expect(call.model).toBe("deepseek-flash");
    expect(call.requestedModel).toBe("deepseek-v4-pro");
    expect(call.usage).toEqual({ inputTokens: 838, outputTokens: 991 });
  });
});

describe("重采样（R16）", () => {
  it("首发不过 Zod、第二发过 ⇒ `attempts: 2`、`failures: [\"schema\"]`", async () => {
    // ⚠️ 入参是**个非空对象、但缺一堆必填** ⇒ `schema`；而 `reply({})` 是 `empty-input`（另一档，见下一条）。
    const s = stage([res(reply({ genre: "platformer" })), res(reply(modelOut()))]);
    const r = await analyzeIntent(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("`empty-input` 重来两发要**都留着** —— 那正是它存在的理由（票 27 第 1 发）", async () => {
    const s = stage([res(reply(modelOut()))]);
    const r = await analyzeIntent(input({ fetchImpl: s.f }));
    expect(r.spec.title).toBe("拾荒者");
    const s2 = stage([res(reply({})), res(reply({})), res(reply(modelOut()))]);
    const r2 = await analyzeIntent(input({ fetchImpl: s2.f }));
    expect(r2.ledger![0]!.failures).toEqual(["empty-input", "empty-input"]);
  });

  it("⚠️ **契约那条 gate 在这一步是活的**：必填字段吐成空串 ⇒ 重采样", async () => {
    const s = stage([res(reply(modelOut({ genre: "  " }))), res(reply(modelOut()))]);
    const r = await analyzeIntent(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("工具压根没被调 ⇒ `no-tool-use`（那一档与「入参丢了」是两回事）", async () => {
    const s = stage([
      res({ content: [{ type: "text", text: "我拒绝" }], stop_reason: "end_turn" }),
      res(reply(modelOut())),
    ]);
    const r = await analyzeIntent(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.failures).toEqual(["no-tool-use"]);
  });

  it("三发全败 ⇒ 抛错，且**账跟着错一起出来**（`failures` 长度 == 地板值）", async () => {
    const s = stage([res(reply({}))]);
    await expect(analyzeIntent(input({ fetchImpl: s.f }))).rejects.toThrowError(AnalyzeIntentError);
    const err = await analyzeIntent(input({ fetchImpl: stage([res(reply({}))]).f })).catch((e) => e as AnalyzeIntentError);
    expect(err.ledger![0]!.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(err.ledger![0]!.failures).toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    expect(s.calls()).toBe(STRUCTURED_CALL_ATTEMPTS);
  });
});

describe("传输层的失败 **不重采样**", () => {
  it("HTTP 500 ⇒ 立刻抛，只走一趟（与 vision / assets 同一条规矩）", async () => {
    const s = stage([res({ error: "boom" }, 500), res(reply(modelOut()))]);
    const err = await analyzeIntent(input({ fetchImpl: s.f })).catch((e) => e as AnalyzeIntentError);
    expect(err).toBeInstanceOf(AnalyzeIntentError);
    expect(err.failure).toBe("http");
    expect(s.calls()).toBe(1);
    // ⚠️ 票 09 第 1 轮 Q3：**传输层的病因也进 `failures[]`**（照 `analyze-reference.ts` 的代码，
    //   而不是它票面 Answer §4 那句「不进」—— 那句已标为过时）。
    expect(err.ledger![0]!.failures).toEqual(["http"]);
  });

  it("超时 ⇒ `timeout`，且报错说得出「已中止」", async () => {
    const s = stage([() => new Promise<Response>((_, rej) => setTimeout(() => rej(new Error("aborted")), 0))]);
    const err = await analyzeIntent(input({ fetchImpl: s.f, timeoutMs: 1 })).catch((e) => e as AnalyzeIntentError);
    expect(err.failure).toBe("timeout");
    expect(err.message).toContain("已中止");
  });
});

describe("出发前的两处「免费」拦停 —— **不记进账**，别让调用方的错烧三次重采样", () => {
  it("凭据没配 ⇒ 普通 `Error`（不是 `AnalyzeIntentError`）", async () => {
    await expect(analyzeIntent(input({ transport: { baseUrl: "", apiKey: "" } })))
      .rejects.toThrowError(/文本上游没配/);
  });

  it("需求文本是空的 ⇒ 普通 `Error`，而且说得出「这一步没有别的输入」", async () => {
    await expect(analyzeIntent(input({ requirementText: "   " })))
      .rejects.toThrowError(/没有别的输入/);
  });
});
