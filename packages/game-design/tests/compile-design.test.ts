// `compileDesign` 的判据 —— 全部用假 `fetch`（**不发真请求、不花钱**）。
//
// ⚠️ 这份文件里最要紧的**不是**重采样那几条（那是票 09 已经立好的形状），
//   而是 **R12 的拒绝走的是另一条路**：**不重采样、不进 `failures[]`**、账照记。
import { describe, expect, it } from "vitest";
import { PLATFORMER_V1, STRUCTURED_CALL_ATTEMPTS, type GameDesignSpec } from "@game-maker/contracts";
import {
  CompileDesignError, DESIGN_TOOL_NAME, DesignRejectedError, compileDesign, type CompileDesignInput,
} from "../src/index.js";
import { INTENT, VWS, designFromModel } from "./fixtures.js";

const reply = (input: unknown, stopReason = "tool_use") =>
  ({ content: [{ type: "tool_use", name: DESIGN_TOOL_NAME, input }], stop_reason: stopReason,
     model: "deepseek-flash", usage: { input_tokens: 2400, output_tokens: 2600 } });
const res = (body: unknown, status = 200): Response =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

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

const input = (over: Partial<CompileDesignInput> = {}): CompileDesignInput => ({
  intent: INTENT, vws: VWS,
  transport: { baseUrl: "http://upstream.test", apiKey: "k" }, ...over,
});

describe("发出去的那一发", () => {
  it("内容**只有一段文本**，而意图层那 6 个 ① 档字段**逐个具名插值**进去了", async () => {
    const s = stage([res(reply(designFromModel()))]);
    await compileDesign(input({ fetchImpl: s.f }));
    const content = s.seen[0]!["messages"][0].content;
    expect(content).toHaveLength(1);
    const text: string = content[0].text;
    expect(content[0].type).toBe("text");
    // ⚠️ ① 档欠条：这 6 个不露脸就当场出局（票 03 / 票 10 的裁定）
    expect(text).toContain(INTENT.targetExperience);
    expect(text).toContain(INTENT.world.atmosphere);
    expect(text).toContain(INTENT.player.role);
    expect(text).toContain(INTENT.subgenre!);
    expect(text).toContain(INTENT.camera!);
    expect(text).toContain(INTENT.entities[0]!.role);
  });

  it("三个照抄值**递给了模型**（它照抄、装配时覆盖）—— 与票 08 让模型照抄 `style.id` 同款", async () => {
    const s = stage([res(reply(designFromModel()))]);
    await compileDesign(input({ fetchImpl: s.f }));
    const text: string = s.seen[0]!["messages"][0].content[0].text;
    expect(text).toContain(PLATFORMER_V1.id);
    expect(text).toContain(VWS.camera.mode);
    expect(text).toContain("照抄");
  });

  it("模型面向的 schema **就是契约本身**（16 键、封口）", async () => {
    const s = stage([res(reply(designFromModel()))]);
    await compileDesign(input({ fetchImpl: s.f }));
    const schema = s.seen[0]!["tools"][0].input_schema;
    expect(Object.keys(schema.properties)).toHaveLength(16);
    expect(schema.additionalProperties).toBe(false);
  });

  it("强制工具调用、关 thinking、`max_tokens` 与前三发同档；说明里带着封闭枚举那条规矩", async () => {
    const s = stage([res(reply(designFromModel()))]);
    await compileDesign(input({ fetchImpl: s.f }));
    const b = s.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: DESIGN_TOOL_NAME });
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000);
    expect(b.tools[0].description).toContain("整条省掉");   // 做不了就别编近似的
  });
});

describe("成功那一趟", () => {
  it("三个照抄值被覆盖成调用方那份 + 一格账（首发就成 ⇒ 没有 `failures`）", async () => {
    const s = stage([res(reply(designFromModel()))]);
    const r = await compileDesign(input({ fetchImpl: s.f }));
    expect(r.spec.game.genre).toBe(PLATFORMER_V1.id);
    expect(r.spec.game.camera).toBe(VWS.camera.mode);
    expect(r.spec.game.runtimeProfile).toEqual({ id: PLATFORMER_V1.id, version: PLATFORMER_V1.version });
    const call = r.ledger![0]!;
    expect(call.step).toBe("compile-design");
    expect(call.target).toBe("game-design");
    expect(call.attempts).toBe(1);
    expect(call.failures).toBeUndefined();
    expect(call.model).toBe("deepseek-flash");
    expect(call.requestedModel).toBe("deepseek-v4-pro");
    expect(call.usage).toEqual({ inputTokens: 2400, outputTokens: 2600 });
  });
});

