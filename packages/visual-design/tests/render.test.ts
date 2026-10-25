// PNG 渲染 + 与 SVG 的一致性证明的测试（visual-design-impl-v1 票 04）。
//
// ⚠️ Q5 硬约束：一致性不是「都从 VDS 派生」就完，而是**结构性同一** —— 这里证明
//   `serializeVds`（SVG）与 `toDrawList`（→ PNG）都用 `deriveRectInstructions` 这一份指令流，
//   且 round-trip 与逐像素都核对得上。
import { describe, expect, it } from "vitest";
import { encodePNG, type RasterImage } from "@game-maker/assets";
import { type VisualDesignSpec } from "@game-maker/contracts";
import { deriveRectInstructions, parseWhitelistedSvg, renderVds, serializeVds, toDrawList } from "../src/index.js";

const PALETTE = ["#000000", "#6b8e55", "#c8b432"];

const vds = (objects: VisualDesignSpec["objects"]): VisualDesignSpec => ({
  format: "visual-design/v1",
  viewport: { w: 480, h: 270 },
  style: { visualWorldFormat: "visual-world/v1" },
  objects,
});

const pixel = (img: RasterImage, x: number, y: number): [number, number, number, number] => {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
};

const base = vds([
  { id: "background", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
  { id: "player", role: "player", bounds: { x: 40, y: 190, w: 24, h: 40 }, layer: 10, fill: "palette:1", sourceIntent: "player" },
]);

describe("renderVds", () => {
  it("确定性：同 VDS ⇒ 同 RasterImage + 同 PNG 字节", () => {
    const a = renderVds(base, PALETTE);
    const b = renderVds(base, PALETTE);
    expect(a).toEqual(b);
    expect(encodePNG(a)).toEqual(encodePNG(b));
  });

  it("尺寸 = viewport（480×270）", () => {
    const img = renderVds(base, PALETTE);
    expect(img.width).toBe(480);
    expect(img.height).toBe(270);
  });

  it("逐像素：rect 覆盖边界 = bounds（无 AA 二进制覆盖）", () => {
    const img = renderVds(vds([
      { id: "r", role: "decor", bounds: { x: 10, y: 20, w: 5, h: 3 }, layer: 0, fill: "palette:0" },
    ]), PALETTE);
    expect(pixel(img, 10, 20)).toEqual([0, 0, 0, 255]); // rect 左上
    expect(pixel(img, 14, 22)).toEqual([0, 0, 0, 255]); // rect 右下（含）
    expect(pixel(img, 15, 22)).toEqual([0, 0, 0, 0]);   // rect 右侧外（透明）
    expect(pixel(img, 0, 0)).toEqual([0, 0, 0, 0]);     // 空白（透明）
  });
});

describe("一致性：SVG 与 PNG 同一份指令流", () => {
  it("deriveRectInstructions = layer 升序 + 解析后的 hex", () => {
    const instrs = deriveRectInstructions(base, PALETTE);
    expect(instrs.map((r) => r.id)).toEqual(["background", "player"]);
    expect(instrs.map((r) => r.color)).toEqual(["#000000", "#6b8e55"]);
  });

  it("SVG round-trip 与指令流一致（id + 几何 + 颜色）", () => {
    const instrs = deriveRectInstructions(base, PALETTE);
    const svgRects = parseWhitelistedSvg(serializeVds(base, PALETTE)).rects;
    expect(svgRects.map((r) => [r.id, r.x, r.y, r.width, r.height, r.fill])).toEqual(
      instrs.map((r) => [r.id, r.x, r.y, r.width, r.height, r.color]),
    );
  });

  it("toDrawList（→ PNG）与指令流一致（几何 + fillRef）", () => {
    const instrs = deriveRectInstructions(base, PALETTE);
    const dl = toDrawList(base, PALETTE);
    expect(dl.viewBox).toEqual([0, 0, 480, 270]);
    expect(dl.ops).toHaveLength(instrs.length);
    dl.ops.forEach((op, i) => {
      if (op.op !== "rect") throw new Error("期望 rect op");
      expect([op.x, op.y, op.w, op.h, op.fill]).toEqual([
        instrs[i]!.x, instrs[i]!.y, instrs[i]!.width, instrs[i]!.height, instrs[i]!.fillRef,
      ]);
    });
  });
});
