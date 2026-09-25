import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DrawListSchema, paletteBindingOf, parseDrawList, resolveRefs, boundsOfOps,
  type DrawList, type DrawListOp,
} from "../src/index.js";

/** 仓库根的 fixtures/drawlist/ —— Q9 精神：fixture 入库，产物不入库。 */
const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/drawlist/", import.meta.url));
const fixture = (name: string): DrawList => JSON.parse(readFileSync(FIXTURE_DIR + name, "utf8"));
const ALL = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json")).sort();

/** 票 22 实验里那份真实 StyleSpec 的色板（大写，未规范化 —— 规范化归票 37）。 */
const PALETTE_A = ["#7C968E", "#55685F", "#A9B7AC", "#3E3236", "#C3CDC9", "#EAD8A6", "#C4694A", "#4EBBA4", "#6D8F52"];
const PALETTE_B = ["#101820", "#1E2A38", "#2E4257", "#4C6B84", "#8FB3C9", "#E8F1F5", "#FF4D6D", "#00E5A0", "#B36BFF"];

describe("DrawListSchema —— 真实产物必须原样通过", () => {
  it("原型里 8 个 (asset, frame) 组合全部合法", () => {
    expect(ALL).toHaveLength(8);
    for (const f of ALL) {
      const r = parseDrawList(fixture(f));
      expect(r.ok, `${f}: ${r.ok ? "" : r.errors.join(" / ")}`).toBe(true);
    }
  });

  it("覆盖了全部六种 op", () => {
    const seen = new Set(ALL.flatMap((f) => fixture(f).ops.map((o) => o.op)));
    expect([...seen].sort()).toEqual(["circle", "ellipse", "line", "poly", "rect"]);
    // curve 不在原型 GEOM 里（它是 B→E 的转换产物），单独构造覆盖
    expect(DrawListSchema.safeParse({ ...fixture("tomato.growing.json"), ops: [{ op: "curve", points: [[0, 0], [4, 4]], stroke: "palette:1" }] }).success).toBe(true);
  });
});

describe("dither —— 唯一不出色板的调色手段（票 22）", () => {
  const base = fixture("tomato.growing.json");
  const dither = { op: "dither", x: 0, y: 8, w: 32, h: 8, colors: ["palette:1", "palette:2"], ratio: 0.35, pattern: "bayer4" } as const;

  it("合法 dither 通过；包围盒精确（它就是一块矩形）", () => {
    const r = parseDrawList({ ...base, ops: [dither] });
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
    const b = boundsOfOps([dither as never]);
    expect(b.exact).toBe(true);
    expect(b.box).toMatchObject({ x: 0, y: 8, w: 32, h: 8 });
  });

  it("⚠️ 含 dither 的资源 paletteBinding 仍是 exact —— 它不做 alpha 混合", () => {
    expect(paletteBindingOf([dither as never])).toBe("exact");
  });

  it("两个颜色都会被 resolveRefs 收到（它们在 colors 元组里，不在 fill/stroke 上）", () => {
    const { used, off } = resolveRefs([dither as never], PALETTE_A);
    expect(off).toEqual([]);
    expect(used).toEqual([PALETTE_A[1], PALETTE_A[2]]);
  });

  it("颜色数不是 2 被拒 · pattern 不认识被拒 · ratio 越界被拒 · 硬编码色被拒", () => {
    expect(parseDrawList({ ...base, ops: [{ ...dither, colors: ["palette:1"] }] }).ok).toBe(false);
    expect(parseDrawList({ ...base, ops: [{ ...dither, colors: ["palette:1", "palette:2", "palette:3"] }] }).ok).toBe(false);
    expect(parseDrawList({ ...base, ops: [{ ...dither, pattern: "bayer8" }] }).ok).toBe(false);
    expect(parseDrawList({ ...base, ops: [{ ...dither, ratio: 1.5 }] }).ok).toBe(false);
    expect(parseDrawList({ ...base, ops: [{ ...dither, colors: ["#FF00FF", "palette:2"] }] }).ok).toBe(false);
  });
});