describe("⚠️ R12 的拒绝：**不重采样、不进 `failures[]`**（Q3c）", () => {
  it("意图里有条机制没做成 ⇒ `DesignRejectedError`，**只走一趟**，账上**没有失败痕迹**", async () => {
    const s = stage([res(reply(designFromModel({ mechanics: [{ id: "m-jump", mechanic: "jump" }] })))]);
    const err = await compileDesign(input({ fetchImpl: s.f })).catch((e) => e);
    expect(err).toBeInstanceOf(DesignRejectedError);
    expect(err.rejections.map((x: { reason: string }) => x.reason)).toEqual(["intent-mechanic-missing"]);
    expect(err.message).toContain("二段跳");
    expect(s.calls()).toBe(1);                       // ⚠️ 重抽同一份意图抽一百次也还是做不出来
    expect(err.ledger![0]!.attempts).toBe(1);
    expect(err.ledger![0]!.failures).toBeUndefined();  // ⚠️ 那一发上游调用是**成功**的
  });

  it("相机承载不了 ⇒ 也是拒绝那一档（不是 `CompileDesignError`）", async () => {
    const s = stage([res(reply(designFromModel()))]);
    const err = await compileDesign(input({ fetchImpl: s.f, vws: { ...VWS, camera: { mode: "top-down" } } })).catch((e) => e);
    expect(err).toBeInstanceOf(DesignRejectedError);
    expect(err.rejections[0].reason).toBe("camera-unsupported");
    expect(s.calls()).toBe(1);
  });
});

describe("重采样：只有「模型没干好」那一档才重来（R16）", () => {
  it("首发不过契约、第二发过 ⇒ `attempts: 2`、`failures: [\"schema\"]`", async () => {
    const s = stage([res(reply({ ...designFromModel(), world: { theme: "", setting: "", structure: "" } })), res(reply(designFromModel()))]);
    const r = await compileDesign(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("`empty-input` 重来两发要**都留着**", async () => {
    const s = stage([res(reply({})), res(reply({})), res(reply(designFromModel()))]);
    const r = await compileDesign(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.failures).toEqual(["empty-input", "empty-input"]);
  });

  it("三发全败 ⇒ 抛错，账跟着错一起出来（`failures` 长度 == 地板值）", async () => {
    const s = stage([res(reply({}))]);
    const err = await compileDesign(input({ fetchImpl: s.f })).catch((e) => e);
    expect(err).toBeInstanceOf(CompileDesignError);
    expect(err.ledger![0]!.failures).toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    expect(s.calls()).toBe(STRUCTURED_CALL_ATTEMPTS);
  });
});

describe("传输层的失败 **不重采样**", () => {
  it("HTTP 500 ⇒ 立刻抛，只走一趟，病因进 `failures[]`", async () => {
    const s = stage([res({ error: "boom" }, 500), res(reply(designFromModel()))]);
    const err = await compileDesign(input({ fetchImpl: s.f })).catch((e) => e);
    expect(err).toBeInstanceOf(CompileDesignError);
    expect(err.failure).toBe("http");
    expect(s.calls()).toBe(1);
    expect(err.ledger![0]!.failures).toEqual(["http"]);
  });

  it("超时 ⇒ `timeout`，报错说得出「已中止」", async () => {
    const s = stage([() => new Promise<Response>((_, rej) => setTimeout(() => rej(new Error("aborted")), 0))]);
    const err = await compileDesign(input({ fetchImpl: s.f, timeoutMs: 1 })).catch((e) => e);
    expect(err.failure).toBe("timeout");
    expect(err.message).toContain("已中止");
  });
});

describe("出发前的三处「免费」拦停 —— 都在第一个请求上路之前", () => {
  it("凭据没配 ⇒ 普通 `Error`", async () => {
    await expect(compileDesign(input({ transport: { baseUrl: "", apiKey: "" } }))).rejects.toThrowError(/文本上游没配/);
  });

  it("⚠️ 调用方给的意图**自己都不过契约** ⇒ 普通 `Error`（手改过的 `game-intent.json` 在这里就该响）", async () => {
    const bad = { ...INTENT, genre: "  " };   // 意图层那条 gate 拦的就是它
    await expect(compileDesign(input({ intent: bad }))).rejects.toThrowError(/不过它自己的契约/);
  });

  it("给了一代不存在的外壳 ⇒ 普通 `Error`（这是**调用方**的错，不是设计的错）", async () => {
    await expect(compileDesign(input({ runtimeProfile: { id: "tower-defense", version: "1" } })))
      .rejects.toThrowError(/没有这一代外壳/);
  });
});
