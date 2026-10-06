// `compileCharacterDna` 的判据 —— 全部用假 `fetch`（**不发真请求、不花钱**）。
//
// ⚠️ 与 `compile-design.test.ts` 的**结构差别**只有一处，但它是本票的一个结论：
//   这里**没有第二条错误路** —— DNA 那一侧没有 R12 那种「拒绝」（拒绝面在票 10 与票 15）。
//   于是「模型没干好」与「做不出来」在这里**分不开也不需要分**：只有 `CompileCharacterDnaError`。
import { describe, expect, it } from "vitest";
import { CHARACTER_DNA_FORMAT, STRUCTURED_CALL_ATTEMPTS } from "@game-maker/contracts";
import {
  CHARACTER_DNA_TOOL_NAME, CHARACTER_SET_GATE, CompileCharacterDnaError, compileCharacterDna,
  type CompileCharacterDnaInput,
} from "../src/index.js";
import { DESIGN, VWS, VWS_CLASS, dnaFile, dnaRecord } from "./fixtures.js";

const reply = (input: unknown, stopReason = "tool_use") =>
  ({ content: [{ type: "tool_use", name: CHARACTER_DNA_TOOL_NAME, input }], stop_reason: stopReason,
     model: "deepseek-flash", usage: { input_tokens: 1800, output_tokens: 900 } });
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

const input = (over: Partial<CompileCharacterDnaInput> = {}): CompileCharacterDnaInput => ({
  design: DESIGN, vws: VWS_CLASS,
  transport: { baseUrl: "http://upstream.test", apiKey: "k" }, ...over,
});

