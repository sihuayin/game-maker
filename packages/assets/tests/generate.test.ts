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
    expect(framePlan({ ...PLAYER, kind: "sprite" } as AssetSpec)).toEqual([{ name: "player", anim: null, layer: null, index: 0, total: 1 }]);
    expect(framePlan(PLAYER)).toEqual([
      { name: "player.idle", anim: "idle", layer: null, index: 0, total: 1 },
      { name: "player.walk1", anim: "walk", layer: null, index: 0, total: 2 },
      { name: "player.walk2", anim: "walk", layer: null, index: 1, total: 2 },
    ]);
  });
});

/**
 * 票 40 在「真跑第一个包」时抓到的：`framePlan` 曾有**两份实现**（`prompt.ts` 与 `pack.ts`），
 * 而票 42 给「分层背景」加那一支时**只改了一半** —— 提示词仍然告诉模型「只需一帧」，
 * 组装侧却期待三帧。两边各写一份必然漂移，这一次漂的是**提示词与组装之间**。
 */
describe("framePlan：帧名只此一份（票 40）", () => {
  it("animation：按动画顺序分配，多帧带序号、单帧不带", () => {
    expect(framePlan(PLAYER).map((p) => p.name)).toEqual(["player.idle", "player.walk1", "player.walk2"]);
  });

  it("分层背景：一层一帧，帧名 `<资源 id>.<层名>`，且带上层名给提示词用", () => {
    const bg: AssetSpec = {
      kind: "background", id: "station", role: "backdrop", description: "站台", styleId: "s-ref",
      anchor: { x: 0, y: 0 }, size: { w: 320, h: 180 }, dependencies: [], required: true,
      layers: [{ name: "sky", parallax: 0 }, { name: "wall", parallax: 0.5, tileable: { x: true, y: false } }],
    };
    const plan = framePlan(bg);
    expect(plan.map((p) => p.name)).toEqual(["station.sky", "station.wall"]);
    expect(plan.map((p) => p.layer)).toEqual(["sky", "wall"]);
    expect(plan.every((p) => p.anim === null)).toBe(true);
  });

  it("单帧资源：帧名就是资源 id", () => {
    const s: AssetSpec = {
      kind: "sprite", id: "crate", role: "prop", description: "货箱", styleId: "s-ref",
      anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, dependencies: [], required: true,
    };
    expect(framePlan(s).map((p) => p.name)).toEqual(["crate"]);
  });

  it("提示词要为分层背景说「一次给全部层」，且说清每层都画满整块画布", () => {
    const bg: AssetSpec = {
      kind: "background", id: "station", role: "backdrop", description: "黄昏站台", styleId: "s-ref",
      anchor: { x: 0, y: 0 }, size: { w: 320, h: 180 }, dependencies: [], required: true,
      layers: [{ name: "sky", parallax: 0 }, { name: "ground", parallax: 1, tileable: { x: true, y: false } }],
    };
    const p = renderPrompt(bg, STYLE);
    expect(p).toMatch(/2 层/);
    expect(p).toMatch(/层名 sky/);
    expect(p).toMatch(/不要把画布横切成几条/);
  });

  it("提示词要为九宫格说清「四边原样、中央被拉伸」", () => {
    const ui: AssetSpec = {
      kind: "ui", id: "hud-panel", role: "hud", description: "HUD 面板", styleId: "s-ref",
      anchor: { x: 0, y: 0 }, size: { w: 48, h: 32 }, dependencies: [], required: true,
      ninePatch: { left: 4, right: 4, top: 4, bottom: 4 },
    };
    const p = renderPrompt(ui, STYLE);
    expect(p).toMatch(/九宫格/);
    expect(p).toMatch(/只有中央区会被拉伸/);
    // 单帧资源不该被说成「多层」
    expect(p).not.toMatch(/层名/);
  });
});

/** 票 40：锚点此前**从没进过提示词** —— 于是模型自己挑了一个位置画，
 *  而清单声明的锚点在另一处，壳子对齐的是声明的那条线，角色就悬空了 4.6px。 */
describe("锚点要进提示词（票 40）", () => {
  const crate: AssetSpec = {
    kind: "sprite", id: "crate", role: "prop", description: "货箱", styleId: "s-ref",
    anchor: { x: 0.5, y: 0.8 }, size: { w: 40, h: 40 }, dependencies: [], required: true,
  };
  it("把归一化锚点换算成画布上的行与列说清楚", () => {
    const p = renderPrompt(crate, STYLE);
    expect(p).toMatch(/第 32\.0 行/);      // 0.8 × 40
    expect(p).toMatch(/第 20\.0 列/);      // 0.5 × 40
    expect(p).toMatch(/底边就压在那条横线上/);
  });
  it("明确说腾空的帧是例外 —— 否则 jump 会被画成站在地上，腾空动作消失", () => {
    expect(renderPrompt(PLAYER, STYLE)).toMatch(/腾空的帧例外/);
  });
});
