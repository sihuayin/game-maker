import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDrawList, paletteBindingOf, type DrawList, type DrawListOp } from "@game-maker/contracts";
import {
  buildAtlas, decodePNG, encodePNG, inkBBox, paletteExactness, quantizeToPalette,
  rasterize, rasterizeToGrid, resizeNearest, RasterError,
} from "../src/index.js";

const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/drawlist/", import.meta.url));
const fixture = (n: string): DrawList => JSON.parse(readFileSync(FIXTURE_DIR + n, "utf8"));
const ALL = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json")).sort();
/** 与 packages/contracts 的测试同一份色板（票 22 实验的 StyleSpec）。 */
const PALETTE = ["#7C968E", "#55685F", "#A9B7AC", "#3E3236", "#C3CDC9", "#EAD8A6", "#C4694A", "#4EBBA4", "#6D8F52"];

describe("确定性 —— checksum 成立的前提", () => {
  it("同一份 drawlist 两次光栅化，逐字节相同", () => {
    for (const f of ALL) {
      const dl = fixture(f);
      const a = rasterize(dl, { palette: PALETTE });
      const b = rasterize(dl, { palette: PALETTE });
      expect(a.data.equals(b.data), `${f} 两次光栅化结果不同`).toBe(true);
      expect([a.width, a.height]).toEqual([b.width, b.height]);
    }
  });

  it("两次 PNG 编码逐字节相同", () => {
    const img = rasterize(fixture("cow.idle.json"), { palette: PALETTE });
    expect(encodePNG(img).equals(encodePNG(img))).toBe(true);
  });

  it("两次图集打包的矩形分配与 PNG 都相同", () => {
    const frames = ALL.map((f) => ({ name: f.replace(".json", ""), image: rasterize(fixture(f), { palette: PALETTE }) }));
    const a = buildAtlas(frames), b = buildAtlas(frames);
    expect(a.json).toEqual(b.json);
    expect(a.image.data.equals(b.image.data)).toBe(true);
  });
});

describe("六种 op 都能画出来", () => {
  const base = fixture("tomato.growing.json");
  const cases: [string, DrawListOp][] = [
    ["rect", { op: "rect", x: 2, y: 2, w: 10, h: 8, fill: "palette:1" }],
    ["circle", { op: "circle", cx: 8, cy: 8, r: 5, fill: "palette:2" }],
    ["ellipse", { op: "ellipse", cx: 8, cy: 8, rx: 6, ry: 3, fill: "palette:3" }],
    ["poly", { op: "poly", points: [[2, 2], [14, 4], [8, 14]], fill: "palette:4" }],
    ["line", { op: "line", x1: 1, y1: 1, x2: 15, y2: 15, stroke: "palette:5", strokeWidth: 2 }],
    ["curve", { op: "curve", points: [[2, 14], [6, 2], [12, 16]], stroke: "palette:6", strokeWidth: 2 }],
  ];
  for (const [name, op] of cases) {
    it(`${name} 画出了非透明像素`, () => {
      const img = rasterize({ ...base, ops: [op] }, { palette: PALETTE });
      const bb = inkBBox(img);
      expect(bb, `${name} 一个像素都没画出来`).not.toBeNull();
    });
  }
});

