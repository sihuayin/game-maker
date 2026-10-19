// 票 04：**确定性色板提取**（纯函数那一半）。
//
// ⚠️ 这一份只喂像素数组 —— 解码 PNG 是调用方（pipeline）的事（`vision` 只许依赖 `contracts`，
//   而 PNG 解码器住在 `assets`）。真图的 24/32 预览在 `packages/pipeline/tests/palette.test.ts`。
import { describe, expect, it } from "vitest";
import { VisualWorldSpecSchema, type VisualWorldSpec } from "@game-maker/contracts";
import { applyDeterministicPalette, buildVisualWorld, extractPalette, PALETTE_SIZE } from "../src/index.js";
import type { VisualWorldFromModel } from "../src/index.js";

type RGB = [number, number, number];
const px = (r: number, g: number, b: number, a = 255): [number, number, number, number] => [r, g, b, a];

/** 一张 64×64 的合成参考图：渐变 + 暖色块 + 高饱和块 + 全透明角。 */
const synthetic = () => {
  const w = 64, h = 64;
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: [number, number, number, number]) => {
    const s = (y * w + x) * 4;
    data[s] = c[0]; data[s + 1] = c[1]; data[s + 2] = c[2]; data[s + 3] = c[3];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    put(x, y, px(Math.floor((x * 255) / (w - 1)), Math.floor((y * 255) / (h - 1)), (x * 7 + y * 3) % 256));
  // 暖色/肤色块（不同明暗）
  for (let y = 2; y < 18; y++) for (let x = 42; x < 62; x++) {
    const t = (x - 42) / 19;
    put(x, y, px(150 + Math.round(t * 80), 90 + Math.round(t * 50), 60 + Math.round(t * 40)));
  }
  // 高饱和块
  for (let y = 44; y < 60; y++) for (let x = 2; x < 20; x++) {
    const t = (x - 2) / 17;
    put(x, y, px(Math.round(220 * (1 - t)), Math.round(30 + 150 * t), Math.round(30 + 190 * t)));
  }
  // 全透明角（RGB 是噪声，必须被跳过）
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) put(x, y, px(255, 0, 255, 0));
  return { width: w, height: h, data };
};

const opaqueHexes = (img: { width: number; height: number; data: Uint8Array }): Set<string> => {
  const s = new Set<string>();
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    if (img.data[o + 3]! < 128) continue;
    s.add(`#${[img.data[o]!, img.data[o + 1]!, img.data[o + 2]!].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  }
  return s;
};
const lum = (hex: string): number => {
  const v = parseInt(hex.slice(1), 16);
  return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
};
const isWarm = (hex: string): boolean => {
  const v = parseInt(hex.slice(1), 16), r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return r > g + 15 && r > 70 && b <= r && r - b > 20;
};

const fromModel = (): VisualWorldFromModel => ({
  format: "visual-world/v1",
  styleIdentity: { keywords: ["像素"], description: "一个合成世界" },
  camera: { mode: "side" }, composition: {}, lighting: {}, character: {}, environment: {},
  palette: {
    primary: ["palette:0"], secondary: ["palette:1"], accent: ["palette:2"],
    background: ["palette:1"], shadow: [], highlight: ["palette:2"],
  },
  materials: { wood: { appearance: "哑光", color: ["palette:0"] } },
  shapeLanguage: [], constraints: [],
  style: {
    id: "model", identity: [], camera: {}, composition: {}, palette: ["#ff0000", "#00ff00", "#0000ff"],
    lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5,
  },
});

describe("§ extractPalette —— 确定性、真实色、明暗与暖色", () => {
  const img = synthetic();

  it("24 / 32 两档长度正确；同一输入跑三次逐项相同", () => {
    for (const size of [24, 32]) {
      const a = extractPalette(img, { size });
      const b = extractPalette(img, { size });
      const c = extractPalette(img, { size });
      expect(a, `${size} 色`).toHaveLength(size);
      expect(a).toEqual(b);
      expect(a).toEqual(c);
    }
    expect(PALETTE_SIZE).toBe(32);
  });

  it("每个色**真的出现在参考图里**（不是加权平均出来的假色）", () => {
    const actual = opaqueHexes(img);
    for (const size of [24, 32]) for (const c of extractPalette(img, { size })) expect(actual.has(c), `${c} 不在图里`).toBe(true);
  });

  it("暖色/肤色与明暗都留了位置", () => {
    const all = extractPalette(img, { size: 32 });
    // 暖色预留 ~20% —— 至少 5 个（合成图的暖色块足够 6 个格子）
    expect(all.filter(isWarm).length).toBeGreaterThanOrEqual(5);
    // 明暗：至少落在 3 个亮度带里（这张图从 0 到 255 都有）
    const levels = new Set(all.map((c) => Math.floor(lum(c) / 64)));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it("全透明图 ⇒ 空色板（调用方不许拿它替换）", () => {
    const empty = { width: 4, height: 4, data: Buffer.alloc(4 * 4 * 4) };
    expect(extractPalette(empty, { size: 24 })).toEqual([]);
  });
});

describe("§ applyDeterministicPalette —— palette:N 全部改写且不越界", () => {
  const palette = extractPalette(synthetic(), { size: PALETTE_SIZE });
  const built = buildVisualWorld({ fromModel: fromModel(), styleReferences: [{ path: "ref.png" }], styleId: "s" });
  if (!built.ok) throw new Error(built.detail);
  const out = applyDeterministicPalette(built.spec as VisualWorldSpec, palette);

  const refs = (v: VisualWorldSpec): string[] => [
    ...Object.values(v.palette).flatMap((xs) => xs ?? []),
    ...Object.values(v.materials).flatMap((m) => m.color ?? []),
  ];

  it("style.palette 被替换成确定性色板；契约重新通过", () => {
    expect(out.style.palette).toEqual(palette);
    expect(VisualWorldSpecSchema.safeParse(out).success).toBe(true);
  });

  it("所有 palette:N 都在新色板范围内", () => {
    for (const ref of refs(out)) expect(Number(ref.slice("palette:".length))).toBeLessThan(palette.length);
    // 阳性对照：旧色板的 0/1/2 三个引用都还在（不是被删空）
    expect(refs(out).some((r) => r.startsWith("palette:"))).toBe(true);
  });

  it("引用按**旧色的最近新色**改写（语义尽量保住）", () => {
    const nearest = (hex: string): number => {
      const v = parseInt(hex.slice(1), 16), old = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      let best = 0, bd = Infinity;
      palette.forEach((p, i) => {
        const q = parseInt(p.slice(1), 16), c = [(q >> 16) & 255, (q >> 8) & 255, q & 255];
        const d = (c[0]! - old[0]!) ** 2 + (c[1]! - old[1]!) ** 2 + (c[2]! - old[2]!) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    expect(out.palette.primary[0]).toBe(`palette:${nearest("#ff0000")}`);
    expect(out.palette.secondary[0]).toBe(`palette:${nearest("#00ff00")}`);
    expect(out.palette.accent[0]).toBe(`palette:${nearest("#0000ff")}`);
    expect(out.materials.wood!.color![0]).toBe(`palette:${nearest("#ff0000")}`);
  });
});
