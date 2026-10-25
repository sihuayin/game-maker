// SVG 派生视图 + 最小白名单解析器的测试（visual-design-impl-v1 票 03）。
//
// ⚠️ 约束 #1：零依赖 ≠ 脆弱字符串检查。这里的恶意/畸变用例专挑「正则糊过去会漏」的坑：
//   重复属性、属性值里的裸 `<`、未知实体、自闭合 `<g>`、`<rect>` 带子节点、多余内容、DOCTYPE。
import { describe, expect, it } from "vitest";
import { type VisualDesignSpec } from "@game-maker/contracts";
import { parseWhitelistedSvg, serializeVds } from "../src/index.js";

const PALETTE = ["#000000", "#6b8e55", "#c8b432"];

const vds = (objects: VisualDesignSpec["objects"]): VisualDesignSpec => ({
  format: "visual-design/v1",
  viewport: { w: 480, h: 270 },
  style: { visualWorldFormat: "visual-world/v1" },
  objects,
});

const base = vds([
  { id: "background", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
  { id: "player", role: "player", bounds: { x: 40, y: 190, w: 24, h:40 }, layer: 10, fill: "palette:1", sourceIntent: "player" },
]);

const expectThrow = (svg: string, re = /./) => expect(() => parseWhitelistedSvg(svg)).toThrow(re);

describe("serializeVds", () => {
  it("确定性：同 VDS ⇒ 逐字节同 SVG", () => {
    expect(serializeVds(base, PALETTE)).toBe(serializeVds(base, PALETTE));
  });

  it("排序 = layer 升序（稳定）", () => {
    const out = serializeVds(vds([
      { id: "ui", role: "ui-panel", bounds: { x: 8, y: 8, w: 160, h: 24 }, layer: 100, fill: "palette:2" },
      { id: "bg", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
      { id: "player", role: "player", bounds: { x: 40, y: 190, w: 24, h: 40 }, layer: 10, fill: "palette:1" },
    ]), PALETTE);
    expect(out.indexOf("<g id=\"bg\"")).toBeLessThan(out.indexOf("<g id=\"player\""));
    expect(out.indexOf("<g id=\"player\"")).toBeLessThan(out.indexOf("<g id=\"ui\""));
  });

  it("fill 越界抛错（palette:N 的 N ≥ 色板长度）", () => {
    expect(() => serializeVds(vds([
      { id: "x", role: "decor", bounds: { x: 0, y: 0, w: 10, h: 10 }, layer: 0, fill: "palette:9" },
    ]), PALETTE)).toThrow(/越界/);
  });

  it("id 含特殊字符时转义（& < > \"），round-trip 后还原", () => {
    const raw = vds([
      { id: "a&b<c>\"d", role: "decor", bounds: { x: 0, y: 0, w: 10, h: 10 }, layer: 0, fill: "palette:0" },
    ]);
    const svg = serializeVds(raw, PALETTE);
    expect(svg).not.toContain("id=\"a&b");           // 原始 & 被转义
    expect(parseWhitelistedSvg(svg).rects[0]!.id).toBe("a&b<c>\"d");
  });
});

describe("parseWhitelistedSvg：round-trip", () => {
  it("serialize → parse → 同 viewport + rects", () => {
    const p = parseWhitelistedSvg(serializeVds(base, PALETTE));
    expect(p.viewport).toEqual({ w: 480, h: 270 });
    expect(p.rects).toEqual([
      { id: "background", x: 0, y: 0, width: 480, height: 270, fill: "#000000" },
      { id: "player", x: 40, y: 190, width: 24, height: 40, fill: "#6b8e55" },
    ]);
  });

  it("单引号属性 + 前后空白也能解析", () => {
    const p = parseWhitelistedSvg(
      "  <svg xmlns='http://www.w3.org/2000/svg' width='480' height='270' viewBox='0 0 480 270'>\n" +
      "    <g id='a'><rect x='0' y='0' width='10' height='10' fill='#000000'/></g>\n" +
      "  </svg>  ",
    );
    expect(p.rects).toHaveLength(1);
    expect(p.rects[0]!.id).toBe("a");
  });
});

describe("parseWhitelistedSvg：白名单与安全拒", () => {
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">${inner}</svg>`;

  it("非白名单元素 <circle> 拒", () => {
    expectThrow(wrap(`<g id="a"><circle cx="0" cy="0" r="5"/></g>`), /circle/);
  });

  it("非白名单属性 data-role 拒", () => {
    expectThrow(wrap(`<g id="a" data-role="player"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`), /data-role/);
  });

  it("重复属性拒", () => {
    expectThrow(wrap(`<g id="a" id="b"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`), /重复属性/);
  });

  it("<script> 拒", () => {
    expectThrow(wrap(`<script>alert(1)</script>`), /script|g/);
  });

  it("foreignObject 拒", () => {
    expectThrow(wrap(`<g id="a"><foreignObject></foreignObject></g>`), /foreignObject|g/);
  });

  it("onclick 属性拒", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000" onclick="x"/></g>`), /onclick/);
  });

  it("DOCTYPE / 外部实体拒", () => {
    expectThrow(`<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`);
  });

  it("属性值里的裸 < 拒", () => {
    expectThrow(wrap(`<g id="a<"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`), /不允许 </);
  });

  it("未知实体 &foo; 拒", () => {
    expectThrow(wrap(`<g id="a&foo;"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`), /未知实体/);
  });

  it("自闭合 <g/> 拒", () => {
    expectThrow(wrap(`<g id="a"/>`), /自闭合/);
  });

  it("<rect> 带子节点拒（必须自闭合）", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000"></rect></g>`), /自闭合/);
  });

  it("<g> 内多个 <rect> 拒", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000"/><rect x="1" y="1" width="10" height="10" fill="#000000"/></g>`), /只能有一个/);
  });

  it("标签不闭合拒", () => {
    expectThrow(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`);
  });

  it("标签不匹配拒", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000"/></rect>`), /不匹配|g/);
  });

  it("根元素后有多余内容拒", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`) + `<g id="b"></g>`, /多余内容/);
  });

  it("非空白文本拒", () => {
    expectThrow(wrap(`<g id="a">text<rect x="0" y="0" width="10" height="10" fill="#000000"/></g>`), /只允许/);
  });

  it("xmlns 错误拒", () => {
    expectThrow(`<svg xmlns="http://evil" width="480" height="270"></svg>`, /xmlns/);
  });

  it("fill 非 hex 拒", () => {
    expectThrow(wrap(`<g id="a"><rect x="0" y="0" width="10" height="10" fill="red"/></g>`), /#rrggbb/);
  });
});
