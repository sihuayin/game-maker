// VDC 自有 validator 的测试（visual-design-impl-v1 票 05）。
//
// ⚠️ 每条判据一个过/不过用例；前置门（SVG 语法/白名单失败）后**不继续处理**后续检查；
//   失败信息定位到「阶段 + 对象」。
import { describe, expect, it } from "vitest";
import { type VisualDesignSpec } from "@game-maker/contracts";
import { renderVds, serializeVds, validateVds } from "../src/index.js";

const PALETTE = ["#000000", "#6b8e55"];

const base = (): VisualDesignSpec => ({
  format: "visual-design/v1",
  viewport: { w: 480, h: 270 },
  style: { visualWorldFormat: "visual-world/v1" },
  objects: [
    { id: "bg", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
    { id: "player", role: "player", bounds: { x: 40, y: 190, w: 24, h: 40 }, layer: 10, fill: "palette:1" },
  ],
});

const svgOf = (v: VisualDesignSpec) => serializeVds(v, PALETTE);
const pngOf = (v: VisualDesignSpec) => renderVds(v, PALETTE);
const check = (v: VisualDesignSpec, svg: string, png = pngOf(v)) => validateVds(v, PALETTE, svg, png);
const has = (issues: { stage: string }[], stage: string) => issues.some((i) => i.stage === stage);

describe("validateVds", () => {
  it("合法 VDS + SVG + PNG ⇒ 空 issue（通过）", () => {
    const v = base();
    expect(check(v, svgOf(v))).toEqual([]);
  });

  it("确定性：同输入 ⇒ 同 issue 清单", () => {
    const v = base();
    expect(check(v, svgOf(v))).toEqual(check(v, svgOf(v)));
  });

  it("前置门：SVG 语法/白名单失败 → 只报 svg 一条，不继续处理", () => {
    const bad = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><script>alert(1)</script></svg>`;
    const issues = check(base(), bad);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.stage).toBe("svg");
    expect(issues[0]!.target).toBe("scene.svg");
  });

  it("画布尺寸：SVG viewport ≠ VDS viewport → canvas", () => {
    const bad = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <g id="bg"><rect x="0" y="0" width="480" height="270" fill="#000000"/></g>
  <g id="player"><rect x="40" y="190" width="24" height="40" fill="#6b8e55"/></g>
</svg>`;
    const issues = check(base(), bad);
    expect(has(issues, "canvas")).toBe(true);
  });

  it("对象 ID 唯一：SVG 里重复 <g id> → id", () => {
    const bad = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <g id="bg"><rect x="0" y="0" width="480" height="270" fill="#000000"/></g>
  <g id="bg"><rect x="0" y="0" width="480" height="270" fill="#000000"/></g>
</svg>`;
    const issues = check(base(), bad);
    expect(has(issues, "id")).toBe(true);
  });

  it("对象引用：fill 越界 → fill（定位到对象）", () => {
    const v = base();
    v.objects[0] = { ...v.objects[0]!, fill: "palette:9" };
    // 传**好** PNG（renderVds 会在越界 fill 上抛，这里不测那条路径）
    const issues = check(v, svgOf(base()), pngOf(base()));
    expect(issues.some((i) => i.stage === "fill" && i.target === "bg")).toBe(true);
  });

  it("对象边界：SVG rect 与 VDS 不一致 → bounds（定位到对象）", () => {
    const bad = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <g id="bg"><rect x="0" y="0" width="480" height="270" fill="#000000"/></g>
  <g id="player"><rect x="99" y="99" width="24" height="40" fill="#6b8e55"/></g>
</svg>`;
    const issues = check(base(), bad);
    expect(issues.some((i) => i.stage === "bounds" && i.target === "player")).toBe(true);
  });

  it("预览尺寸：PNG 尺寸 ≠ viewport → png", () => {
    const v = base();
    const badPng = { width: 100, height: 100, data: Buffer.alloc(100 * 100 * 4) };
    const issues = check(v, svgOf(v), badPng);
    expect(has(issues, "png")).toBe(true);
  });
});