describe("发出去的那一发", () => {
  it("内容**只有一段文本**，而世界那五格**逐个具名**地插进去了（`VWS.character` 的落点）", async () => {
    const s = stage([res(reply(dnaFile()))]);
    await compileCharacterDna(input({ fetchImpl: s.f }));
    const content = s.seen[0]!["messages"][0].content;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
    const text: string = content[0].text;
    for (const k of ["proportions", "silhouette", "poseLanguage", "clothing", "faceAbstraction"])
      expect(text).toContain(`character.${k}`);
    expect(text).toContain(VWS_CLASS.character.faceAbstraction!);      // 真值，不是只提了个名字
  });

  it("⚠️ **两个输入的「类」与「个体」都摊开了**，而且**逐个 id 给了**（id 沿用的兑现方式）", async () => {
    const s = stage([res(reply(dnaFile()))]);
    await compileCharacterDna(input({ fetchImpl: s.f }));
    const text: string = s.seen[0]!["messages"][0].content[0].text;
    expect(text).toContain("p-scavenger");
    expect(text).toContain("e-mutant");
    expect(text).toContain("n-merchant");
    expect(text).toContain("用废料换净水");                            // npcs[].interaction（① 档的具名插值）
    expect(text).toContain("沿月台往复巡逻");                          // enemies[].behavior
    // ⚠️ 没有基因的那几个也要被点名（免得模型顺手给木条箱写一份）
    expect(text).toContain("i-terminal");
    expect(text).toContain("没有基因");
  });

  it("模型面向的 schema **就是契约本身**（2 键、封口）", async () => {
    const s = stage([res(reply(dnaFile()))]);
    await compileCharacterDna(input({ fetchImpl: s.f }));
    const schema = s.seen[0]!["tools"][0].input_schema;
    expect(Object.keys(schema.properties)).toEqual(["format", "characters"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("强制工具调用、关 thinking、`max_tokens` 与前几发同档；说明里带着两条 schema 看不见的规矩", async () => {
    const s = stage([res(reply(dnaFile()))]);
    await compileCharacterDna(input({ fetchImpl: s.f }));
    const b = s.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: CHARACTER_DNA_TOOL_NAME });
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000);
    expect(b.tools[0].description).toContain("恰好一条");     // 构造性判据
    expect(b.tools[0].description).toContain("不许整句抄");   // 守门人那条的**语义**说法
    expect(b.tools[0].description).toContain('"none"');        // 空值 gate 那条
  });
});

describe("成功那一趟", () => {
  it("交出过完两条检查的一族 + 一格账（首发就成 ⇒ 没有 `failures`）", async () => {
    const s = stage([res(reply(dnaFile()))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(r.file.format).toBe(CHARACTER_DNA_FORMAT);
    expect(r.file.characters).toHaveLength(4);
    const call = r.ledger![0]!;
    expect(call.step).toBe("character-dna");
    expect(call.target).toBe("character-dna");
    expect(call.attempts).toBe(1);
    expect(call.failures).toBeUndefined();
    expect(call.model).toBe("deepseek-flash");
    expect(call.requestedModel).toBe("deepseek-v4-pro");
    expect(call.usage).toEqual({ inputTokens: 1800, outputTokens: 900 });
  });

  it("⚠️ **一次调用产一族**（N 条记录），而账仍然只有**一格**（一格 = 一次调用）", async () => {
    const s = stage([res(reply(dnaFile()))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(s.calls()).toBe(1);
    expect(r.ledger).toHaveLength(1);
    expect(r.file.characters.length).toBeGreaterThan(1);
  });
});

describe("重采样：只有「模型没干好」那一档才重来（R16）", () => {
  it("首发**少一条**、第二发补齐 ⇒ `attempts: 2`、`failures: [\"schema\"]`", async () => {
    const missing = dnaFile(dnaFile().characters.filter((c) => c.id !== "n-merchant"));
    const s = stage([res(reply(missing)), res(reply(dnaFile()))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("首发**抄了世界那一格**、第二发改写 ⇒ 也重来（两条检查同一档）", async () => {
    const copied = dnaFile().characters.map((c) => (c.id === "p-scavenger" ? { ...c, silhouette: VWS_CLASS.character.silhouette! } : c));
    const s = stage([res(reply(dnaFile(copied))), res(reply(dnaFile()))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.attempts).toBe(2);
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
  });

  it("三发全败 ⇒ 抛错，账跟着错一起出来（`failures` 长度 == 地板值），病因**说得出是哪一条检查**", async () => {
    const missing = dnaFile(dnaFile().characters.filter((c) => c.id !== "n-merchant"));
    const s = stage([res(reply(missing))]);
    const err = await compileCharacterDna(input({ fetchImpl: s.f })).catch((e) => e);
    expect(err).toBeInstanceOf(CompileCharacterDnaError);
    expect(err.ledger![0]!.failures).toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    expect(s.calls()).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(err.message).toContain(CHARACTER_SET_GATE);
  });
});

describe("传输层的失败 **不重采样**", () => {
  it("HTTP 500 ⇒ 立刻抛，只走一趟，病因进 `failures[]`", async () => {
    const s = stage([res({ error: "boom" }, 500), res(reply(dnaFile()))]);
    const err = await compileCharacterDna(input({ fetchImpl: s.f })).catch((e) => e);
    expect(err).toBeInstanceOf(CompileCharacterDnaError);
    expect(err.failure).toBe("http");
    expect(s.calls()).toBe(1);
    expect(err.ledger![0]!.failures).toEqual(["http"]);
  });

  it("超时 ⇒ `timeout`，报错说得出「已中止」", async () => {
    const s = stage([() => new Promise<Response>((_, rej) => setTimeout(() => rej(new Error("aborted")), 0))]);
    const err = await compileCharacterDna(input({ fetchImpl: s.f, timeoutMs: 1 })).catch((e) => e);
    expect(err.failure).toBe("timeout");
    expect(err.message).toContain("已中止");
  });
});

describe("出发前的两处「免费」拦停 —— 都在第一个请求上路之前", () => {
  it("凭据没配 ⇒ 普通 `Error`", async () => {
    await expect(compileCharacterDna(input({ transport: { baseUrl: "", apiKey: "" } }))).rejects.toThrowError(/文本上游没配/);
  });

  it("⚠️ 调用方给的**设计**自己都不过契约 ⇒ 普通 `Error`（手改过的 `game-design.json` 在这里就该响）", async () => {
    await expect(compileCharacterDna(input({ design: { ...DESIGN, world: { ...DESIGN.world, theme: "  " } } })))
      .rejects.toThrowError(/不过它自己的契约/);
  });

  it("世界也一样（`visual-world.json` 手改过 ⇒ 在这里响）", async () => {
    await expect(compileCharacterDna(input({ vws: { ...VWS_CLASS, format: "visual-world/v2" } as never })))
      .rejects.toThrowError(/不过它自己的契约/);
  });

  it("⚠️ 这三处拦停**不记账**（它们不是模型的错，不该烧重采样）", async () => {
    const err = await compileCharacterDna(input({ design: dnaFile() as never })).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(CompileCharacterDnaError);
  });
});

describe("⚠️ 本步**没有**第二条错误路（与 `compile-design` 的对照）", () => {
  it("少一个角色 / 抄了一格 —— 都是 `schema`，都由重采样治；这里**没有**「拒绝」那一档", async () => {
    const s = stage([res(reply(dnaFile([]))), res(reply(dnaFile()))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(r.ledger![0]!.failures).toEqual(["schema"]);
    expect(r.ledger![0]!.attempts).toBe(2);
  });

  it("`face` 写 `\"none\"` 是**对的**，不是失败（无人机没有脸这件事被说出来了）", async () => {
    const drone = dnaRecord("e-drone", { face: "none", clothing: "none", gear: [] });
    const s = stage([res(reply(dnaFile([dnaRecord("p-scavenger"), drone, dnaRecord("e-mutant"), dnaRecord("n-merchant")])))]);
    const r = await compileCharacterDna(input({ fetchImpl: s.f }));
    expect(r.file.characters[1]!.face).toBe("none");
    expect(s.calls()).toBe(1);                                   // 首发就成，没有重采样
  });
});
