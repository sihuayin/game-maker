import { describe, expect, it, vi } from "vitest";
import type { AssetSpec, StyleSpec } from "@game-maker/contracts";
import { createDrawListGenerator, renderPrompt, stripFences, GenerationError, framePlan, headCount } from "../src/index.js";

const STYLE: StyleSpec = {
  id: "s", identity: ["pixel-art"], camera: {}, composition: {},
  palette: ["#7c968e", "#55685f", "#a9b7ac"], lighting: {}, shapeLanguage: ["hard-edged rectangles"],
  material: ["pixel dithering", "rust streaks"], environment: [], characterStyle: ["semi-realistic adult proportions (~6 heads)"],
  constraints: ["no pure black or pure white"], confidence: 0.9,
};

const PLAYER: AssetSpec = {
  kind: "animation", id: "player", role: "protagonist", description: "玩家角色", styleId: "s-ref",
  anchor: { x: 0.5, y: 0.92 }, size: { w: 24, h: 32 }, dependencies: [], required: true,
  animations: [{ name: "idle", frames: 1, loop: true }, { name: "walk", frames: 2, loop: true }],
};

const op = (i = 1) => ({ op: "rect", x: 0, y: 0, w: 4, h: 4, fill: `palette:${i % 3}` });
const okBody = (n: number, ops: unknown[] = [op()]) => ({
  content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, (_, i) => ({ name: `f${i}`, ops })) }) }],
  stop_reason: "end_turn",
});

/** 一个按顺序吐预设响应的假 fetch。 */
const fakeFetch = (responses: { status?: number; body: unknown }[]): typeof fetch => {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body, text: async () => JSON.stringify(r.body) } as Response;
  }) as typeof fetch;
};

const gen = (fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
  createDrawListGenerator({ baseUrl: "http://x", apiKey: "k", fetchImpl, ...over });

describe("生成器 —— 成功路径", () => {
  it("一次调用出全部帧，顺序与 framePlan 一致，viewBox 来自 spec.size", async () => {
    const g = gen(fakeFetch([{ body: okBody(3) }]));
    const frames = await g(PLAYER, STYLE);
    expect(frames).toHaveLength(3);
    expect(frames.map((f) => f.frame)).toEqual(["idle", "walk1", "walk2"]);
    for (const f of frames) {
      expect(f.id).toBe("player");
      expect(f.viewBox).toEqual([0, 0, 24, 32]);
      expect(f.expectedSize).toEqual([24, 32]);
      expect(f.format).toBe("drawlist+curve/v1");
    }
  });

  it("⚠️ 只调**一次** —— 一个 asset 的全部帧在一次调用里出来（那正是帧间一致性的来源）", async () => {
    const spy = vi.fn(fakeFetch([{ body: okBody(3) }]));
    await gen(spy as unknown as typeof fetch)(PLAYER, STYLE);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("用 POST /v1/messages + x-api-key（票 01 的 chat/completions 那条路已不通）", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const spy = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => okBody(3) } as Response; }) as unknown as typeof fetch;
    await gen(spy)(PLAYER, STYLE);
    expect(seen[0]!.url).toBe("http://x/v1/messages");
    const h = seen[0]!.init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("k");
    const body = JSON.parse(seen[0]!.init.body as string);
    expect(body.thinking).toEqual({ type: "disabled" });   // 开着会吃光输出预算
    expect(body.max_tokens).toBeGreaterThanOrEqual(32_000); // 14 帧要 ~14k，8192 会被截断
  });
});