describe("非法输入：报错必须能定位", () => {
  it("硬编码颜色被拒（#FF00FF 不是 palette 引用）", () => {
    const dl = fixture("tomato.ripe.json");
    dl.ops[1] = { ...dl.ops[1], fill: "#FF00FF" } as DrawListOp;
    const r = parseDrawList(dl);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toContain("ops[1].fill");
    expect(r.errors.join("\n")).toMatch(/palette:<下标>/);
  });

  it("非数值坐标被拒，且错误定位到 ops[1].cy", () => {
    const dl = fixture("tomato.ripe.json");
    // 一个「AI 会吐出来的典型坏数据」：坐标被写成了字符串
    dl.ops[1] = { ...dl.ops[1], cy: "20" } as unknown as DrawListOp;
    const r = parseDrawList(dl);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith("ops[1].cy"))).toBe(true);
  });

  it("curve 点数不足被拒", () => {
    const r = parseDrawList({ ...fixture("tomato.growing.json"), ops: [{ op: "curve", points: [[0, 0]], stroke: "palette:1" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/curve 至少 2 个点/);
  });

  it("poly 点数不足 3 被拒", () => {
    const r = parseDrawList({ ...fixture("tomato.growing.json"), ops: [{ op: "poly", points: [[0, 0], [4, 4]], fill: "palette:1" }] });
    expect(r.ok).toBe(false);
  });

  it("非有限数值被拒（NaN / Infinity 不是合法坐标）", () => {
    const r = parseDrawList({ ...fixture("tomato.growing.json"), ops: [{ op: "rect", x: 0, y: 0, w: Number.NaN, h: 4, fill: "palette:1" }] });
    expect(r.ok).toBe(false);
  });

  it("版本号写错被拒", () => {
    const r = parseDrawList({ ...fixture("tomato.growing.json"), format: "drawlist+path/v1" });
    expect(r.ok).toBe(false);
  });

  it("缺 `frame` 被拒 —— 这条断言是从真实产物里长出来的", () => {
    // 证据：experiments/animated-player/frame.*.json 六份全部缺这个字段。
    // 根因是 gen_player.mjs 第 90 行摊平多帧响应时 `{...o, states:undefined, ops}` 忘了写它。
    // 结论：帧名**必填** —— 它是最小自描述，也是资源包 manifest 里 frames[].name 的**主来源**
    // （主来源在产物里，索引在 manifest 里；反过来才是制造漂移）。
    const { frame: _drop, ...withoutFrame } = fixture("tomato.ripe.json");
    const r = parseDrawList(withoutFrame);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toContain("frame");
  });

  it("多帧文档（一次调用出全部帧）不是落盘形态", () => {
    // experiments/animated-player/player.states.json 是这个形状：顶层 states 映射而非 ops。
    // 它是**生成期的暂存形态**（票 22 证明单次调用才能保证帧间同一性），落盘前必须摊平成
    // 一个 (asset, frame) 一份 —— 票 26 维持了这个裁定（形状 A 唯一落盘）。
    const multi = { format: "drawlist+curve/v1", id: "player", viewBox: [0, 0, 24, 32], expectedSize: [24, 32], states: { idle: { ops: [] } } };
    expect(parseDrawList(multi).ok).toBe(false);
  });

  it("多出未知字段被拒（strict）", () => {
    const r = parseDrawList({ ...fixture("tomato.growing.json"), 注释: "AI 顺手加的" });
    expect(r.ok).toBe(false);
  });
});

describe("boundsOfOps —— 精确 vs 保守上界", () => {
  it("纯数值图元是精确的", () => {
    const { box, exact } = boundsOfOps(fixture("tomato.ripe.json").ops);
    expect(exact).toBe(true);
    expect(box).not.toBeNull();
    // tomato.ripe: circle r=8 @ (16,20) → x∈[8,24]；
    // 最低点是那条 y1=9 的 line，描边半宽 1 ⇒ y=8
    expect(box!.x).toBeCloseTo(8, 5);
    expect(box!.w).toBeCloseTo(16, 5);
    expect(box!.y).toBeCloseTo(8, 5);
  });

  it("含 curve 时明确标注为上界（exact=false）", () => {
    const ops: DrawListOp[] = [
      { op: "rect", x: 0, y: 0, w: 10, h: 10, fill: "palette:1" },
      { op: "curve", points: [[0, 0], [20, 20]], stroke: "palette:1", strokeWidth: 2 },
    ];
    const { box, exact } = boundsOfOps(ops);
    expect(exact).toBe(false);              // ← 调用方没机会忘记这是上界
    expect(box!.x).toBeCloseTo(-1, 5);      // 控制点最小 x = 0，再外扩 strokeWidth/2 = 1
    expect(box!.w).toBeCloseTo(22, 5);      // [-1, 21]
  });

  it("描边把包围盒外扩半宽（poly 也要，原型的实现漏了这一项）", () => {
    const noStroke = boundsOfOps([{ op: "poly", points: [[0, 0], [10, 0], [10, 10]], fill: "palette:1" }]).box!;
    const stroked = boundsOfOps([{ op: "poly", points: [[0, 0], [10, 0], [10, 10]], fill: "palette:1", stroke: "palette:2", strokeWidth: 4 }]).box!;
    expect(noStroke.w).toBe(10);
    expect(stroked.w).toBe(14);             // 每侧 +2
  });

  it("curve 的包围盒确实是实际曲线的上界（用密集采样验证）", () => {
    const pts: [number, number][] = [[0, 0], [10, 20], [30, 5], [40, 25]];
    const { box } = boundsOfOps([{ op: "curve", points: pts, stroke: "palette:1" }]);
    // 采样 Catmull-Rom，逐点确认落在 box 内
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
      for (let t = 0; t <= 1; t += 0.01) {
        const t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        expect(x).toBeGreaterThanOrEqual(box!.x);
        expect(y).toBeGreaterThanOrEqual(box!.y);
        expect(x).toBeLessThanOrEqual(box!.x + box!.w);
        expect(y).toBeLessThanOrEqual(box!.y + box!.h);
      }
    }
  });

  it("尺寸校验只判过大：cow 的 viewBox 是 64×48 而 expectedSize 是 80×80（原型里故意的错配）", () => {
    const dl = fixture("cow.idle.json");
    const { box, exact } = boundsOfOps(dl.ops);
    expect(exact).toBe(true);
    const [ew, eh] = dl.expectedSize;
    const overshoot = Math.max(box!.w / ew, box!.h / eh);
    expect(overshoot).toBeLessThan(1.35);   // 上界仍在容差内
    expect(box!.w).toBeLessThanOrEqual(ew); // 而且没有超出
  });
});