describe("dither —— 逐像素二选一，结果全在色板内", () => {
  /** viewBox 与抖动区一样大 —— 免得数到区外的像素（第一版就是这么写错的）。 */
  const only = (w: number, h: number, o: object) => ({ format: "drawlist+curve/v1", id: "swatch", frame: "f", viewBox: [0, 0, w, h], expectedSize: [w, h], ops: [o] }) as never;

  it("checker 恒为 50/50，且只用那两个色板色", () => {
    const img = rasterize(only(8, 8, { op: "dither", x: 0, y: 0, w: 8, h: 8, colors: ["palette:1", "palette:2"], ratio: 0.5, pattern: "checker" }), { palette: PALETTE });
    const ex = paletteExactness(img, PALETTE);
    expect(ex.exact).toBe(true);
    const counts = new Map<string, number>();
    for (let i = 0; i < 64; i++) { const s = i * 4; if (!img.data[s + 3]) continue; const k = `${img.data[s]},${img.data[s + 1]},${img.data[s + 2]}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
    expect([...counts.values()].sort()).toEqual([32, 32]);
  });

  it("ratio 真的控制混色比例（bayer4）", () => {
    const target = PALETTE[2]!.toLowerCase();
    const at = (ratio: number) => {
      const img = rasterize(only(16, 16, { op: "dither", x: 0, y: 0, w: 16, h: 16, colors: ["palette:1", "palette:2"], ratio, pattern: "bayer4" }), { palette: PALETTE });
      let second = 0;
      for (let i = 0; i < 256; i++) { const s = i * 4; const hex = "#" + [img.data[s], img.data[s + 1], img.data[s + 2]].map((v) => v!.toString(16).padStart(2, "0")).join(""); if (hex === target) second++; }
      return second / 256;
    };
    expect(at(0.25)).toBeCloseTo(0.25, 1);
    expect(at(0.75)).toBeCloseTo(0.75, 1);
  });

  it("抖动区之外是透明的（不会涂满整张画布）", () => {
    const img = rasterize(only(16, 16, { op: "dither", x: 0, y: 0, w: 8, h: 8, colors: ["palette:1", "palette:2"], ratio: 0.5, pattern: "checker" }), { palette: PALETTE });
    expect(img.data[(8 * 16 + 8) * 4 + 3]).toBe(0);   // (8,8) 在区外
  });
});

describe("失败必须报是哪个 asset 的哪个 op", () => {
  it("色板索引越界 —— schema 拦不住它，所以必须由光栅化器定位", () => {
    const dl = fixture("tomato.ripe.json");
    dl.ops[1] = { ...dl.ops[1], fill: "palette:99" } as DrawListOp;
    // 先确认它确实通过了 schema（这正是「坏数据通过校验、到渲染才炸」那一类）
    expect(parseDrawList(dl).ok).toBe(true);

    let err: unknown;
    try { rasterize(dl, { palette: PALETTE }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(RasterError);
    const e = err as RasterError;
    expect(e.assetId).toBe("tomato");
    expect(e.opIndex).toBe(1);
    expect(e.message).toBe('drawlist "tomato" ops[1]: 颜色引用 "palette:99" 越界（色板只有 9 项）');
  });

  it("非整数倍缩放被拒（像素风不放大数）", () => {
    expect(() => rasterize(fixture("cow.idle.json"), { palette: PALETTE, scale: 1.5 })).toThrow(/整数/);
  });
});

describe("目标尺寸与像素格", () => {
  it("最近邻放大 = 每个像素摊成 scale×scale 的方块", () => {
    const src = rasterize(fixture("tomato.growing.json"), { palette: PALETTE });
    const up = resizeNearest(src, src.width * 3, src.height * 3);
    expect([up.width, up.height]).toEqual([src.width * 3, src.height * 3]);
    for (let y = 0; y < up.height; y++)
      for (let x = 0; x < up.width; x++) {
        const s = (Math.floor(y / 3) * src.width + Math.floor(x / 3)) * 4, d = (y * up.width + x) * 4;
        expect([up.data[d], up.data[d + 1], up.data[d + 2], up.data[d + 3]])
          .toEqual([src.data[s], src.data[s + 1], src.data[s + 2], src.data[s + 3]]);
      }
  });

  it("放大不会引入色板外的插值色（双线性会）", () => {
    const src = rasterize(fixture("cow.idle.json"), { palette: PALETTE });
    for (const ps of [2, 3, 4]) {
      const up = rasterizeToGrid(fixture("cow.idle.json"), { palette: PALETTE, pixelScale: ps });
      expect(up.width).toBe(src.width * ps);
      expect(paletteExactness(up, PALETTE).exact, `${ps}× 放大后出现了色板外颜色`).toBe(true);
    }
  });
});

describe("paletteBinding 的静态判定与扫像素必须对得上（票 36 的交叉验证）", () => {
  it("静态判为 exact 的资源，扫像素也确实全在色板内", () => {
    for (const f of ALL) {
      const dl = fixture(f);
      if (paletteBindingOf(dl.ops) !== "exact") continue;
      const r = paletteExactness(rasterize(dl, { palette: PALETTE }), PALETTE);
      expect(r.exact, `${f} 静态判 exact，却扫出了色板外颜色 ${JSON.stringify(r.offPalette)}`).toBe(true);
    }
  });

  it("静态判为 composited 的资源，扫像素确实有色板外颜色（那是 alpha 复合，不是错误）", () => {
    const composited = ALL.filter((f) => paletteBindingOf(fixture(f).ops) === "composited");
    expect(composited.length).toBeGreaterThan(0);           // tomato.ripe 的高光就是
    for (const f of composited) {
      const r = paletteExactness(rasterize(fixture(f), { palette: PALETTE }), PALETTE);
      expect(r.exact, `${f} 静态判 composited，扫像素却没发现复合色`).toBe(false);
      expect(r.offPalette.length).toBeGreaterThan(0);
    }
  });
});

describe("量化 —— 光栅化与人工导入共用同一份实现", () => {
  it("本来就在色板里的图，量化不改任何像素", () => {
    const img = rasterize(fixture("cow.idle.json"), { palette: PALETTE });
    const q = quantizeToPalette(img, PALETTE);
    expect(q.changedPixels).toBe(0);
    expect(q.data.equals(img.data)).toBe(true);
  });

  it("色板外的颜色被吸附到最近色板色，并如实回报改了多少", () => {
    const img = rasterize(fixture("cow.idle.json"), { palette: PALETTE });
    // 把整张图往纯红推 —— 相当于一张「人工导入的、不受色板约束」的图
    for (let i = 0; i < img.width * img.height; i++) {
      const s = i * 4;
      if (img.data[s + 3] === 0) continue;
      img.data[s] = 255; img.data[s + 1] = 0; img.data[s + 2] = 0;
    }
    expect(paletteExactness(img, PALETTE).exact).toBe(false);
    const q = quantizeToPalette(img, PALETTE);
    expect(q.changedPixels).toBeGreaterThan(0);
    expect(paletteExactness(q, PALETTE).exact).toBe(true);   // 量化之后确实全在色板内
  });

  it("空色板被拒（没有可吸附的目标）", () => {
    expect(() => quantizeToPalette(rasterize(fixture("cow.idle.json"), { palette: PALETTE }), [])).toThrow(/色板为空/);
  });
});

describe("图集组装", () => {
  const frames = ALL.map((f) => {
    const dl = fixture(f);
    return { name: f.replace(".json", ""), image: rasterize(dl, { palette: PALETTE }), anchor: { x: 0.5, y: 1 } };
  });

  it("每帧都落在它声明的矩形上（逐像素核对）", () => {
    const { json, image } = buildAtlas(frames);
    for (const f of frames) {
      const j = json.frames[f.name]!;
      expect(j.frame.w).toBe(f.image.width);
      expect(j.frame.h).toBe(f.image.height);
      for (let r = 0; r < f.image.height; r++)
        for (let c = 0; c < f.image.width; c++) {
          const s = (r * f.image.width + c) * 4, d = ((j.frame.y + r) * image.width + j.frame.x + c) * 4;
          expect([image.data[d], image.data[d + 1], image.data[d + 2], image.data[d + 3]])
            .toEqual([f.image.data[s], f.image.data[s + 1], f.image.data[s + 2], f.image.data[s + 3]]);
        }
    }
  });

  it("anchor 与 scale9Borders 被原样写进 JSON（Phaser 真的会读这两个字段）", () => {
    const { json } = buildAtlas([{ ...frames[0]!, scale9Borders: { x: 2, y: 2, w: 44, h: 28 } }]);
    const j = json.frames[frames[0]!.name]!;
    expect(j.anchor).toEqual({ x: 0.5, y: 1 });
    expect(j.scale9Borders).toEqual({ x: 2, y: 2, w: 44, h: 28 });
  });

  it("写的是 TexturePacker JSON Hash：frames 是**对象**，且只有 Phaser 真读的字段", () => {
    const { json } = buildAtlas(frames);
    expect(Array.isArray(json.frames)).toBe(false);
    expect(Object.keys(json.frames)).toHaveLength(frames.length);
    expect(Object.keys(json.frames[frames[0]!.name]!).sort())
      .toEqual(["anchor", "frame", "rotated", "sourceSize", "spriteSourceSize", "trimmed"]);
    expect(json.meta).toMatchObject({ format: "RGBA8888", scale: 1 });
  });

  it("空输入被拒", () => {
    expect(() => buildAtlas([])).toThrow(/至少要有一帧/);
  });
});

describe("PNG 编解码", () => {
  it("编码再解码，逐字节回到原样（光栅化 → 落盘 → 人工导入是同一条通道）", () => {
    const img = rasterize(fixture("player.idle.json"), { palette: PALETTE });
    const back = decodePNG(encodePNG(img));
    expect([back.width, back.height]).toEqual([img.width, img.height]);
    expect(back.data.equals(img.data)).toBe(true);
  });

  it("非 PNG 输入被拒", () => {
    expect(() => decodePNG(Buffer.from("not a png at all"))).toThrow(/签名/);
  });
});