describe("生成器 —— 失败必须说清是哪一种", () => {
  it("帧数对不上 → 报清单要几帧、模型给了几帧", async () => {
    await expect(gen(fakeFetch([{ body: okBody(5) }]))(PLAYER, STYLE)).rejects.toThrow(/清单要 3 帧，模型给了 5 帧/);
  });

  it("某一帧不过 schema → 报**第几帧**和路径", async () => {
    const bad = { frames: [{ name: "a", ops: [op()] }, { name: "b", ops: [op()] }, { name: "c", ops: [{ op: "rect", x: 0, y: 0, w: 1, h: 1, fill: "#FF00FF" }] }] };
    await expect(gen(fakeFetch([{ body: { content: [{ type: "text", text: JSON.stringify(bad) }], stop_reason: "end_turn" } }]))(PLAYER, STYLE))
      .rejects.toThrow(/第 3 帧不过 schema：ops\.0\.fill/);
  });

  it("⚠️ 撞上 max_tokens 与「吐坏 JSON」分开报 —— 表现一样，原因完全不同", async () => {
    await expect(gen(fakeFetch([{ body: { content: [{ type: "text", text: '{"frames":[{"op' }], stop_reason: "max_tokens" } }]))(PLAYER, STYLE))
      .rejects.toThrow(/撞上了 max_tokens.*被截断/);
  });

  it("HTTP 非 2xx → 带上上游的响应体片段（否则只看到个状态码）", async () => {
    await expect(gen(fakeFetch([{ status: 403, body: { error: { message: "Insufficient account balance" } } }]))(PLAYER, STYLE))
      .rejects.toThrow(/HTTP 403.*Insufficient account balance/);
  });

  it("顶层没有 frames 数组 → 报出实际的顶层键", async () => {
    await expect(gen(fakeFetch([{ body: { content: [{ type: "text", text: '{"drawlist":{"ops":[]}}' }], stop_reason: "end_turn" } }]))(PLAYER, STYLE))
      .rejects.toThrow(/没有 frames 数组（顶层键：drawlist）/);
  });

  it("错误类型是 GenerationError，且带着 assetId", async () => {
    // 端口的返回类型是 DrawList[] | Promise<DrawList[]>，所以不能直接 .catch —— 用 try/catch
    let e: unknown;
    try { await gen(fakeFetch([{ body: okBody(5) }]))(PLAYER, STYLE); } catch (x) { e = x; }
    expect(e).toBeInstanceOf(GenerationError);
    expect((e as GenerationError).assetId).toBe("player");
  });
});

describe("有界重试", () => {
  it("第一次吐坏 JSON、第二次正常 → 成功（偶发失败不该让整包挂掉）", async () => {
    const g = gen(fakeFetch([
      { body: { content: [{ type: "text", text: "{坏了" }], stop_reason: "end_turn" } },
      { body: okBody(3) },
    ]));
    await expect(g(PLAYER, STYLE)).resolves.toHaveLength(3);
  });

  it("两次都失败 → 报出来试了几次", async () => {
    await expect(gen(fakeFetch([{ body: { content: [{ type: "text", text: "{坏了" }], stop_reason: "end_turn" } }]))(PLAYER, STYLE))
      .rejects.toThrow(/2 次都没成功/);
  });

  it("attempts=1 时只试一次", async () => {
    const spy = vi.fn(fakeFetch([{ body: { content: [{ type: "text", text: "{坏了" }], stop_reason: "end_turn" } }]));
    await expect(gen(spy as unknown as typeof fetch, { attempts: 1 })(PLAYER, STYLE)).rejects.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("prompt 渲染器（生成与推导共用）", () => {
  const p = renderPrompt(PLAYER, STYLE);
  it("带上了色板（下标 ↔ 色值一一对上）", () => {
    expect(p).toContain("0:#7c968e  1:#55685f  2:#a9b7ac");
  });
  it("带上了 dither 的说明 —— 材质全靠它", () => {
    expect(p).toMatch(/dither.*唯一不出色板/s);
  });
  it("带上了风格约束", () => {
    expect(p).toContain("pixel dithering");
    expect(p).toContain("no pure black or pure white");
  });
  it("few-shot 示例里演示了「只改该动的部位」", () => {
    expect(p).toMatch(/头与躯干的 ops 两帧完全相同/);
  });
  it("⚠️ 头身比从 spec.size 推，不抄 characterStyle 的自由文本", () => {
    expect(headCount(32)).toBe(3);
    expect(p).toContain("约 3 头身");
    expect(p).not.toContain("~6 heads");     // 参考图说 6 头身，但 32×48 画不下
  });
  it("明确要求一次给出全部帧", () => {
    expect(p).toMatch(/必须一次给出全部帧/);
  });
});

describe("小工具", () => {
  it("stripFences 剥掉 markdown 围栏（关 thinking 的副作用）", () => {
    expect(stripFences("```json\n{\"a\":1}\n```")).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
    expect(stripFences("```\n{\"a\":1}\n```")).toBe('{"a":1}');
  });
  it("framePlan：sprite 一帧，animation 按 animations 顺序展开", () => {
    expect(framePlan({ ...PLAYER, kind: "sprite" } as AssetSpec)).toEqual([{ anim: null, index: 0, total: 1 }]);
    expect(framePlan(PLAYER)).toEqual([
      { anim: "idle", index: 0, total: 1 },
      { anim: "walk", index: 0, total: 2 }, { anim: "walk", index: 1, total: 2 },
    ]);
  });
});