describe("resolveRefs —— 用色与越界", () => {
  it("把 palette:N 解析成实际色值", () => {
    const { used, off } = resolveRefs(fixture("tomato.ripe.json").ops, PALETTE_A);
    expect(off).toEqual([]);
    expect(used).toContain(PALETTE_A[3]);
  });

  it("索引越界被报出来", () => {
    const { off } = resolveRefs([{ op: "rect", x: 0, y: 0, w: 1, h: 1, fill: "palette:99" }], PALETTE_A);
    expect(off).toEqual(["palette:99"]);
  });
});

describe("paletteBindingOf —— 解析期静态判定（票 36）", () => {
  it("没有 opacity → exact", () => {
    expect(paletteBindingOf(fixture("cow.idle.json").ops)).toBe("exact");
  });

  it("带 opacity → composited（tomato.ripe 的高光就是）", () => {
    const ops = fixture("tomato.ripe.json").ops;
    expect(ops.some((o) => o.op !== "dither" && o.opacity !== undefined)).toBe(true);
    expect(paletteBindingOf(ops)).toBe("composited");
  });
});

describe("换色板后创作态文本一字不变", () => {
  it("换掉整个色板，drawlist 文本逐字节相同、交付态用色全变", () => {
    const text = readFileSync(FIXTURE_DIR + "tomato.ripe.json", "utf8");
    const dl = JSON.parse(text) as DrawList;

    const before = resolveRefs(dl.ops, PALETTE_A).used;
    const after = resolveRefs(dl.ops, PALETTE_B).used;
    expect(after).not.toEqual(before);              // 交付态确实变了
    expect(text).toBe(JSON.stringify(dl, null, 2) + "\n"); // 创作态一字未动
    expect(text).not.toMatch(/#[0-9a-fA-F]{6}/);    // 而且文本里根本没有色值
  });
});
