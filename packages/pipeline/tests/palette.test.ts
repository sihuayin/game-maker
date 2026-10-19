// 票 04：**确定性色板** —— 真参考图上的 24/32 预览 ＋ 一次链上的「跑三次同一份色板」。
//
// ⚠️ 纯函数的形状在 `packages/vision/tests/palette.test.ts`；这里验两件只有 pipeline 能验的事：
//   ① 真图（`fixtures/reference/test.png`，122k 色）上 24/32 的量化预览；
//   ② `runUnderstanding` 三次、模型给三份不同色板 ⇒ 落盘的 `style.palette` 逐字节相同。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { VisualWorldSpecSchema } from "@game-maker/contracts";
import { decodePNG, quantizeToPalette } from "@game-maker/assets";
import { extractPalette, PALETTE_SIZE } from "@game-maker/vision";
import { runUnderstanding } from "../src/index.js";
import { CANNED, fakeUpstream } from "./upstream.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const REF = path.join(ROOT, "fixtures/reference/test.png");
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://up.test", apiKey: "k" };
const TRANSPORT = { baseUrl: "http://up.test", apiKey: "k" };

const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-palette-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const ref = decodePNG(fs.readFileSync(REF));
const opaqueHexes = (): Set<string> => {
  const s = new Set<string>();
  for (let i = 0; i < ref.width * ref.height; i++) {
    const o = i * 4;
    if (ref.data[o + 3]! < 128) continue;
    s.add(`#${[ref.data[o]!, ref.data[o + 1]!, ref.data[o + 2]!].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  }
  return s;
};
const actual = opaqueHexes();
const lum = (hex: string): number => {
  const v = parseInt(hex.slice(1), 16);
  return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
};
const isWarm = (hex: string): boolean => {
  const v = parseInt(hex.slice(1), 16), r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return r > g + 15 && r > 70 && b <= r && r - b > 20;
};
const mse = (a: typeof ref, b: typeof ref): number => {
  let sum = 0, n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    if (a.data[o + 3]! < 128) continue;
    for (let k = 0; k < 3; k++) sum += (a.data[o + k]! - b.data[o + k]!) ** 2;
    n++;
  }
  return sum / n;
};

describe("§ 真图 24 / 32 色：确定性 + 量化预览", () => {
  it("三跑逐项相同；长度精确 24 / 32；每个色都在图里", () => {
    for (const size of [24, 32]) {
      const a = extractPalette(ref, { size });
      expect(extractPalette(ref, { size })).toEqual(a);
      expect(extractPalette(ref, { size })).toEqual(a);
      expect(a).toHaveLength(size);
      for (const c of a) expect(actual.has(c), `${c} 不在参考图里`).toBe(true);
    }
    expect(PALETTE_SIZE).toBe(32);
  });

  it("明暗与暖色都有位置（24 / 32 两档）", () => {
    // ⚠️ 不能 `Math.min(...lums)`：这张图有 12 万+ 个唯一色，展开参数会爆栈。
    let lo = Infinity, hi = -Infinity;
    for (const c of actual) { const l = lum(c); if (l < lo) lo = l; if (l > hi) hi = l; }
    for (const size of [24, 32]) {
      const pal = extractPalette(ref, { size });
      const bands = new Set(pal.map((c) => Math.min(3, Math.floor(((lum(c) - lo) / Math.max(1, hi - lo)) * 4))));
      expect(bands.size, `${size} 色只覆盖 ${bands.size} 个亮度带`).toBeGreaterThanOrEqual(3);
      expect(pal.filter(isWarm).length, `${size} 色的暖色太少`).toBeGreaterThanOrEqual(Math.round(size * 0.2));
    }
  });

  it("量化预览：32 色的误差不高于 24 色，且两档都在可用范围", () => {
    const err = (size: number) => {
      const pal = extractPalette(ref, { size });
      const q = quantizeToPalette(ref, pal);
      return { changed: q.changedPixels / q.opaquePixels, mse: mse(ref, q) };
    };
    const a = err(24), b = err(32);
    expect(b.mse, `24 色 MSE ${a.mse} → 32 色 ${b.mse}`).toBeLessThanOrEqual(a.mse);
    expect(a.changed, "24 色改色率").toBeGreaterThan(0.9);      // 真图 122k 色，不可能恰好落板
    expect(b.changed, "32 色改色率").toBeLessThanOrEqual(a.changed);
    // 量级守门：别让「24/32 色」变成把图糊成几块（真图的像素级 MSE 应低于 ~1200）
    expect(b.mse).toBeLessThan(1200);
  });
});

describe("§ 非 PNG 参考图：在**第一笔上游之前**拒", () => {
  it("jpg ⇒ usage 报错，且一次上游都不发", async () => {
    const cwd = tmp();
    fs.copyFileSync(REF, path.join(cwd, "style.jpg"));
    let calls = 0;
    const fetchImpl = (async () => { calls++; throw new Error("不该发出去"); }) as unknown as typeof fetch;
    const e = await runUnderstanding({
      outRoot: path.join(cwd, "out"), requirement: "做一个废土横版寻宝游戏",
      styleReferences: [{ path: "style.jpg" }], transport: TRANSPORT, fetchImpl, cwd, imageTransport: IMAGE,
    }).then(() => null, (x: unknown) => x as Error);
    expect(e).toBeInstanceOf(Error);
    expect(String(e)).toMatch(/只支持 PNG/);
    expect(calls).toBe(0);
  });
});

describe("§ 链上：同一张参考图跑三次，色板完全一致", () => {
  /** 模型三次各给一份**不同**的 style.palette —— 确定性覆盖必须把它们抹平。 */
  const variants = [
    ["#111111", "#222222"],
    ["#aa3333", "#33aa33", "#3333aa"],
    ["#010203", "#040506"],
  ];
  const worldReply = (palette: string[]) => ({
    content: [{
      type: "tool_use", name: "emit_visual_world",
      input: { ...CANNED.visualWorld, style: { ...(CANNED.visualWorld["style"] as object), palette } },
    }],
    stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 10, output_tokens: 10 },
  });

  it("三次落盘 style.palette 逐字节相同、长度 32、palette:N 全在范围", async () => {
    const cwd = tmp(), outRoot = path.join(cwd, "out");
    fs.copyFileSync(REF, path.join(cwd, "style.png"));        // 真参考图（122k 色）
    const inner = fakeUpstream({ recipeId: "wasteland" });
    let i = 0;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tool_choice?: { name?: string } };
      if (body.tool_choice?.name === "emit_visual_world")
        return new Response(JSON.stringify(worldReply(variants[i++ % variants.length]!)), {
          status: 200, headers: { "content-type": "application/json" },
        });
      return inner(url, init);
    }) as typeof fetch;

    for (let run = 0; run < 3; run++)
      await runUnderstanding({
        outRoot, requirement: "做一个废土横版寻宝游戏", styleReferences: [{ path: "style.png" }],
        transport: TRANSPORT, fetchImpl, cwd, imageTransport: IMAGE,
      });

    const read = (v: number) => JSON.parse(fs.readFileSync(
      path.join(outRoot, "wasteland", "run", `v${v + 1}`, "visual-world.json"), "utf8")) as { style: { palette: string[] } };
    const pals = [read(0), read(1), read(2)];
    for (const p of pals) {
      expect(p.style.palette).toHaveLength(PALETTE_SIZE);
      expect(p.style.palette).toEqual(pals[0]!.style.palette);
      const parsed = VisualWorldSpecSchema.safeParse(p);
      expect(parsed.success, parsed.success ? "" : parsed.error.issues.map((x) => x.message).join("；")).toBe(true);
    }
  }, 30_000);
});
